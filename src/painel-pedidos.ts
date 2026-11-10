import type http from 'node:http';
import { BLING, blingConfigurado, ErroBling } from './bling.ts';
import { cancelarPedidoBling } from './bling-conta.ts';
import { esc, num } from './graficos.ts';
import { fim, html, ir, lerCorpo, mesmaOrigem, PRIVADO } from './http.ts';
import { icone, type NomeIcone } from './icones.ts';
import { INFINITEPAY } from './infinitepay.ts';
import { LIDER, liderLigado } from './lider.ts';
import { MELHOR_ENVIO } from './melhorenvio.ts';
import { barraPainel, SCRIPT_TEMA } from './painel.ts';
import { ESTILO } from './painel-estilo.ts';
import { PAGINAS, type NomePagina } from './pagina.ts';
import * as pedidos from './pedidos.ts';
import { ANTES_DA_ETIQUETA, ehStatus, NSU, POR_PAGINA, reais, type Pedido } from './pedidos.ts';
import { STATUS_PEDIDO, type StatusPedido } from './schema.ts';
import type { Tema } from './tema.ts';
import { chaveNfe } from './validar.ts';

// /painel/pedidos: lista, detalhe, ações (com histórico "painel:<usuario>") e CSV. Mesma sessão e visual do /painel.

type Tom = 'azul' | 'violeta' | 'ambar' | 'verde' | 'rosa' | 'ceu' | 'neutro';
const STATUS: Record<StatusPedido, [string, NomeIcone, Tom]> = {
  AGUARDANDO_PAGAMENTO: ['Aguardando pagamento', 'ampulheta', 'neutro'], PAGO: ['Pago', 'dinheiro', 'verde'],
  EMITINDO_NOTA: ['Emitindo nota', 'nota', 'violeta'], AGUARDANDO_NOTA: ['Aguardando nota', 'recibo', 'ambar'],
  COMPRANDO_ETIQUETA: ['Comprando etiqueta', 'carrinho', 'ceu'], ETIQUETA_COMPRADA: ['Etiqueta comprada', 'pacote', 'azul'],
  POSTADO: ['Postado', 'caminhao', 'ceu'], ENTREGUE: ['Entregue', 'entregue', 'verde'],
  ERRO_ENVIO: ['Erro no envio', 'alerta', 'rosa'], CANCELADO: ['Cancelado', 'cancelar', 'neutro'],
};
const chipStatus = (s: StatusPedido) => `<span class="etiqueta t-${STATUS[s][2]}">${icone(STATUS[s][1])}${STATUS[s][0]}</span>`;
const quando = (d: Date | null) => (d ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(d) : '—');
const dia = (d: Date | null) => (d ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(d) : '—');
const mascara = (s: string, m: RegExp, f: string) => s.replace(m, f);
const cpf = (s: string) => mascara(s, /^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const tel = (s: string) => mascara(s, /^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
const cep = (s: string) => mascara(s, /^(\d{5})(\d{3})$/, '$1-$2');
const v = (s: unknown) => (s == null || s === '' ? '—' : esc(s));
// capture_method da InfinitePay em português (valor desconhecido aparece como veio).
const METODOS: Record<string, string> = { credit_card: 'Cartão', pix: 'Pix' };
const metodo = (s: string | null) => v(s && (METODOS[s] ?? s));

const CSS = `.g-status{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.st{display:flex;flex-direction:column;gap:6px;padding:14px 16px;text-decoration:none;color:var(--texto)}.st:hover{color:var(--texto);border-color:var(--borda-forte)}
.st.on{box-shadow:inset 0 0 0 2px var(--destaque)}.st b{font-size:22px;font-weight:600}.st .etiqueta svg{font-size:14px}
.avisos{display:grid;gap:8px}.avisos p{margin:0;display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:12px;background:var(--superficie-2);color:var(--suave);font-size:13px}
.avisos svg{font-size:18px;color:var(--tom-ambar)}
.paginas{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 20px;border-top:1px solid var(--borda);font-size:13px;color:var(--suave)}
.dados{display:grid;grid-template-columns:minmax(110px,max-content) minmax(0,1fr);gap:8px 16px;margin:0;font-size:13.5px}.dados dt{color:var(--suave)}.dados dd{margin:0;overflow-wrap:anywhere}
.g-det{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}
.acoes-p{display:grid;gap:16px}.acoes-p form{margin:0}.acoes-p p{margin:0 0 6px;font-size:12.5px;color:var(--suave)}
.linha-f{display:flex;gap:8px;flex-wrap:wrap}.linha-f input{flex:1;min-width:220px;height:36px;border-radius:10px;border:1px solid var(--borda-forte);background:var(--fundo);color:var(--texto);padding:0 10px;font:13px ui-monospace,Consolas,monospace}
.bt-perigo{background:color-mix(in oklab,var(--perigo) 14%,transparent);color:var(--perigo);border-color:color-mix(in oklab,var(--perigo) 35%,transparent)}
.bt-perigo:hover{background:color-mix(in oklab,var(--perigo) 22%,transparent);color:var(--perigo)}
.msg{display:flex;gap:10px;align-items:center;padding:12px 16px;border-radius:12px;font-size:13.5px}.msg svg{font-size:18px}
.msg.ok{background:color-mix(in oklab,var(--sucesso) 12%,transparent);color:var(--sucesso)}.msg.erro{background:color-mix(in oklab,var(--perigo) 12%,transparent);color:var(--perigo)}
.erro-envio{color:var(--perigo)}
.tabela td.quebra{white-space:normal;min-width:160px;max-width:220px}.tabela td.larga{min-width:240px;max-width:none}
dialog{border:1px solid var(--borda);border-radius:var(--raio);background:var(--superficie);color:var(--texto);width:min(460px,calc(100% - 32px));padding:24px;box-shadow:var(--sombra-elevado)}
dialog::backdrop{background:rgb(0 0 0/.6);backdrop-filter:blur(2px)}dialog h2{margin:0 0 10px;font-size:17px}dialog p{margin:0 0 12px;color:var(--suave);line-height:1.6}
.c-espera{font-size:12.5px;color:var(--tom-ambar)!important}.c-bt{display:flex;justify-content:flex-end;gap:8px}
.c-bt button[disabled]{opacity:.45;cursor:not-allowed}`;

// Casca comum das telas de pedidos e do Bling (mesma sessão e visual do /painel).
export function pagina(titulo: string, corpo: string, ctx: Ctx, script = '', aba: 'pedidos' | 'bling' = 'pedidos') {
  return `<!doctype html><html lang="pt-BR" data-theme="${ctx.tema}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>${titulo} · Painel Liderança Inteligente</title><link rel="icon" href="/img/livro-lideranca-inteligente.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${ESTILO}${CSS}</style></head><body>
${barraPainel(ctx.usuario, aba)}
<main class="cont">${corpo}</main>
<footer class="rodape">Liderança Inteligente · pedidos do checkout próprio · horários de Brasília</footer>
<script>(function(){${SCRIPT_TEMA}${script}})();</script></body></html>`;
}

function avisosConfig(): string {
  const a: string[] = [];
  if (!INFINITEPAY.handle) a.push('Checkout próprio desligado (sem INFINITEPAY_HANDLE): os botões da página vão para o CHECKOUT_URL.');
  if (!MELHOR_ENVIO.token) a.push('Melhor Envio desligado (sem MELHOR_ENVIO_TOKEN): nenhuma etiqueta é comprada.');
  else if (MELHOR_ENVIO.modo === 'nota') a.push(blingConfigurado()
    ? 'Modo nota fiscal: a NF-e sai pelo Bling no dia do envio, logo antes da etiqueta (conexão em Painel > Bling). A chave colada aqui continua valendo como reserva.'
    : 'Modo nota fiscal: cada pedido só é enviado depois que a chave da NF-e for informada aqui (Bling desligado).');
  if (!liderLigado(LIDER)) a.push('Aviso à plataforma Líder de Impacto desligado: libere o treinamento manualmente.');
  return a.length ? `<div class="avisos">${a.map((t) => `<p>${icone('alerta', 'duotone')}${t}</p>`).join('')}</div>` : '';
}

async function lista(url: URL, ctx: Ctx): Promise<string> {
  const st = url.searchParams.get('status'), status = ehStatus(st) ? st : null;
  const pg = Math.max(1, Math.min(10_000, Number(url.searchParams.get('pg')) || 1));
  const [r, { linhas, total }] = await Promise.all([pedidos.resumoPedidos(), pedidos.listarPedidos(status, pg)]);
  const todos = Object.values(r.porStatus).reduce((s, n) => s + (n ?? 0), 0);
  const q = (o: Record<string, string | number | null>) => {
    const u = new URLSearchParams();
    for (const [k, x] of Object.entries({ status, ...o }) as [string, unknown][]) if (x != null) u.set(k, String(x));
    return u.size ? `?${u}` : '';
  };
  const cards = `<div class="g-status">
  <a class="cartao st${status ? '' : ' on'}" href="/painel/pedidos"><span class="etiqueta t-violeta">${icone('dinheiro')}Recebido</span><b class="num">${reais(r.somaPaga)}</b><small>${num(todos)} pedidos no total</small></a>
  ${STATUS_PEDIDO.map((s) => `<a class="cartao st${status === s ? ' on' : ''}" href="/painel/pedidos?status=${s}"${status === s ? ' aria-current="true"' : ''}>${chipStatus(s)}<b class="num">${num(r.porStatus[s] ?? 0)}</b></a>`).join('')}</div>`;
  const tabela = linhas.length ? `<div class="rolar"><table class="tabela"><thead><tr><th>Pedido</th><th>Status</th><th>Data</th><th>Nome</th><th>Cidade/UF</th><th>Valor</th><th>Método</th><th>Envio previsto</th><th>Rastreio</th></tr></thead><tbody>
  ${linhas.map((p) => `<tr><td class="nome"><a href="/painel/pedidos/${p.orderNsu}">${p.orderNsu}</a></td><td>${chipStatus(p.status)}</td><td>${quando(p.createdAt)}</td><td class="quebra">${esc(p.nome)}</td><td>${esc(p.cidade)}/${esc(p.uf)}</td>
    <td>${reais(p.valorPagoCentavos ?? p.valorCentavos)}</td><td>${metodo(p.metodo)}${p.parcelas && p.parcelas > 1 ? ` ${p.parcelas}x` : ''}</td><td>${dia(p.envioPrevistoEm)}</td><td>${v(p.rastreio)}</td></tr>`).join('')}
  </tbody></table></div>` : `<div class="vazio-mini">Nenhum pedido${status ? ` com status "${STATUS[status][0]}"` : ''} ainda.</div>`;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const nav = paginas > 1 ? `<div class="paginas"><span>Página ${pg} de ${paginas} · ${num(total)} pedidos</span><span>
    ${pg > 1 ? `<a class="bt bt-contorno" href="/painel/pedidos${q({ pg: pg - 1 })}">Anterior</a>` : ''} ${pg < paginas ? `<a class="bt bt-contorno" href="/painel/pedidos${q({ pg: pg + 1 })}">Próxima</a>` : ''}</span></div>` : '';
  return pagina('Pedidos', `<div class="cabecalho"><div class="cab-esq"><span class="chip lg t-azul">${icone('pacote', 'duotone')}</span><div>
    <h1>Pedidos ${status ? `<span class="etiqueta t-neutro">${STATUS[status][0]}</span>` : ''}</h1><p>Vendas do checkout próprio (InfinitePay) e envio do livro (Melhor Envio)</p></div></div>
    <div class="acoes"><a class="bt bt-contorno" href="/painel/pedidos/exportar.csv${q({})}">${icone('baixar')}Exportar CSV</a></div></div>
  <div class="pilha">${avisosConfig()}${cards}<section class="cartao">${tabela}${nav}</section></div>`, ctx);
}

const OK: Record<string, string> = {
  nota: 'Chave da NF-e gravada. Se o prazo de envio já passou, a próxima rodada da rotina (até 5 minutos) compra a etiqueta.',
  'enviar-agora': 'Envio antecipado: a próxima rodada da rotina (até 5 minutos) compra a etiqueta (se a chave da NF-e já estiver informada).',
  tentar: 'O pedido voltou para "Pago": a próxima rodada tenta de novo, retomando a etiqueta se ela já estiver no carrinho.',
  'tentar-nota': 'O pedido voltou para "Pago": a próxima rodada (até 5 minutos) retoma a NF-e pelo Bling (sem gerar outra se já existe) e segue para a etiqueta.',
  'reenviar-acesso': 'Aviso de acesso na fila: sai na próxima rodada da rotina (até 5 minutos).',
  cancelar: 'Pedido cancelado: não será enviado. O reembolso, se houver, é feito no app da InfinitePay.',
};
const ERRO: Record<string, string> = {
  chave: 'Chave inválida: confira os 44 números (o último é o dígito verificador).',
  estado: 'O pedido mudou de situação e esta ação não vale mais. Confira o histórico abaixo.',
};

async function detalhe(p: Pedido, url: URL, ctx: Ctx): Promise<string> {
  const hist = await pedidos.historicoDe(p.id);
  const ok = OK[url.searchParams.get('ok') ?? ''], erro = ERRO[url.searchParams.get('erro') ?? ''];
  const msg = ok ? `<p class="msg ok" role="status">${icone('ok')}${ok}</p>` : erro ? `<p class="msg erro" role="alert">${icone('alerta')}${erro}</p>` : '';
  const dl = (l: [string, string][]) => `<dl class="dados">${l.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`;
  const link = (u: string | null, t: string) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${t}</a>` : '—');
  const cartao = (i: NomeIcone, tom: Tom, t: string, corpo: string) =>
    `<section class="cartao"><header class="cartao-cab"><div class="tit"><span class="chip t-${tom}">${icone(i, 'duotone')}</span><div><h2>${t}</h2></div></div></header><div class="corpo">${corpo}</div></section>`;
  const base = `/painel/pedidos/${p.orderNsu}`;
  const st = p.status;

  const acoes: string[] = [];
  const resumo = `${p.nome} (${p.cidade}/${p.uf})`;
  if (st === 'PAGO' || st === 'AGUARDANDO_NOTA') {
    // Prazo vencido: a chave libera a compra na próxima rodada (débito na carteira), então pede confirmação com bloqueio.
    const vencido = !!p.envioPrevistoEm && p.envioPrevistoEm.getTime() <= Date.now();
    const botao = vencido
      ? `<button type="button" class="bt bt-primario" data-confirmar="f-nota" data-campo="chave-nfe" data-titulo="Informar a chave e enviar o pedido ${p.orderNsu}?"
        data-texto="${esc(`A etiqueta de ${resumo} será comprada em até 5 minutos, debitando o frete da carteira do Melhor Envio. Confira se a nota é deste pedido.`)}">${icone('recibo')}Informar chave</button>`
      : `<button class="bt bt-primario">${icone('recibo')}Informar chave</button>`;
    const gerada = p.blingNfeId && !p.notaChave ? `<p class="c-espera">A NF-e ${esc(p.blingNfeId)} já foi gerada no Bling e pode ter sido autorizada: confira lá antes de emitir outra à mão (senão a venda fica com 2 NF-e).</p>` : '';
    acoes.push(`<form id="f-nota" method="post" action="${base}/nota">${gerada}<p>Chave de acesso da NF-e (44 números; pode colar com espaços ou pontos)</p>
      <div class="linha-f"><input id="chave-nfe" name="chave" inputmode="numeric" autocomplete="off" maxlength="60" required value="${esc(p.notaChave ?? '')}" aria-label="Chave da NF-e">${botao}</div></form>`);
  }
  if (st === 'PAGO') {
    const semNota = MELHOR_ENVIO.modo !== 'nota' || p.notaChave ? ' na próxima rodada da rotina (até 5 minutos)'
      : blingConfigurado() ? ' logo depois que o Bling emitir a NF-e (a emissão começa na próxima rodada)' : ' assim que a chave da NF-e for informada';
    acoes.push(`<div><p>Previsto para ${dia(p.envioPrevistoEm)}. Antecipa a compra da etiqueta (debita o frete da carteira do Melhor Envio).</p>
      <button type="button" class="bt bt-contorno" data-confirmar="f-enviar" data-titulo="Enviar o pedido ${p.orderNsu} agora?"
      data-texto="${esc(`A etiqueta de ${p.nome} (${p.cidade}/${p.uf}) será comprada${semNota}, debitando o frete da carteira do Melhor Envio, mesmo antes de terminar a garantia de 7 dias.`)}">${icone('enviar')}Enviar agora</button>
      <form id="f-enviar" method="post" action="${base}/enviar-agora" hidden></form></div>`);
  }
  if (st === 'COMPRANDO_ETIQUETA') acoes.push(`<p class="erro-envio">Compra da etiqueta em andamento: "Tentar de novo" e "Cancelar" voltam quando ela terminar. Se o processo parar no meio, a rotina retoma sozinha após 15 minutos (sem comprar outra).</p>`);
  if (st === 'EMITINDO_NOTA') acoes.push(`<p class="erro-envio">NF-e em emissão no Bling: a rotina consulta a cada rodada e segue para a etiqueta quando a SEFAZ autorizar (sem retorno em 2 h, o pedido volta para "Aguardando nota").</p>`);
  if (st === 'AGUARDANDO_NOTA' && blingConfigurado()) {
    const como = p.blingNfeId ? `retoma a nota ${p.blingNfeId} já gerada no Bling (não gera outra)` : 'emite a NF-e pelo Bling';
    acoes.push(`<div><p>Volta o pedido para "Pago"; a rotina ${como} e, autorizada, compra a etiqueta.</p>
      <button type="button" class="bt bt-contorno" data-confirmar="f-tentar-nota" data-titulo="Tentar de novo a NF-e do pedido ${p.orderNsu}?"
      data-texto="${esc(`Em até 5 minutos a rotina ${como}. Se a SEFAZ autorizar, a etiqueta de ${resumo} é comprada na mesma rodada, debitando o frete da carteira do Melhor Envio.`)}">${icone('repetir')}Tentar de novo</button>
      <form id="f-tentar-nota" method="post" action="${base}/tentar-nota" hidden></form></div>`);
  }
  if (st === 'ERRO_ENVIO') {
    const como = p.meEtiquetaId ? 'retoma a etiqueta já no carrinho (não compra outra)' : 'a rotina cota e compra de novo';
    acoes.push(`<div><p>Volta o pedido para "Pago"; ${como}.</p>
      <button type="button" class="bt bt-contorno" data-confirmar="f-tentar" data-titulo="Tentar de novo o envio do pedido ${p.orderNsu}?"
      data-texto="${esc(`A etiqueta de ${resumo} será comprada em até 5 minutos, debitando o frete da carteira do Melhor Envio (${como}).`)}">${icone('repetir')}Tentar de novo</button>
      <form id="f-tentar" method="post" action="${base}/tentar" hidden></form></div>`);
  }
  if (pedidos.PAGOS.includes(st)) acoes.push(`<form method="post" action="${base}/reenviar-acesso"><p>Manda de novo o aviso de compra para a plataforma Líder de Impacto.</p><button class="bt bt-contorno">${icone('enviar')}Reenviar aviso de acesso</button></form>`);
  const extra = [st === 'AGUARDANDO_PAGAMENTO' ? 'O link de pagamento da InfinitePay continua ativo: se a pessoa pagar depois, o pedido aparece com alerta no histórico.' : '',
    pedidos.etiquetaPendente(p) ? `${pedidos.etiquetaPendente(p)}.` : '', pedidos.notaPendente(p) ? `${pedidos.notaPendente(p)}.` : ''].filter(Boolean).join(' ');
  if (ANTES_DA_ETIQUETA.includes(st)) acoes.push(`<div><p>Para de enviar o pedido. Não devolve o dinheiro: o reembolso é feito no app da InfinitePay.</p>
    <button type="button" class="bt bt-perigo" data-confirmar="f-cancelar" data-titulo="Cancelar o pedido ${p.orderNsu}?"
    data-texto="${esc(`O pedido de ${p.nome} (${reais(p.valorPagoCentavos ?? p.valorCentavos)}) não será mais enviado. Isto NÃO devolve o dinheiro: faça o reembolso no app da InfinitePay. Não dá para desfazer pelo painel.${extra ? ` ${extra}` : ''}`)}">${icone('cancelar')}Cancelar pedido</button>
    <form id="f-cancelar" method="post" action="${base}/cancelar" hidden></form></div>`);

  const pag = PAGINAS[p.pagina as NomePagina]?.nome ?? p.pagina;
  const corpo = `<div class="cabecalho"><div class="cab-esq"><span class="chip lg t-${STATUS[st][2]}">${icone(STATUS[st][1], 'duotone')}</span><div>
    <h1>Pedido ${p.orderNsu} ${chipStatus(st)}</h1><p>Criado em ${quando(p.createdAt)} · ${esc(pag)}</p></div></div>
    <div class="acoes"><a class="bt bt-neutro" href="/painel/pedidos">Voltar para a lista</a></div></div>
  <div class="pilha">${msg}<div class="g-det">
  ${cartao('local', 'azul', 'Comprador e entrega', dl([['Nome', esc(p.nome)], ['E-mail', esc(p.email)], ['Celular', esc(tel(p.telefone))], ['CPF', esc(cpf(p.cpf))],
    ['Endereço', `${esc(p.rua)}, ${esc(p.numero)}${p.complemento ? ` · ${esc(p.complemento)}` : ''}<br>${esc(p.bairro)} · ${esc(p.cidade)}/${esc(p.uf)} · CEP ${esc(cep(p.cep))}`]]))}
  ${cartao('dinheiro', 'verde', 'Pagamento', dl([['Valor', reais(p.valorCentavos)], ['Pago', p.valorPagoCentavos == null ? '—' : reais(p.valorPagoCentavos)],
    ['Método', `${metodo(p.metodo)}${p.parcelas ? ` · ${p.parcelas}x` : ''}`], ['Pago em', quando(p.pagoEm)], ['Comprovante', link(p.comprovanteUrl, 'abrir')], ['Transação', v(p.transactionNsu)]]))}
  ${cartao('nota', 'violeta', 'Nota fiscal', dl([['Número', v(p.notaNumero)], ['Situação', situacaoNota(p)], ['Chave', v(p.notaChave)],
    ['DANFE', link(p.notaDanfeUrl, 'abrir')], ['No Bling', p.blingPedidoId || p.blingNfeId ? `pedido ${v(p.blingPedidoId)} · nota ${v(p.blingNfeId)}` : '—'],
    ...(p.notaErro ? [['Erro', `<span class="erro-envio">${esc(p.notaErro)}</span>`] as [string, string]] : [])]))}
  ${cartao('pacote', 'ambar', 'Envio', dl([['Previsto', quando(p.envioPrevistoEm)], ['Serviço', p.meServico ? `${p.meServico === 1 ? 'PAC' : p.meServico === 2 ? 'SEDEX' : p.meServico} · ${reais(p.meFreteCentavos)}` : '—'],
    ['Etiqueta', `${v(p.meEtiquetaId)}${p.meImpressaoUrl ? ` · ${link(p.meImpressaoUrl, 'imprimir (logado no ME)')}` : ''}`], ['Comprada em', quando(p.meCompradaEm)],
    ['Rastreio', v(p.rastreio)], ['Postado', quando(p.postadoEm)], ['Entregue', quando(p.entregueEm)], ['Tentativas', String(p.envioTentativas)],
    ...(p.envioErro ? [['Erro', `<span class="erro-envio">${esc(p.envioErro)}</span>`] as [string, string]] : [])]))}
  ${cartao('enviar', 'violeta', 'Acesso ao treinamento', dl([['Aviso', p.acessoStatus === 'DESLIGADO' ? 'desligado: liberar manualmente' : esc(p.acessoStatus.toLowerCase())],
    ['Enviado em', quando(p.acessoEm)], ['Tentativas', String(p.acessoTentativas)], ...(p.acessoErro ? [['Erro', esc(p.acessoErro)] as [string, string]] : []),
    ['Origem', `${v(p.origem)} · ${v(p.midia)} · ${v(p.campanha)} · ${v(p.conteudo)}`]]))}
  </div>
  ${acoes.length ? cartao('clique', 'ambar', 'Ações', `<div class="acoes-p">${acoes.join('')}</div>`) : ''}
  <section class="cartao"><header class="cartao-cab"><div class="tit"><span class="chip t-neutro">${icone('tabela', 'duotone')}</span><div><h2>Histórico</h2><p>Trilha de auditoria: quem fez o quê e quando</p></div></div></header>
  <div class="rolar"><table class="tabela"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>
  ${hist.map((h) => `<tr><td>${quando(h.createdAt)}</td><td>${esc(h.quem)}</td><td>${esc(h.acao)}</td><td class="quebra larga">${v(h.detalhe)}</td></tr>`).join('')}</tbody></table></div></section></div>
  <dialog id="confirmar" aria-labelledby="c-tit" aria-describedby="c-txt"><h2 id="c-tit"></h2><p id="c-txt"></p><p class="c-espera" aria-live="polite"></p>
    <div class="c-bt"><button type="button" class="bt bt-neutro" data-fechar>Voltar</button><button type="button" class="bt bt-primario" data-ok>Confirmar</button></div></dialog>`;

  // Modal de confirmação com bloqueio de 3 s: não fecha com ESC nem clique fora enquanto travado.
  const script = `var d=document.getElementById('confirmar'),bts=d.querySelectorAll('.c-bt button'),esp=d.querySelector('.c-espera'),alvo,trava=false,t;
  document.querySelectorAll('[data-confirmar]').forEach(function(b){b.addEventListener('click',function(){
    alvo=document.getElementById(b.dataset.confirmar);if(!alvo.reportValidity())return;var tx=b.dataset.texto;
    if(b.dataset.campo){var ch=document.getElementById(b.dataset.campo).value.replace(/\\D/g,'');tx+=' Chave terminada em '+ch.slice(-6)+'.'}
    d.querySelector('#c-tit').textContent=b.dataset.titulo;d.querySelector('#c-txt').textContent=tx;
    var n=3;trava=true;bts.forEach(function(x){x.disabled=true});esp.textContent='Leia com atenção: os botões liberam em '+n+' s.';d.showModal();clearInterval(t);
    t=setInterval(function(){n--;if(n>0){esp.textContent='Leia com atenção: os botões liberam em '+n+' s.'}else{clearInterval(t);trava=false;esp.textContent='';bts.forEach(function(x){x.disabled=false});d.querySelector('[data-ok]').focus()}},1000);
  })});
  d.addEventListener('cancel',function(e){if(trava)e.preventDefault()});
  d.addEventListener('close',function(){if(trava)d.showModal()});
  d.querySelector('[data-fechar]').addEventListener('click',function(){if(!trava)d.close()});
  d.querySelector('[data-ok]').addEventListener('click',function(){if(trava)return;bts.forEach(function(x){x.disabled=true});alvo.requestSubmit()});`;
  return pagina(`Pedido ${p.orderNsu}`, corpo, ctx, script);
}

// Situação da nota em texto (o status do pedido já diz se está emitindo ou aguardando).
function situacaoNota(p: Pedido): string {
  if (p.notaChave) return p.notaNumero ? 'autorizada (Bling)' : 'chave informada no painel';
  if (p.status === 'EMITINDO_NOTA') return 'em emissão no Bling';
  if (p.status === 'AGUARDANDO_NOTA') return p.notaErro ? 'com problema (veja o erro)' : 'aguardando a chave';
  return p.envioPrevistoEm ? `sai no dia do envio (${dia(p.envioPrevistoEm)})` : '—';
}

export type Ctx = { usuario: string; tema: Tema };
const ACOES = ['nota', 'enviar-agora', 'tentar', 'tentar-nota', 'reenviar-acesso', 'cancelar'] as const;

async function agir(req: http.IncomingMessage, res: http.ServerResponse, p: Pedido, acao: (typeof ACOES)[number], usuario: string) {
  if (!mesmaOrigem(req)) return fim(res, 403, 'Origem inválida');
  const form = new URLSearchParams((await lerCorpo(req, 2048)) ?? '');
  const quem = `painel:${usuario}`, volta = (q: string) => ir(res, `/painel/pedidos/${p.orderNsu}?${q}`);
  let feito = false;
  if (acao === 'nota') {
    const chave = chaveNfe(form.get('chave') ?? '');
    if (!chave) return volta('erro=chave');
    feito = await pedidos.informarNota(p, chave, quem);
  } else if (acao === 'enviar-agora') feito = await pedidos.enviarAgora(p, quem);
  else if (acao === 'tentar') feito = await pedidos.tentarDeNovo(p, quem);
  else if (acao === 'tentar-nota') feito = await pedidos.tentarNota(p, quem);
  else if (acao === 'reenviar-acesso') feito = await pedidos.reenviarAcesso(p, quem);
  else if ((feito = await pedidos.cancelar(p, quem))) await cancelarNoBling(p, quem);
  console.log(`painel: ${acao} ${p.orderNsu} ${feito ? 'ok' : 'recusada (status mudou)'}`);
  return volta(feito ? `ok=${acao}` : 'erro=estado');
}

// Pedido de venda no Bling vai para "Cancelado" só se a editora configurou o id dessa situação (é por conta).
// A NF-e não: a API v3 não cancela nota; o histórico do cancelamento já avisa para cancelar no Bling.
async function cancelarNoBling(p: Pedido, quem: string) {
  if (!p.blingPedidoId || !BLING.situacaoCanceladoId) return;
  try {
    await cancelarPedidoBling(p.blingPedidoId);
    await pedidos.anotar(p.id, quem, 'pedido cancelado no Bling', `pedido ${p.blingPedidoId}`);
  } catch (e) {
    const msg = e instanceof ErroBling ? e.message : `sem resposta (${(e as Error).name})`;
    console.error(`bling: cancelar pedido de ${p.orderNsu} falhou: ${msg.slice(0, 120)}`);
    await pedidos.anotar(p.id, quem, 'não consegui cancelar o pedido no Bling', `${msg}. Cancele o pedido ${p.blingPedidoId} lá.`);
  }
}

// Chamada pelo server.ts já com a sessão conferida.
export async function rotaPedidos(req: http.IncomingMessage, res: http.ServerResponse, url: URL, ctx: Ctx): Promise<void> {
  const partes = url.pathname.replace(/\/+$/, '').split('/').slice(3); // ['', 'painel', 'pedidos', ...]
  if (req.method === 'GET' && partes.length === 0) return html(res, 200, await lista(url, ctx), req);
  if (req.method === 'GET' && partes[0] === 'exportar.csv' && partes.length === 1) {
    const st = url.searchParams.get('status'), status = ehStatus(st) ? st : null;
    return fim(res, 200, await pedidos.exportarPedidosCsv(status), {
      'Content-Type': 'text/csv; charset=utf-8', ...PRIVADO, 'Content-Disposition': `attachment; filename="pedidos${status ? `_${status.toLowerCase()}` : ''}.csv"`,
    });
  }
  const p = NSU.test(partes[0] ?? '') ? await pedidos.porNsu(partes[0]) : undefined;
  if (!p) return fim(res, 404, 'Pedido não encontrado', PRIVADO);
  if (req.method === 'GET' && partes.length === 1) return html(res, 200, await detalhe(p, url, ctx), req);
  const acao = ACOES.find((a) => a === partes[1]);
  if (req.method === 'POST' && partes.length === 2 && acao) return agir(req, res, p, acao, ctx.usuario);
  return fim(res, 405, 'Método não permitido');
}
