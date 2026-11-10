import type http from 'node:http';
import { SITE_URL } from './ambiente.ts';
import * as B from './bling.ts';
import * as BC from './bling-conta.ts';
import { esc } from './graficos.ts';
import { fim, html, ir, lerCorpo, mesmaOrigem } from './http.ts';
import { icone } from './icones.ts';
import { MELHOR_ENVIO } from './melhorenvio.ts';
import { pagina, type Ctx } from './painel-pedidos.ts';

// /painel/bling: conexão OAuth com o Bling da editora e conferência dos ids que vão no Easypanel.

const ESCOPOS = ['Contatos', 'Produtos', 'Pedidos de Venda', 'Notas Fiscais Eletrônicas', 'Naturezas de Operação', 'Formas de pagamento', 'Lojas (canais de venda)', 'Situações'];
const RETORNO = `${SITE_URL}/painel/bling/retorno`;
const dia = (d: Date | null) => (d ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(d) : '—');
const MSG: Record<string, [boolean, string]> = {
  conectado: [true, 'Conta do Bling autorizada. A partir da próxima rodada a NF-e sai pelo Bling no dia do envio.'],
  config: [false, 'Faltam BLING_CLIENT_ID e BLING_CLIENT_SECRET no Easypanel.'],
  estado: [false, 'Autorização vencida ou de outra sessão. Clique de novo em "Conectar ao Bling".'],
  negado: [false, 'A autorização foi recusada no Bling. Nada mudou.'],
  code: [false, 'O Bling voltou sem o código de autorização. Clique de novo em "Conectar ao Bling".'],
};

const secao = (titulo: string, corpo: string, desc = '') => `<section class="cartao"><header class="cartao-cab"><div class="tit"><span class="chip t-violeta">${icone('conexao', 'duotone')}</span><div><h2>${titulo}</h2>${desc ? `<p>${desc}</p>` : ''}</div></div></header><div class="corpo">${corpo}</div></section>`;
const tabela = (linhas: [string, string, boolean][]) => (linhas.length
  ? `<div class="rolar"><table class="tabela"><thead><tr><th>Id</th><th>Descrição</th><th></th></tr></thead><tbody>${linhas.map(([i, d, on]) =>
    `<tr><td class="num">${esc(i)}</td><td>${esc(d)}</td><td>${on ? '<span class="etiqueta t-verde">configurado</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`
  : '<div class="vazio-mini">Nenhum cadastro encontrado.</div>');

// Uma chamada por bloco, sem cache. 403 = falta o escopo no app (mostra qual), o resto vira a mensagem do Bling.
async function bloco(escopo: string, ler: () => Promise<string>): Promise<string> {
  try { return await ler(); } catch (e) {
    const msg = e instanceof B.ErroBling ? (e.status === 403 ? `Falta o escopo "${escopo}" no app do Bling: marque e reautorize.` : e.message) : `Falha (${(e as Error).name})`;
    return `<p class="msg erro">${icone('alerta')}${esc(msg)}</p>`;
  }
}
type Item = { id?: unknown; descricao?: unknown; nome?: unknown };
const itens = (b: unknown) => (((b as { data?: unknown } | null)?.data ?? []) as Item[]).filter((x) => x && x.id != null).slice(0, 50);
const linhas = (b: unknown, cfg: string) => itens(b).map((x) => [String(x.id), String(x.descricao ?? x.nome ?? ''), String(x.id) === cfg] as [string, string, boolean]);

async function conferencia(): Promise<string> {
  const c = B.BLING;
  const produto = await bloco('Produtos', async () => {
    if (!c.sku) return '<p>Defina o BLING_SKU (código do livro no Bling).</p>';
    const p = B.lerProduto(await BC.api('GET', `/produtos?${new URLSearchParams({ 'codigos[]': c.sku })}`));
    return p ? `<dl class="dados"><dt>SKU</dt><dd>${esc(c.sku)}</dd><dt>Id</dt><dd>${p.id}</dd><dt>Nome</dt><dd>${esc(p.nome)}</dd><dt>Preço</dt><dd>${p.preco == null ? '—' : esc(p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</dd></dl>`
      : `<p class="msg erro">${icone('alerta')}SKU ${esc(c.sku)} não encontrado no Bling.</p>`;
  });
  const formas = await bloco('Formas de pagamento', async () => tabela(linhas(await BC.api('GET', '/formas-pagamentos?situacao=1'), c.formaPagamentoId)));
  // Não existe GET /lojas na API v3: as lojas são os canais de venda.
  const lojas = await bloco('Lojas (canais de venda)', async () => tabela(linhas(await BC.api('GET', '/canais-venda'), c.lojaId)));
  const naturezas = await bloco('Naturezas de Operação', async () => tabela(linhas(await BC.api('GET', '/naturezas-operacoes?situacao=1'), c.naturezaId)));
  return [secao('Produto do BLING_SKU', produto), secao('Formas de pagamento (BLING_FORMA_PAGAMENTO_ID)', formas),
    secao('Lojas (BLING_LOJA_ID, opcional)', lojas), secao('Naturezas de operação ativas (BLING_NATUREZA_ID, opcional)', naturezas, 'Vazio = o Bling aplica a natureza padrão de venda')].join('');
}

async function tela(url: URL, ctx: Ctx, erro = ''): Promise<string> {
  const c = B.BLING, conta = await BC.conta();
  const [ok, txt] = MSG[url.searchParams.get('ok') ?? url.searchParams.get('erro') ?? ''] ?? [false, ''];
  const aviso = erro || txt ? `<p class="msg ${ok && !erro ? 'ok' : 'erro'}" role="${ok && !erro ? 'status' : 'alert'}">${icone(ok && !erro ? 'ok' : 'alerta')}${esc(erro || txt)}</p>` : '';
  const faltam = B.FALTAM(c);
  const estado = !conta ? ['neutro', 'Não conectado'] : conta.situacao !== 'AUTORIZADA' ? ['rosa', 'Precisa reautorizar']
    : faltam.length ? ['ambar', 'Autorizada, mas desligada: faltam variáveis (NF-e manual, conexão sem renovação)']
    : ['verde', `Autorizado · conexão vale até ${dia(conta.refreshExpiraEm)} (renovada todo dia pela rotina)`];
  const podeConectar = !!(c.clientId && c.clientSecret);
  const status = `<dl class="dados"><dt>Conexão</dt><dd><span class="etiqueta t-${estado[0]}">${estado[1]}</span></dd>
    ${conta?.situacao === 'REAUTORIZAR' ? `<dt>Motivo</dt><dd class="erro-envio">${esc(conta.erro ?? '')}. Os pedidos ficam em "Aguardando nota" até reautorizar.</dd>` : ''}
    <dt>Variáveis</dt><dd>${faltam.length ? `<span class="erro-envio">faltam ${faltam.join(', ')}</span>` : 'completas'}</dd>
    <dt>Envio</dt><dd>${MELHOR_ENVIO.modo === 'declaracao' ? 'ENVIO_MODO=declaracao: o Bling não é usado' : 'modo nota: NF-e no dia do envio, antes da etiqueta'}</dd>
    <dt>E-mail do DANFE</dt><dd>${c.enviarEmail ? 'o Bling manda ao comprador' : 'desligado (BLING_ENVIAR_EMAIL=nao)'}</dd></dl>
    ${podeConectar ? `<form method="post" action="/painel/bling/conectar" style="margin-top:16px"><button class="bt bt-primario">${icone('conexao')}${conta ? 'Reautorizar no Bling' : 'Conectar ao Bling'}</button></form>` : ''}`;
  const cadastro = `<p>No app próprio da página no Bling (separado do app da plataforma), cadastre:</p>
    <dl class="dados"><dt>Redirecionamento</dt><dd><code>${esc(RETORNO)}</code></dd><dt>Escopos</dt><dd>${ESCOPOS.join(' · ')}</dd></dl>
    ${conta && podeConectar ? '<p class="c-espera">Mudar escopos no app revoga a autorização: depois, clique em "Reautorizar no Bling".</p>' : ''}`;
  const corpo = `<div class="cabecalho"><div class="cab-esq"><span class="chip lg t-violeta">${icone('nota', 'duotone')}</span><div>
    <h1>Bling · NF-e</h1><p>Emissão automática da nota pelo Bling da Editora Signature</p></div></div></div>
    <div class="pilha">${aviso}<div class="g-det">${secao('Conexão', status)}${secao('Cadastro do app no Bling', cadastro)}</div>
    ${conta?.situacao === 'AUTORIZADA' && podeConectar ? await conferencia() : ''}</div>`;
  return pagina('Bling', corpo, ctx, '', 'bling');
}

// Chamada pelo server.ts já com a sessão conferida; `sessao` é o cookie do painel (o state do OAuth fica preso a ele).
export async function rotaBling(req: http.IncomingMessage, res: http.ServerResponse, url: URL, ctx: Ctx & { sessao: string }): Promise<void> {
  const rota = url.pathname.replace(/\/+$/, ''), c = B.BLING;
  if (req.method === 'GET' && rota === '/painel/bling') return html(res, 200, await tela(url, ctx), req);
  if (req.method === 'POST' && rota === '/painel/bling/conectar') {
    if (!mesmaOrigem(req)) return fim(res, 403, 'Origem inválida');
    await lerCorpo(req, 512);
    if (!c.clientId || !c.clientSecret) return ir(res, '/painel/bling?erro=config');
    console.log(`bling: autorização iniciada por painel:${ctx.usuario}`);
    return ir(res, B.urlAutorizar(c, B.assinarEstado(c.clientSecret, ctx.sessao)));
  }
  if (req.method === 'GET' && rota === '/painel/bling/retorno') {
    if (url.searchParams.get('error')) return ir(res, '/painel/bling?erro=negado');
    if (!c.clientSecret || !B.estadoValido(c.clientSecret, url.searchParams.get('state') ?? '', ctx.sessao)) return ir(res, '/painel/bling?erro=estado');
    const code = url.searchParams.get('code') ?? '';
    if (!/^[\w.~-]{4,512}$/.test(code)) return ir(res, '/painel/bling?erro=code');
    try {
      await BC.conectar(code, `painel:${ctx.usuario}`);
    } catch (e) {
      const msg = e instanceof B.ErroBling ? e.message : `Falha ao falar com o Bling (${(e as Error).name})`;
      console.error(`bling: troca do code falhou: ${msg.slice(0, 120)}`);
      return html(res, 200, await tela(new URL('/painel/bling', SITE_URL), ctx, msg), req);
    }
    return ir(res, '/painel/bling?ok=conectado');
  }
  return fim(res, 405, 'Método não permitido');
}
