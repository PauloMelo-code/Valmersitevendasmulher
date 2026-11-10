import { and, eq } from 'drizzle-orm';
import * as B from './bling.ts';
import { db } from './db.ts';
import { paginaVendasIntegracoes as I } from './schema.ts';

// Conta do Bling autorizada (tokens cifrados no banco) e as chamadas autenticadas usadas pela rotina e pelo painel.
// Nunca loga token nem dado do comprador.

const NOME = 'bling';
const FOLGA = 5 * 60_000, DIA = 24 * 3_600_000;
export const MSG_AUTORIZAR = 'O Bling não está autorizado: conecte em Painel > Bling e depois use "Tentar de novo" (ou cole a chave da NF-e).';
const vivo = and(eq(I.nome, NOME), eq(I.isDeleted, false));

export type Conta = typeof I.$inferSelect;
export const conta = async (): Promise<Conta | undefined> => (await db.select().from(I).where(vivo))[0];
export const autorizada = async () => (await conta())?.situacao === 'AUTORIZADA';

export async function salvarTokens(t: B.Tokens, quem: string, refreshExpiraEm = new Date(Date.now() + 30 * DIA)) {
  const s = B.BLING.clientSecret, agora = new Date();
  const v = {
    accessTokenCifrado: B.cifrar(s, NOME, t.access), refreshTokenCifrado: B.cifrar(s, NOME, t.refresh), expiraEm: t.expiraEm, refreshExpiraEm,
    situacao: 'AUTORIZADA' as const, erro: null, updatedAt: agora, modifiedBy: quem, isDeleted: false, deletedAt: null,
  };
  await db.insert(I).values({ nome: NOME, ...v }).onConflictDoUpdate({ target: I.nome, set: v });
}

// Retorno do OAuth: troca o code (vale 30 s) pelos tokens.
export async function conectar(code: string, quem: string): Promise<void> {
  const r = await B.pedirToken(B.BLING, { grant_type: 'authorization_code', code });
  if (!r.ok) throw new B.ErroBling(`${r.motivo} Confira o client secret e clique de novo em Conectar.`);
  if (!r.tokens.refresh) throw new B.ErroBling('O Bling não devolveu o refresh token. Clique de novo em Conectar.');
  await salvarTokens(r.tokens, quem);
  console.log(`bling: conta autorizada por ${quem}`);
}

async function marcarReautorizar(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], erro: string) {
  await tx.update(I).set({ situacao: 'REAUTORIZAR', erro, updatedAt: new Date(), modifiedBy: 'sistema' }).where(vivo);
  console.error(`bling: precisa reautorizar (${erro})`);
}

// Access token válido. Renova com menos de 5 min, quando `recusado` é o token atual (401) ou com `forcar`.
// A linha fica travada (FOR UPDATE) durante a renovação: os 2 containers não renovam juntos (o refresh pode ser rotacionado).
export async function tokenDeAcesso(recusado?: string, forcar = false): Promise<string> {
  const r = await db.transaction(async (tx): Promise<{ access: string } | { erro: string }> => {
    const [l] = await tx.select().from(I).where(vivo).for('update');
    if (!l || l.situacao !== 'AUTORIZADA' || !l.accessTokenCifrado || !l.refreshTokenCifrado) return { erro: MSG_AUTORIZAR };
    let access: string, refresh: string;
    try {
      access = B.decifrar(B.BLING.clientSecret, NOME, l.accessTokenCifrado);
      refresh = B.decifrar(B.BLING.clientSecret, NOME, l.refreshTokenCifrado);
    } catch {
      await marcarReautorizar(tx, 'tokens ilegíveis (o BLING_CLIENT_SECRET mudou?)');
      return { erro: MSG_AUTORIZAR };
    }
    const agora = new Date();
    // Token recusado que já não é o atual = outro processo renovou: usa o novo.
    const expirando = !l.expiraEm || l.expiraEm.getTime() - FOLGA <= agora.getTime();
    if (!forcar && !expirando && access !== recusado) return { access };
    const novo = await B.pedirToken(B.BLING, { grant_type: 'refresh_token', refresh_token: refresh }, agora);
    if (!novo.ok) {
      await marcarReautorizar(tx, `renovação recusada: ${novo.motivo}`);
      return { erro: MSG_AUTORIZAR };
    }
    // Sem refresh novo na resposta = o antigo continua valendo.
    const rotacionou = !!novo.tokens.refresh;
    await tx.update(I).set({
      accessTokenCifrado: B.cifrar(B.BLING.clientSecret, NOME, novo.tokens.access), expiraEm: novo.tokens.expiraEm,
      ...(rotacionou ? { refreshTokenCifrado: B.cifrar(B.BLING.clientSecret, NOME, novo.tokens.refresh), refreshExpiraEm: new Date(agora.getTime() + 30 * DIA) } : {}),
      erro: null, updatedAt: agora, modifiedBy: 'sistema',
    }).where(vivo);
    return { access: novo.tokens.access };
  });
  if ('erro' in r) throw new B.ErroBling(r.erro, 401);
  return r.access;
}

// O refresh vale ~30 dias: a rotina renova 1x por dia mesmo sem venda, para a conexão não morrer.
export async function renovarDiario(): Promise<void> {
  if (!B.blingConfigurado()) return;
  const c = await conta();
  if (c?.situacao === 'AUTORIZADA' && Date.now() - c.updatedAt.getTime() > DIA) await tokenDeAcesso(undefined, true);
}

// Chamada autenticada: 401 renova e tenta 1 vez; 429/5xx/rede = temporário; o resto vira mensagem legível.
export async function api(metodo: string, caminho: string, corpo?: unknown): Promise<unknown> {
  let token = await tokenDeAcesso();
  for (let tentativa = 0; ; tentativa++) {
    const r = await B.requisitar(B.BLING, token, metodo, caminho, corpo);
    if (r.status >= 200 && r.status < 300) return r.body;
    if (r.status === 401 && tentativa === 0) { token = await tokenDeAcesso(token); continue; }
    if (r.status === 401) throw new B.ErroBling(MSG_AUTORIZAR, 401);
    throw new B.ErroBling(B.legivel(r.status, r.body), r.status, r.status === 429 || r.status >= 500);
  }
}

const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
const exigir = (id: string | null, oque: string) => { if (!id) throw new B.ErroBling(`O Bling não devolveu o id do ${oque}.`); return id; };

// ponytail: id do produto em memória por processo; trocar o produto no Bling pede reiniciar (ou mudar o BLING_SKU).
let produtoCache: B.Produto | null = null;
export async function produto(): Promise<B.Produto> {
  if (produtoCache) return produtoCache;
  const p = B.lerProduto(await api('GET', `/produtos?${q({ 'codigos[]': B.BLING.sku })}`));
  if (!p) throw new B.ErroBling(`SKU ${B.BLING.sku} não encontrado no Bling: confira o BLING_SKU (código do livro em Produtos).`);
  return (produtoCache = p);
}

export const acharContato = async (cpf: string) => B.primeiroId(await api('GET', `/contatos?${q({ numeroDocumento: cpf })}`));
export const criarContato = async (p: B.PedidoNota) => exigir(B.idCriado(await api('POST', '/contatos', B.corpoContato(p))), 'contato');
export const acharPedido = async (nsu: string) => B.primeiroId(await api('GET', `/pedidos/vendas?${q({ 'numerosLojas[]': nsu })}`));
export const criarPedido = async (corpo: unknown) => exigir(B.idCriado(await api('POST', '/pedidos/vendas', corpo)), 'pedido de venda');

export const notaDoPedido = async (pedidoId: string) => B.notaDoPedido(await api('GET', `/pedidos/vendas/${pedidoId}`));
// Pedido que já tem nota: o gerar-nfe recusa (400) e o id sai do próprio pedido.
export async function gerarNfe(pedidoId: string): Promise<string> {
  try {
    return exigir(B.idNotaGerada(await api('POST', `/pedidos/vendas/${pedidoId}/gerar-nfe`)), 'NF-e');
  } catch (e) {
    if (!(e instanceof B.ErroBling) || e.status !== 400) throw e;
    const ja = await notaDoPedido(pedidoId);
    if (ja) return ja;
    throw e;
  }
}
export const enviarNfe = (id: string) => api('POST', `/nfe/${id}/enviar?enviarEmail=${B.BLING.enviarEmail}`);
export const consultarNfe = async (id: string) => B.lerNota(await api('GET', `/nfe/${id}`));
export const cancelarPedidoBling = (id: string) => api('PATCH', `/pedidos/vendas/${id}/situacoes/${B.BLING.situacaoCanceladoId}`);
