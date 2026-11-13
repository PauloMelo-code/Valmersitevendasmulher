import crypto from 'node:crypto';
import { and, count, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { celulaCsv } from './consultas.ts';
import { db } from './db.ts';
import { paginaVendasPedidos as P, paginaVendasPedidosHistorico as H, STATUS_PEDIDO, type StatusPedido } from './schema.ts';
import type { DadosCompra } from './validar.ts';

// Dados dos pedidos: criação, leitura, transições (sempre condicionais) e trilha de auditoria.
export type Pedido = typeof P.$inferSelect;
export type Historico = typeof H.$inferSelect;

export const NSU = /^LI-[A-Z2-7]{10}$/;
export const PAGOS: StatusPedido[] = ['PAGO', 'EMITINDO_NOTA', 'AGUARDANDO_NOTA', 'COMPRANDO_ETIQUETA', 'ETIQUETA_COMPRADA', 'POSTADO', 'ENTREGUE', 'ERRO_ENVIO'];
export const ANTES_DA_ETIQUETA: StatusPedido[] = ['AGUARDANDO_PAGAMENTO', 'PAGO', 'AGUARDANDO_NOTA', 'ERRO_ENVIO'];
export const ehStatus = (s: string | null): s is StatusPedido => (STATUS_PEDIDO as readonly string[]).includes(s ?? '');
export const reais = (c: number | null) => (c == null ? '' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

// "LI-" + 10 caracteres base32 (50 bits aleatórios): não dá para adivinhar e não carrega dado pessoal.
export function novoNsu(): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  return 'LI-' + [...crypto.randomBytes(10)].map((b) => A[b & 31]).join('');
}

export async function criarPedido(d: DadosCompra & { pagina: string; valorCentavos: number }): Promise<Pedido> {
  return db.transaction(async (tx) => {
    const [p] = await tx.insert(P).values({ ...d, orderNsu: novoNsu(), modifiedBy: 'comprador' }).returning();
    await tx.insert(H).values({ pedidoId: p.id, quem: 'comprador', acao: 'pedido criado', detalhe: `valor ${reais(d.valorCentavos)}`, modifiedBy: 'comprador' });
    return p;
  });
}

export async function porNsu(nsu: string): Promise<Pedido | undefined> {
  if (!NSU.test(nsu)) return undefined;
  const [p] = await db.select().from(P).where(and(eq(P.orderNsu, nsu), eq(P.isDeleted, false)));
  return p;
}

export const em = (...s: StatusPedido[]) => inArray(P.status, s);
export const mais1 = (c: PgColumn) => sql`${c} + 1`;

// Única porta de mudança: UPDATE condicional + linha no histórico na mesma transação.
// false = a condição não valeu (outro processo ou outra tela mudou antes). `acao` null = sem linha no histórico.
export async function mudar(
  id: string, onde: SQL | undefined, set: PgUpdateSetSource<typeof P>, quem: string, acao: string | null, detalhe: string | null = null,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const r = await tx.update(P).set({ ...set, updatedAt: new Date(), modifiedBy: quem })
      .where(and(eq(P.id, id), eq(P.isDeleted, false), onde)).returning({ id: P.id });
    if (!r.length) return false;
    if (acao) await tx.insert(H).values({ pedidoId: id, quem, acao, detalhe, modifiedBy: quem });
    return true;
  });
}

export async function anotar(id: string, quem: string, acao: string, detalhe: string | null = null) {
  await db.insert(H).values({ pedidoId: id, quem, acao, detalhe, modifiedBy: quem });
}

// ---------- ações do painel (quem = painel:<usuario>) ----------
export const informarNota = (p: Pedido, chave: string, quem: string) =>
  mudar(p.id, em('PAGO', 'AGUARDANDO_NOTA'), { notaChave: chave, notaErro: null, status: 'PAGO' }, quem, 'chave da NF-e informada', `chave terminada em ${chave.slice(-6)}`);
export const enviarAgora = (p: Pedido, quem: string) =>
  mudar(p.id, em('PAGO'), { envioPrevistoEm: new Date() }, quem, 'envio antecipado', 'a próxima rodada da rotina compra a etiqueta');
// Item do carrinho não comprado é cancelado pelo ME em 7 dias: depois disso o id não serve mais e a rotina cota de novo.
// Só descarta se a compra nunca foi confirmada (me_comprada_em vazio).
// A retomada automática de COMPRANDO_ETIQUETA (rotina, após 15 min) nunca descarta o id; só este "Tentar de novo" manual.
// ponytail: um checkout que estourou o tempo mas foi cobrado no ME e só é retentado após 7 dias compraria outra; conferir no ME antes.
const DIAS_CARRINHO = 7 * 24 * 3_600_000;
async function carrinhoExpirou(p: Pedido): Promise<boolean> {
  if (!p.meEtiquetaId || p.meCompradaEm) return false;
  const [h] = await db.select({ em: H.createdAt }).from(H).where(and(eq(H.pedidoId, p.id), eq(H.acao, 'etiqueta no carrinho'))).orderBy(desc(H.createdAt)).limit(1);
  return !!h && Date.now() - h.em.getTime() > DIAS_CARRINHO;
}
export async function tentarDeNovo(p: Pedido, quem: string): Promise<boolean> {
  if (await carrinhoExpirou(p)) {
    return mudar(p.id, and(em('ERRO_ENVIO'), eq(P.meEtiquetaId, p.meEtiquetaId!), isNull(P.meCompradaEm)),
      { status: 'PAGO', envioErro: null, meEtiquetaId: null, meServico: null, meFreteCentavos: null }, quem, 'nova tentativa de envio',
      `etiqueta ${p.meEtiquetaId} do carrinho expirou (7 dias sem compra); cotando de novo`);
  }
  return mudar(p.id, em('ERRO_ENVIO'), { status: 'PAGO', envioErro: null }, quem, 'nova tentativa de envio', p.meEtiquetaId ? 'retoma a etiqueta já no carrinho' : null);
}
// AGUARDANDO_NOTA → PAGO: a rotina retoma pelos ids do Bling já gravados (com bling_nfe_id só consulta/transmite, não gera outra).
export const tentarNota = (p: Pedido, quem: string) =>
  mudar(p.id, em('AGUARDANDO_NOTA'), { status: 'PAGO', notaErro: null }, quem, 'nova tentativa da NF-e', p.blingNfeId ? `retoma a nota ${p.blingNfeId} do Bling` : null);
export const reenviarAcesso = (p: Pedido, quem: string) =>
  mudar(p.id, em(...PAGOS), { acessoStatus: 'PENDENTE', acessoTentativas: 0, acessoErro: null }, quem, 'aviso de acesso reenviado');
// Etiqueta já paga (ou talvez paga) fica registrada no histórico: o frete só volta cancelando a etiqueta no Melhor Envio.
export const etiquetaPendente = (p: Pedido) => (p.meCompradaEm ? 'ETIQUETA JÁ PAGA: cancele a etiqueta no Melhor Envio para o frete voltar à carteira'
  : p.meEtiquetaId ? 'havia etiqueta no carrinho do Melhor Envio: confira lá se foi paga e cancele' : '');
// NF-e não se cancela pela API v3: só no painel do Bling, dentro do prazo legal.
export const notaPendente = (p: Pedido) => (p.notaChave ? `NF-e ${p.notaNumero ? `nº ${p.notaNumero} ` : ''}autorizada: cancele no Bling (Vendas > Notas Fiscais de Saída), em até 24 h`
  : p.blingNfeId ? `NF-e ${p.blingNfeId} já foi gerada no Bling e pode ter sido transmitida: confira lá (Vendas > Notas Fiscais de Saída) e, se autorizou, cancele em até 24 h` : '');
export const cancelar = (p: Pedido, quem: string) =>
  mudar(p.id, em(...ANTES_DA_ETIQUETA), { status: 'CANCELADO' }, quem, 'pedido cancelado',
    [`estava ${p.status}; reembolso, se houver, é feito no app da InfinitePay`, etiquetaPendente(p), notaPendente(p)].filter(Boolean).join('; '));

// ---------- consultas do painel ----------
export async function resumoPedidos(): Promise<{ porStatus: Partial<Record<StatusPedido, number>>; somaPaga: number }> {
  const r = await db.select({
    status: P.status, n: count(),
    soma: sql<string>`coalesce(sum(${P.valorPagoCentavos}) filter (where ${P.pagoEm} is not null and ${P.status} <> 'CANCELADO'), 0)`,
  }).from(P).where(eq(P.isDeleted, false)).groupBy(P.status);
  return { porStatus: Object.fromEntries(r.map((l) => [l.status, l.n])), somaPaga: r.reduce((s, l) => s + Number(l.soma), 0) };
}

export const POR_PAGINA = 50;
export async function listarPedidos(status: StatusPedido | null, pagina: number): Promise<{ linhas: Pedido[]; total: number }> {
  const onde = and(eq(P.isDeleted, false), status ? eq(P.status, status) : undefined);
  const [linhas, [{ n }]] = await Promise.all([
    db.select().from(P).where(onde).orderBy(desc(P.createdAt)).limit(POR_PAGINA).offset((pagina - 1) * POR_PAGINA),
    db.select({ n: count() }).from(P).where(onde),
  ]);
  return { linhas, total: n };
}

export const historicoDe = (id: string) =>
  db.select().from(H).where(and(eq(H.pedidoId, id), eq(H.isDeleted, false))).orderBy(desc(H.createdAt), desc(H.id));

const COLUNAS: [string, (p: Pedido) => unknown][] = [
  ['pedido', (p) => p.orderNsu], ['criado_em', (p) => p.createdAt.toISOString()], ['status', (p) => p.status], ['pagina', (p) => p.pagina],
  ['nome', (p) => p.nome], ['email', (p) => p.email], ['telefone', (p) => p.telefone], ['cpf', (p) => p.cpf],
  ['cep', (p) => p.cep], ['rua', (p) => p.rua], ['numero', (p) => p.numero], ['complemento', (p) => p.complemento],
  ['bairro', (p) => p.bairro], ['cidade', (p) => p.cidade], ['uf', (p) => p.uf],
  ['valor', (p) => (p.valorCentavos / 100).toFixed(2).replace('.', ',')], ['valor_pago', (p) => p.valorPagoCentavos == null ? '' : (p.valorPagoCentavos / 100).toFixed(2).replace('.', ',')],
  ['metodo', (p) => p.metodo], ['parcelas', (p) => p.parcelas], ['pago_em', (p) => p.pagoEm?.toISOString()],
  ['envio_previsto_em', (p) => p.envioPrevistoEm?.toISOString()], ['nota_chave', (p) => p.notaChave], ['nota_numero', (p) => p.notaNumero], ['rastreio', (p) => p.rastreio],
  ['acesso', (p) => p.acessoStatus], ['origem', (p) => p.origem], ['midia', (p) => p.midia], ['campanha', (p) => p.campanha], ['conjunto', (p) => p.conjunto], ['conteudo', (p) => p.conteudo],
];
export async function exportarPedidosCsv(status: StatusPedido | null): Promise<string> {
  const linhas = await db.select().from(P).where(and(eq(P.isDeleted, false), status ? eq(P.status, status) : undefined)).orderBy(P.createdAt).limit(50000);
  const corpo = linhas.map((p) => COLUNAS.map(([, f]) => celulaCsv(f(p))).join(';'));
  return '﻿' + [COLUNAS.map(([c]) => c).join(';'), ...corpo].join('\r\n') + '\r\n';
}
