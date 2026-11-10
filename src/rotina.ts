import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or } from 'drizzle-orm';
import { opcional } from './ambiente.ts';
import * as B from './bling.ts';
import * as BC from './bling-conta.ts';
import { db, erroSemDados, pool } from './db.ts';
import { checarPagamento, INFINITEPAY, reciboOk, regraConfirmacao } from './infinitepay.ts';
import { avisarLider, LIDER, liderLigado } from './lider.ts';
import * as ME from './melhorenvio.ts';
import { anotar, em, mais1, mudar, PAGOS, porNsu, reais, type Pedido } from './pedidos.ts';
import { paginaVendasPedidos as P, paginaVendasPedidosHistorico as H, type StatusPedido } from './schema.ts';
import { chaveNfe } from './validar.ts';

// Tudo que gasta dinheiro ou muda estado fora daqui: confirmação de pagamento, aviso de acesso, etiqueta e rastreio.
// Dois containers rodam este código no mesmo Postgres: cada passo reivindica o pedido com UPDATE condicional antes de agir.

export const ENVIO_APOS_DIAS = Number(opcional('ENVIO_APOS_DIAS', /^([0-9]|[12][0-9]|30)$/, 'deve ser um número de 0 a 30') || 8);
const HORA = 3_600_000;
const vivo = and(eq(P.isDeleted, false));
const texto = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 40) : null);
const inteiro = (v: unknown) => (Number.isInteger(Number(v)) && v !== null && v !== '' ? Number(v) : null);
const data = (s: unknown) => { const d = new Date(String(s ?? '')); return Number.isNaN(d.getTime()) ? new Date() : d; };

export type Dica = { slug?: string | null; transactionNsu?: string | null; receiptUrl?: string | null };

// ponytail: no máximo 1 payment_check a cada 5 s por pedido, em memória e por container (com 2 containers, até 2).
// Segura laço de /obrigado ou de webhook com slug/nsu inventados batendo na API da InfinitePay com o handle da editora.
const ultimaChecagem = new Map<string, number>();
function podeChecar(nsu: string, agora = Date.now()): boolean {
  if (ultimaChecagem.size > 5000) ultimaChecagem.clear();
  if (agora - (ultimaChecagem.get(nsu) ?? 0) < 5000) return false;
  ultimaChecagem.set(nsu, agora);
  return true;
}

// Alerta e histórico só na primeira vez: a rotina reconfirma a cada 5 min e não deve encher log nem trilha.
async function alertarUmaVez(p: Pedido, acao: string, detalhe: string, log: string) {
  const ja = await db.select({ id: H.id }).from(H).where(and(eq(H.pedidoId, p.id), eq(H.acao, acao))).limit(1);
  if (ja.length) return;
  console.error(`ALERTA pagamento ${p.orderNsu}: ${log}`);
  await anotar(p.id, 'sistema', acao, detalhe);
}
const pagamentoUsado = (p: Pedido, slug: string, tx: string) => alertarUmaVez(p, 'pagamento já usado em outro pedido',
  `slug ${slug}, transação ${tx} já confirmaram outro pedido; este não foi marcado como pago`, 'transação/fatura já confirmou outro pedido. Não marquei como pago.');

// Função única de confirmação (webhook, /obrigado e rotina). Só payment_check com amount igual ao pedido marca PAGO.
export async function confirmarPagamento(nsu: string, dica: Dica = {}): Promise<StatusPedido | null> {
  const p = await porNsu(nsu);
  if (!p) return null;
  // O link da InfinitePay continua valendo depois do "Cancelar": pagamento em pedido cancelado não reativa, vira alerta.
  const cancelado = p.status === 'CANCELADO';
  if (p.status !== 'AGUARDANDO_PAGAMENTO' && !cancelado) return p.status;
  const slug = dica.slug || p.invoiceSlug, transactionNsu = dica.transactionNsu || p.transactionNsu;
  if (!slug || !transactionNsu || !INFINITEPAY.handle || !podeChecar(nsu)) return p.status;

  const r = await checarPagamento(INFINITEPAY, { orderNsu: nsu, transactionNsu, slug });
  // Se a InfinitePay devolver o order_nsu, ele tem de ser o deste pedido.
  const regra = r.order_nsu != null && r.order_nsu !== nsu ? 'pendente' : regraConfirmacao(r, p.valorCentavos);
  if (cancelado) {
    if (regra !== 'pendente') await alertarUmaVez(p, 'pagamento recebido em pedido cancelado',
      `slug ${slug}, transação ${transactionNsu}: reembolsar no app da InfinitePay ou reativar com o comprador`, 'pagamento confirmado para pedido CANCELADO: reembolsar ou reativar.');
    return p.status;
  }
  if (regra === 'divergente') {
    await alertarUmaVez(p, 'valor divergente', `InfinitePay confirmou ${String(r.amount)} centavos; o pedido vale ${p.valorCentavos}. Conferir no app da InfinitePay.`,
      `InfinitePay confirmou amount=${String(r.amount)}, o pedido vale ${p.valorCentavos}. Não marquei como pago.`);
    return p.status;
  }
  if (regra !== 'pago') return p.status;
  // Um pagamento vale para um pedido só (o índice único parcial segura a corrida; aqui sai a mensagem clara).
  const usado = await db.select({ id: P.id }).from(P).where(and(ne(P.id, p.id), ne(P.status, 'AGUARDANDO_PAGAMENTO'),
    or(eq(P.transactionNsu, transactionNsu), eq(P.invoiceSlug, slug)))).limit(1);
  if (usado.length) { await pagamentoUsado(p, slug, transactionNsu); return p.status; }

  const agora = new Date(), metodo = texto(r.capture_method), parcelas = inteiro(r.installments), pago = inteiro(r.paid_amount) ?? p.valorCentavos;
  const recibo = reciboOk(dica.receiptUrl) ? dica.receiptUrl : p.comprovanteUrl;
  let ganhou: boolean;
  try {
    ganhou = await mudar(p.id, em('AGUARDANDO_PAGAMENTO'), {
      status: 'PAGO', pagoEm: agora, envioPrevistoEm: new Date(agora.getTime() + ENVIO_APOS_DIAS * 24 * HORA),
      invoiceSlug: slug, transactionNsu, metodo, parcelas, valorPagoCentavos: pago, comprovanteUrl: recibo,
    }, 'sistema', 'pagamento confirmado', `${metodo ?? 'método ?'}${parcelas ? ` ${parcelas}x` : ''}, pago ${reais(pago)}`);
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code !== '23505') throw e; // 23505 = violou o índice único
    await pagamentoUsado(p, slug, transactionNsu);
    return p.status;
  }
  const atual = await porNsu(nsu);
  if (ganhou && atual) enviarAcesso(atual).catch((e) => console.error(`acesso ${nsu}:`, erroSemDados(e)));
  return atual?.status ?? null;
}

// Aviso à plataforma Líder de Impacto. A tentativa é reivindicada (tentativas = valor lido) para só um processo enviar.
export async function enviarAcesso(p: Pedido): Promise<void> {
  if (!PAGOS.includes(p.status) || !['PENDENTE', 'ERRO'].includes(p.acessoStatus) || p.acessoTentativas >= 10) return;
  if (!liderLigado(LIDER)) {
    if (p.acessoStatus === 'PENDENTE') await mudar(p.id, eq(P.acessoStatus, 'PENDENTE'), { acessoStatus: 'DESLIGADO' }, 'sistema', 'aviso de acesso desligado', 'sem LIDER_WEBHOOK_URL/SEGREDO: liberar o treinamento manualmente');
    return;
  }
  const minha = and(inArray(P.acessoStatus, ['PENDENTE', 'ERRO']), eq(P.acessoTentativas, p.acessoTentativas));
  if (!(await mudar(p.id, minha, { acessoTentativas: p.acessoTentativas + 1 }, 'sistema', null))) return;
  const erro = await avisarLider(LIDER, p);
  if (erro) console.warn(`acesso ${p.orderNsu}: ${erro}`);
  await mudar(p.id, undefined, erro ? { acessoStatus: 'ERRO', acessoErro: erro } : { acessoStatus: 'ENVIADO', acessoErro: null, acessoEm: new Date() },
    'sistema', erro ? 'falha no aviso de acesso' : 'aviso de acesso enviado', erro || null);
}

// Retomadas: pedido parado no meio (processo caiu) volta a andar pelos ids já gravados. Cada passo grava no pedido
// (updated_at anda), então só o que está parado há mais que isso é retomado; a reivindicação usa o mesmo corte.
const PARADA_ETIQUETA = 15 * 60_000, PARADA_NOTA = 3 * 60_000, LIMITE_NOTA = 2 * HORA;
const parado = (s: StatusPedido, ms: number) => and(em(s), lt(P.updatedAt, new Date(Date.now() - ms)));

export async function comprarEtiqueta(p: Pedido, cfg = ME.MELHOR_ENVIO, retomada = false): Promise<void> {
  const reivindicou = retomada
    ? await mudar(p.id, parado('COMPRANDO_ETIQUETA', PARADA_ETIQUETA), {}, 'sistema', 'compra da etiqueta retomada', 'o processo anterior parou no meio; segue pelos ids já gravados')
    : await mudar(p.id, em('PAGO'), { status: 'COMPRANDO_ETIQUETA', envioErro: null, envioTentativas: mais1(P.envioTentativas) },
      'sistema', 'compra da etiqueta iniciada', p.meEtiquetaId ? 'retomando etiqueta já no carrinho' : null);
  if (!reivindicou) return;
  p = (await porNsu(p.orderNsu)) ?? p; // lido de novo depois de reivindicar: ids gravados por quem parou no meio
  const envio = { ...p, notaChave: cfg.modo === 'nota' ? p.notaChave : null };
  let passo = 'cotação', etiqueta = p.meEtiquetaId, servico = p.meServico, frete = p.meFreteCentavos;
  try {
    if (!etiqueta) {
      const c = await ME.cotar(cfg, envio);
      servico = c.servico; frete = c.freteCentavos; passo = 'inserção no carrinho';
      etiqueta = await ME.inserirCarrinho(cfg, envio, c.servico);
      // Grava o id logo após o 201: daqui em diante nunca se insere outro no carrinho.
      await mudar(p.id, undefined, { meEtiquetaId: etiqueta, meServico: servico, meFreteCentavos: frete }, 'sistema', 'etiqueta no carrinho', `serviço ${servico}, frete ${reais(frete)}`);
    }
    let jaPaga = !!p.meCompradaEm; // checkout já confirmado antes: não chama de novo
    if (!jaPaga) {
      passo = 'compra';
      jaPaga = (await ME.comprar(cfg, etiqueta)) === 'ja_comprada';
      // Grava logo após o débito, sem olhar o status: se algo falhar daqui em diante, o painel sabe que o frete já saiu da carteira.
      await mudar(p.id, isNull(P.meCompradaEm), { meCompradaEm: new Date() }, 'sistema', 'etiqueta paga no Melhor Envio',
        jaPaga ? 'já estava paga no Melhor Envio' : `frete ${reais(frete)} debitado da carteira`);
    }
    passo = 'geração'; await ME.gerar(cfg, etiqueta);
    passo = 'impressão'; const url = await ME.imprimir(cfg, etiqueta);
    const fechou = await mudar(p.id, em('COMPRANDO_ETIQUETA'), { status: 'ETIQUETA_COMPRADA', meImpressaoUrl: url, envioErro: null },
      'sistema', 'etiqueta comprada', `serviço ${servico}, frete ${reais(frete)}${jaPaga ? ' (já estava paga no Melhor Envio)' : ''}`);
    if (!fechou) {
      console.error(`ALERTA envio ${p.orderNsu}: etiqueta comprada, mas o pedido mudou de status no meio. Conferir no Melhor Envio.`);
      await mudar(p.id, undefined, { meImpressaoUrl: url }, 'sistema', 'etiqueta comprada para pedido que mudou de status',
        'confira no Melhor Envio; se o pedido não vai sair, cancele a etiqueta para o frete voltar à carteira');
    }
  } catch (e) {
    const msg = e instanceof ME.ErroME ? e.message : `Falha de comunicação com o Melhor Envio (${(e as Error).name})`;
    console.error(`envio ${p.orderNsu}: falhou na ${passo}: ${msg.slice(0, 120)}`);
    await mudar(p.id, em('COMPRANDO_ETIQUETA'), { status: 'ERRO_ENVIO', envioErro: `Falhou na ${passo}: ${msg}` }, 'sistema', 'erro no envio', `passo: ${passo}`);
  }
}

// ---------- NF-e pelo Bling (no dia do envio, antes da etiqueta) ----------
class Parou extends Error {}
const MSG_SEFAZ = 'NF-e sem retorno da SEFAZ, confira no Bling (Vendas > Notas Fiscais de Saída): se autorizou, clique "Tentar de novo"; senão, cole a chave.';

// Contato → pedido de venda → gerar NF-e → transmitir → consultar. Cada id é gravado assim que o Bling devolve;
// quem retomar segue pelos ids (e acha pelo numeroLoja o pedido criado por quem caiu antes de gravar).
async function notaNoBling(p: Pedido): Promise<B.NotaLida> {
  const gravar = async (set: Partial<Pedido>, acao: string, detalhe: string) => {
    if (!(await mudar(p.id, em('EMITINDO_NOTA'), set, 'sistema', acao, detalhe))) throw new Parou();
  };
  let nfe = p.blingNfeId;
  if (!nfe) {
    let pedido = p.blingPedidoId ?? (await BC.acharPedido(p.orderNsu));
    const retomado = !!pedido;
    if (!pedido) {
      const produto = await BC.produto();
      const contato = p.blingContatoId ?? (await BC.acharContato(p.cpf)) ?? (await BC.criarContato(p));
      if (contato !== p.blingContatoId) await gravar({ blingContatoId: contato }, 'contato no Bling', `contato ${contato}`);
      pedido = await BC.criarPedido(B.corpoPedido(B.BLING, p, contato, produto));
      await gravar({ blingPedidoId: pedido }, 'pedido de venda criado no Bling', `pedido ${pedido}`);
    } else if (pedido !== p.blingPedidoId) await gravar({ blingPedidoId: pedido }, 'pedido de venda já existia no Bling', `pedido ${pedido}`);
    // Pedido retomado: a nota pode ter saído num gerar-nfe que estourou o tempo ou antes da queda; lê antes de gerar outra.
    nfe = (retomado ? await BC.notaDoPedido(pedido) : null) ?? (await BC.gerarNfe(pedido));
    await gravar({ blingNfeId: nfe }, 'NF-e gerada no Bling', `nota ${nfe}`);
  }
  let nota = await BC.consultarNfe(nfe);
  if (nota.situacao === 1) { // pendente = ainda não transmitida
    await BC.enviarNfe(nfe);
    await gravar({}, 'NF-e transmitida à SEFAZ', B.BLING.enviarEmail ? 'o Bling manda o DANFE por e-mail ao comprador' : 'sem e-mail do Bling ao comprador');
    nota = await BC.consultarNfe(nfe);
  }
  return nota;
}

export async function emitirNota(p: Pedido, retomada = false): Promise<void> {
  const reivindicou = retomada
    ? await mudar(p.id, parado('EMITINDO_NOTA', PARADA_NOTA), {}, 'sistema', null)
    : await mudar(p.id, em('PAGO'), { status: 'EMITINDO_NOTA', notaIniciadaEm: new Date(), notaErro: null }, 'sistema', 'emissão da NF-e iniciada',
      p.blingNfeId ? `retomando a nota ${p.blingNfeId} do Bling` : p.blingPedidoId ? `retomando o pedido ${p.blingPedidoId} do Bling` : null);
  if (!reivindicou) return;
  p = (await porNsu(p.orderNsu)) ?? p;
  const aguardar = (motivo: string, acao: string) =>
    mudar(p.id, em('EMITINDO_NOTA'), { status: 'AGUARDANDO_NOTA', notaErro: motivo }, 'sistema', acao, motivo);
  const venceu = Date.now() - (p.notaIniciadaEm ?? p.updatedAt).getTime() > LIMITE_NOTA;
  if (!B.blingConfigurado()) { await aguardar('Bling desligado (faltam variáveis BLING_*): cole a chave da NF-e.', 'aguardando nota fiscal'); return; }

  let nota: B.NotaLida;
  try {
    nota = await notaNoBling(p);
  } catch (e) {
    if (e instanceof Parou) return;
    const msg = e instanceof B.ErroBling ? e.message : `Falha inesperada na emissão (${(e as Error).name})`;
    console.error(`nota ${p.orderNsu}: ${msg.slice(0, 160)}`);
    // Temporário (rede, 429, 5xx): fica em EMITINDO_NOTA e a próxima rodada tenta de novo, até o limite de 2 h.
    if (!(e instanceof B.ErroBling) || e.temporario) {
      if (venceu) await aguardar(`${MSG_SEFAZ} Último erro: ${msg}`, 'NF-e sem retorno do Bling');
      else await mudar(p.id, em('EMITINDO_NOTA'), { notaErro: `${msg} (tenta de novo na próxima rodada)` }, 'sistema', null);
      return;
    }
    await aguardar(msg, 'falha na emissão da NF-e');
    return;
  }

  const [nome, desfecho] = B.situacaoNfe(nota.situacao);
  if (desfecho === 'pendente') {
    if (venceu) await aguardar(MSG_SEFAZ, 'NF-e sem retorno da SEFAZ');
    else await mudar(p.id, em('EMITINDO_NOTA'), { notaErro: null }, 'sistema', null); // a próxima rodada consulta de novo
  } else if (desfecho === 'recusada') {
    await aguardar(`NF-e ${nome.toLowerCase()} pela SEFAZ: corrija no Bling, transmita lá e clique "Tentar de novo", ou cole a chave.`, `NF-e ${nome.toLowerCase()}`);
  } else if (desfecho === 'cancelada') {
    await aguardar('NF-e cancelada no Bling: emita outra lá e cole a chave aqui.', 'NF-e cancelada no Bling');
  } else {
    const chave = chaveNfe(nota.chave ?? '');
    if (!chave) { await aguardar('O Bling diz que a NF-e foi autorizada, mas a chave veio inválida: confira no Bling e cole a chave.', 'falha na emissão da NF-e'); return; }
    const ok = await mudar(p.id, em('EMITINDO_NOTA'), { status: 'PAGO', notaChave: chave, notaNumero: nota.numero, notaDanfeUrl: nota.danfe, notaErro: null },
      'sistema', `NF-e nº ${nota.numero ?? '?'} autorizada`, `chave terminada em ${chave.slice(-6)}`);
    // Segue na mesma rodada para a etiqueta (a chave do Bling vai no options.invoice.key).
    const pago = ok ? await porNsu(p.orderNsu) : undefined;
    if (pago && ME.MELHOR_ENVIO.token) await comprarEtiqueta(pago);
  }
}

// ---------- passos da rotina ----------
async function reconfirmar() {
  if (!INFINITEPAY.handle) return;
  const ps = await db.select({ nsu: P.orderNsu }).from(P).where(and(vivo, em('AGUARDANDO_PAGAMENTO'),
    isNotNull(P.invoiceSlug), isNotNull(P.transactionNsu), gt(P.createdAt, new Date(Date.now() - 48 * HORA)))).limit(100);
  for (const { nsu } of ps) await confirmarPagamento(nsu).catch((e) => console.error(`confirmação ${nsu}:`, erroSemDados(e)));
}

// Só pedidos parados há 1 min: a reserva (tentativas+1) mexe no updated_at, então um aviso em voo (até 10 s)
// em outro container não é lido de novo e reenviado. O primeiro aviso sai direto do confirmarPagamento.
async function avisos() {
  const ps = await db.select().from(P).where(and(vivo, em(...PAGOS), inArray(P.acessoStatus, ['PENDENTE', 'ERRO']), lt(P.acessoTentativas, 10),
    lt(P.updatedAt, new Date(Date.now() - 60_000)))).limit(100);
  for (const p of ps) await enviarAcesso(p);
}

async function retomadas() {
  const parados = (s: StatusPedido, ms: number) => db.select().from(P).where(and(vivo, parado(s, ms))).limit(50);
  for (const p of await parados('EMITINDO_NOTA', PARADA_NOTA)) await emitirNota(p, true);
  if (ME.MELHOR_ENVIO.token) for (const p of await parados('COMPRANDO_ETIQUETA', PARADA_ETIQUETA)) await comprarEtiqueta(p, ME.MELHOR_ENVIO, true);
}

async function envios() {
  await retomadas();
  const ps = await db.select().from(P).where(and(vivo, em('PAGO'), lte(P.envioPrevistoEm, new Date()))).orderBy(P.envioPrevistoEm).limit(50);
  const nota = ME.MELHOR_ENVIO.modo === 'nota';
  // Bling: null = desligado (chave manual), false = configurado mas sem autorização, true = emite.
  const bling = nota && B.blingConfigurado() && ps.some((p) => !p.notaChave) ? await BC.autorizada() : null;
  for (const p of ps) {
    if (nota && !p.notaChave) {
      if (bling) await emitirNota(p);
      else await mudar(p.id, em('PAGO'), { status: 'AGUARDANDO_NOTA', notaErro: bling === false ? BC.MSG_AUTORIZAR : null }, 'sistema', 'aguardando nota fiscal',
        bling === false ? BC.MSG_AUTORIZAR : 'informe a chave da NF-e no painel para liberar o envio');
    } else if (ME.MELHOR_ENVIO.token) await comprarEtiqueta(p);
  }
}

async function rastreios() {
  if (!ME.MELHOR_ENVIO.token) return;
  const ps = await db.select().from(P).where(and(vivo, em('ETIQUETA_COMPRADA', 'POSTADO'), isNotNull(P.meEtiquetaId),
    or(isNull(P.rastreioChecadoEm), lt(P.rastreioChecadoEm, new Date(Date.now() - 6 * HORA))))).limit(100);
  if (!ps.length) return;
  const r = await ME.rastrear(ME.MELHOR_ENVIO, ps.map((p) => p.meEtiquetaId!));
  for (const p of ps) {
    const t = r[p.meEtiquetaId!] ?? {};
    const base = { rastreio: t.tracking || p.rastreio, rastreioChecadoEm: new Date() };
    const cod = base.rastreio ? `rastreio ${base.rastreio}` : null;
    if (t.delivered_at) await mudar(p.id, em('ETIQUETA_COMPRADA', 'POSTADO'), { ...base, status: 'ENTREGUE', entregueEm: data(t.delivered_at), postadoEm: p.postadoEm ?? (t.posted_at ? data(t.posted_at) : null) }, 'sistema', 'entregue', cod);
    else if (t.posted_at && p.status === 'ETIQUETA_COMPRADA') await mudar(p.id, em('ETIQUETA_COMPRADA'), { ...base, status: 'POSTADO', postadoEm: data(t.posted_at) }, 'sistema', 'postado', cod);
    else await mudar(p.id, undefined, base, 'sistema', null);
  }
}

// ponytail: trava global por advisory lock numa conexão dedicada: só um dos dois containers roda a rotina por vez.
// Se a conexão cair no meio, a trava solta e o outro pode entrar; os UPDATEs condicionais seguram a compra dupla.
const TRAVA = 741_903_311;
const PASSOS: [string, () => Promise<void>][] = [['reconfirmar', reconfirmar], ['avisos', avisos], ['bling', BC.renovarDiario], ['envios', envios], ['rastreios', rastreios]];

export async function rodarRotina(): Promise<boolean> {
  const c = await pool.connect();
  // A conexão da trava fica ociosa por minutos fora do pool (que tira o listener dela): sem este, uma queda derruba o processo.
  let caiu: Error | undefined;
  const aoCair = (e: Error) => { caiu = e; console.error('rotina (trava):', e.message); };
  c.on('error', aoCair);
  try {
    const { rows } = await c.query<{ ok: boolean }>('select pg_try_advisory_lock($1) as ok', [TRAVA]);
    if (!rows[0].ok) return false;
    try {
      for (const [nome, passo] of PASSOS) await passo().catch((e) => console.error(`rotina (${nome}):`, erroSemDados(e)));
    } finally {
      await c.query('select pg_advisory_unlock($1)', [TRAVA]).catch((e: Error) => { caiu ??= e; });
    }
    return true;
  } finally {
    c.off('error', aoCair);
    c.release(caiu); // conexão quebrada é descartada, não volta ao pool
  }
}

export function iniciarRotina(): void {
  const rodar = () => { rodarRotina().catch((e) => console.error('rotina:', erroSemDados(e))); };
  setTimeout(rodar, 30_000);
  setInterval(rodar, 5 * 60_000);
}
