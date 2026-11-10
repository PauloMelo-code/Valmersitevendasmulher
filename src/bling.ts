import crypto from 'node:crypto';
import { opcional, URL_API } from './ambiente.ts';

// Bling API v3 (NF-e da Editora Signature): configuração, cifra dos tokens, state do OAuth, corpos e leitura das respostas.
// Nada aqui toca o banco (os testes de unidade importam sem DATABASE_URL); tokens guardados e chamadas autenticadas: bling-conta.ts.

const ID = /^\d{1,15}$/;
const id = (nome: string) => opcional(nome, ID, 'deve ser o id numérico do Bling');
export const BLING = {
  clientId: opcional('BLING_CLIENT_ID', /^[\w-]{8,100}$/, 'deve ser o Client ID do app no Bling'),
  clientSecret: opcional('BLING_CLIENT_SECRET', /^\S{16,200}$/, 'deve ser o Client Secret do app no Bling', true),
  sku: opcional('BLING_SKU', /^[^\s<>"']{1,60}$/, 'deve ser o código (SKU) do livro no Bling, sem espaço'),
  formaPagamentoId: id('BLING_FORMA_PAGAMENTO_ID'),
  lojaId: id('BLING_LOJA_ID'),
  naturezaId: id('BLING_NATUREZA_ID'),
  situacaoCanceladoId: id('BLING_SITUACAO_CANCELADO_ID'),
  enviarEmail: (opcional('BLING_ENVIAR_EMAIL', /^(sim|nao)$/, 'deve ser sim ou nao') || 'sim') === 'sim',
  // Só para teste local (como MELHOR_ENVIO_API_URL): a rota do token fica em `${base}/oauth/token`.
  base: (opcional('BLING_API_URL', URL_API, 'deve ser https:// (ou http://127.0.0.1 em teste local)') || 'https://api.bling.com.br/Api/v3').replace(/\/+$/, ''),
  autorizar: 'https://www.bling.com.br/Api/v3/oauth/authorize',
  intervaloMs: 350, // limite do Bling: 3 req/s por conta
};
export type ConfigBling = typeof BLING;
// Configurado = dá para emitir quando a conta estiver autorizada (a autorização mora no banco).
export const blingConfigurado = (c: ConfigBling = BLING) => !!(c.clientId && c.clientSecret && c.sku && c.formaPagamentoId);
export const FALTAM = (c: ConfigBling = BLING) => ([['BLING_CLIENT_ID', c.clientId], ['BLING_CLIENT_SECRET', c.clientSecret], ['BLING_SKU', c.sku],
  ['BLING_FORMA_PAGAMENTO_ID', c.formaPagamentoId]] as const).filter(([, v]) => !v).map(([n]) => n);

// ---------- cifra dos tokens: AES-256-GCM, chave = HKDF-SHA256 do client secret, AAD = nome da integração ----------
const chaveTokens = (segredo: string) => Buffer.from(crypto.hkdfSync('sha256', segredo, '', 'pagina-vendas:bling-tokens:v1', 32));
export function cifrar(segredo: string, aad: string, texto: string): string {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', chaveTokens(segredo), iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return ['v1', iv, c.getAuthTag(), ct].map((x) => (typeof x === 'string' ? x : x.toString('base64url'))).join('.');
}
// Lança se a cifra foi adulterada, a AAD não bate ou o client secret mudou.
export function decifrar(segredo: string, aad: string, cifra: string): string {
  const [v, iv, tag, ct] = cifra.split('.');
  const bIv = Buffer.from(iv ?? '', 'base64url'), bTag = Buffer.from(tag ?? '', 'base64url');
  // Tag fixa em 16 bytes: o Node aceitaria tag truncada (até 4 bytes) e a autenticação cairia para 32 bits.
  if (v !== 'v1' || bIv.length !== 12 || bTag.length !== 16 || ct == null) throw new Error('cifra em formato desconhecido');
  const d = crypto.createDecipheriv('aes-256-gcm', chaveTokens(segredo), bIv, { authTagLength: 16 });
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(bTag);
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

// ---------- state do OAuth: "<expira ms>.<nonce>.<mac>", o mac cobre também a sessão do painel (que não viaja) ----------
const VALIDADE_ESTADO = 10 * 60_000;
const macEstado = (segredo: string, corpo: string, sessao: string) =>
  crypto.createHmac('sha256', Buffer.from(crypto.hkdfSync('sha256', segredo, '', 'pagina-vendas:bling-state:v1', 32))).update(`${corpo}|${sessao}`).digest('base64url');
export function assinarEstado(segredo: string, sessao: string, agora = Date.now()): string {
  const corpo = `${agora + VALIDADE_ESTADO}.${crypto.randomBytes(12).toString('base64url')}`;
  return `${corpo}.${macEstado(segredo, corpo, sessao)}`;
}
export function estadoValido(segredo: string, estado: string, sessao: string, agora = Date.now()): boolean {
  const m = /^(\d{13})\.([\w-]{16})\.([\w-]{43})$/.exec(estado);
  if (!m) return false;
  const a = Buffer.from(m[3]), b = Buffer.from(macEstado(segredo, `${m[1]}.${m[2]}`, sessao));
  return a.length === b.length && crypto.timingSafeEqual(a, b) && Number(m[1]) > agora;
}
export const urlAutorizar = (c: ConfigBling, estado: string) =>
  `${c.autorizar}?${new URLSearchParams({ response_type: 'code', client_id: c.clientId, state: estado })}`;

// ---------- erros ----------
// `temporario` = rede, timeout, 429, 5xx: a rotina tenta de novo. O resto (400, 403, 404, sem autorização) vai para o painel.
export class ErroBling extends Error {
  status: number; temporario: boolean;
  constructor(msg: string, status = 0, temporario = false) { super(msg); this.status = status; this.temporario = temporario; }
}
// Mensagens do Bling podem citar o valor do campo: corta números longos e e-mails antes de ir para log/histórico.
const semDados = (s: string) => s.replace(/\S+@\S+/g, '…').replace(/\d[\d.\-/]{7,}\d/g, '…');
export function legivel(status: number, body: unknown): string {
  const e = ((body ?? {}) as { error?: { type?: unknown; message?: unknown; description?: unknown; fields?: { msg?: unknown; collection?: { msg?: unknown }[] }[] } }).error;
  if (status === 403) return semDados(`Falta escopo no app do Bling (${String(e?.description ?? e?.message ?? 'acesso negado')}): marque o escopo no app e reautorize em /painel/bling.`).slice(0, 400);
  const campos = (e?.fields ?? []).flatMap((f) => [f.msg, ...(f.collection ?? []).map((c) => c.msg)]).filter(Boolean).slice(0, 4).map(String);
  const txt = [String(e?.description || e?.message || ''), ...campos].filter(Boolean).join(' · ');
  return semDados(`Bling respondeu ${status}${txt ? `: ${txt}` : ''}`).slice(0, 400);
}

// ---------- HTTP ----------
// ponytail: espaçamento por processo; com 2 containers o teto pode passar de 3 req/s e o 429 vira erro temporário.
let proxima = 0;
async function espacar(c: ConfigBling) {
  const agora = Date.now(), vez = Math.max(agora, proxima);
  proxima = vez + c.intervaloMs;
  if (vez > agora) await new Promise((ok) => setTimeout(ok, vez - agora));
}

export type Resposta = { status: number; body: unknown };
export async function requisitar(c: ConfigBling, token: string, metodo: string, caminho: string, corpo?: unknown): Promise<Resposta> {
  await espacar(c);
  try {
    const r = await fetch(`${c.base}${caminho}`, {
      method: metodo, signal: AbortSignal.timeout(10_000), body: corpo === undefined ? undefined : JSON.stringify(corpo),
      headers: { Authorization: `Bearer ${token}`, 'enable-jwt': '1', Accept: 'application/json', ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    });
    const texto = await r.text();
    let body: unknown = null;
    try { body = texto ? JSON.parse(texto) : null; } catch { /* corpo não-JSON: fica null */ }
    return { status: r.status, body };
  } catch (e) {
    throw new ErroBling(`Sem resposta do Bling (${(e as Error).name})`, 0, true);
  }
}

export type Tokens = { access: string; refresh: string; expiraEm: Date };
// POST /oauth/token (Basic client_id:secret, form-urlencoded, enable-jwt). 400/401/403 = recusado (code vencido, refresh inválido).
export async function pedirToken(c: ConfigBling, corpo: Record<string, string>, agora = new Date()): Promise<{ ok: true; tokens: Tokens } | { ok: false; motivo: string }> {
  await espacar(c);
  let r: Response;
  try {
    r = await fetch(`${c.base}/oauth/token`, {
      method: 'POST', body: new URLSearchParams(corpo).toString(), signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'enable-jwt': '1',
        Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}` },
    });
  } catch (e) {
    throw new ErroBling(`Sem resposta do Bling ao pedir token (${(e as Error).name})`, 0, true);
  }
  const j = (await r.json().catch(() => null)) as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; error?: unknown } | null;
  if ([400, 401, 403].includes(r.status)) {
    const tipo = typeof j?.error === 'string' ? j.error : (j?.error as { type?: unknown } | undefined)?.type;
    return { ok: false, motivo: `O Bling recusou o token (${r.status}${typeof tipo === 'string' ? ` ${tipo.slice(0, 40)}` : ''}).` };
  }
  if (!r.ok || typeof j?.access_token !== 'string' || !j.access_token) throw new ErroBling(`Bling /oauth/token respondeu ${r.status}`, r.status, true);
  const seg = typeof j.expires_in === 'number' && j.expires_in > 0 ? j.expires_in : 21_600;
  return { ok: true, tokens: { access: j.access_token, refresh: typeof j.refresh_token === 'string' ? j.refresh_token : '', expiraEm: new Date(agora.getTime() + seg * 1000) } };
}

// ---------- corpos e leituras ----------
export type PedidoNota = {
  orderNsu: string; valorCentavos: number; nome: string; email: string; telefone: string; cpf: string; metodo: string | null; pagoEm: Date | null;
  cep: string; rua: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string;
};
export type Produto = { id: number; nome: string; preco: number | null };

const cepFmt = (s: string) => s.replace(/^(\d{5})(\d{3})$/, '$1-$2');
// Data no fuso de São Paulo (o Bling quer AAAA-MM-DD da operação no Brasil).
export const diaSP = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);

export const corpoContato = (p: PedidoNota) => ({
  nome: p.nome, tipo: 'F', situacao: 'A', numeroDocumento: p.cpf, email: p.email, celular: p.telefone, indicadorIe: 9,
  endereco: { geral: { endereco: p.rua, numero: p.numero, complemento: p.complemento ?? '', bairro: p.bairro, cep: cepFmt(p.cep), municipio: p.cidade, uf: p.uf } },
});

export function corpoPedido(c: ConfigBling, p: PedidoNota, contatoId: string, produto: Produto, agora = new Date()) {
  const hoje = diaSP(agora), valor = p.valorCentavos / 100;
  return {
    contato: { id: Number(contatoId), nome: p.nome },
    data: hoje, dataSaida: hoje, dataPrevista: hoje,
    numeroLoja: p.orderNsu,
    ...(c.lojaId ? { loja: { id: Number(c.lojaId) } } : {}),
    itens: [{
      produto: { id: produto.id }, codigo: c.sku, descricao: produto.nome, quantidade: 1, valor,
      ...(c.naturezaId ? { naturezaOperacao: { id: Number(c.naturezaId) } } : {}),
    }],
    // Valor do pedido, não o paid_amount: os juros do parcelado ficam com a InfinitePay.
    parcelas: [{ dataVencimento: diaSP(p.pagoEm ?? agora), valor, formaPagamento: { id: Number(c.formaPagamentoId) } }],
    transporte: {
      fretePorConta: 0, frete: 0, // remetente paga (CIF), frete grátis para o comprador
      etiqueta: { nome: p.nome, endereco: p.rua, numero: p.numero, complemento: p.complemento ?? '', municipio: p.cidade, uf: p.uf, cep: cepFmt(p.cep), bairro: p.bairro, nomePais: 'Brasil' },
    },
    observacoes: `Pedido ${p.orderNsu} da página de vendas · pago via InfinitePay (${p.metodo ?? 'método não informado'})`,
  };
}

const dados = (b: unknown) => ((b as { data?: unknown } | null)?.data ?? b) as unknown;
const idDe = (v: unknown) => (typeof v === 'number' && v > 0 ? String(v) : typeof v === 'string' && /^\d{1,20}$/.test(v) ? v : null);
export const primeiroId = (b: unknown) => { const l = dados(b); return Array.isArray(l) ? idDe((l[0] as { id?: unknown } | undefined)?.id) : null; };
export const idCriado = (b: unknown) => idDe((dados(b) as { id?: unknown } | null)?.id);
// gerar-nfe: o spec mostra { idNotaFiscal } na raiz, as outras rotas usam { data }. Aceita os dois.
export const idNotaGerada = (b: unknown) => idDe((dados(b) as { idNotaFiscal?: unknown } | null)?.idNotaFiscal);
export const notaDoPedido = (b: unknown) => idDe((dados(b) as { notaFiscal?: { id?: unknown } } | null)?.notaFiscal?.id);
export function lerProduto(b: unknown): Produto | null {
  const l = dados(b), x = (Array.isArray(l) ? l[0] : null) as { id?: unknown; nome?: unknown; preco?: unknown } | null;
  const pid = idDe(x?.id);
  return pid ? { id: Number(pid), nome: String(x?.nome ?? '').slice(0, 120), preco: typeof x?.preco === 'number' ? x.preco : null } : null;
}
export type NotaLida = { situacao: number; numero: string | null; chave: string | null; danfe: string | null };
export function lerNota(b: unknown): NotaLida {
  const d = (dados(b) ?? {}) as { situacao?: unknown; numero?: unknown; chaveAcesso?: unknown; linkDanfe?: unknown };
  const s = (v: unknown, max: number) => (typeof v === 'string' && v ? v.slice(0, max) : typeof v === 'number' ? String(v) : null);
  const danfe = s(d.linkDanfe, 800);
  return { situacao: Number(d.situacao), numero: s(d.numero, 20), chave: s(d.chaveAcesso, 60), danfe: danfe && /^https:\/\/\S+$/.test(danfe) ? danfe : null };
}

// Situação da NF-e em /nfe (tabela 1-11; NÃO é a de contas a receber).
export type Desfecho = 'autorizada' | 'pendente' | 'recusada' | 'cancelada';
export const SITUACOES_NFE: Record<number, [string, Desfecho]> = {
  1: ['Pendente', 'pendente'], 2: ['Cancelada', 'cancelada'], 3: ['Aguardando recibo', 'pendente'], 4: ['Rejeitada', 'recusada'],
  5: ['Autorizada', 'autorizada'], 6: ['Emitida DANFE', 'autorizada'], 7: ['Registrada', 'autorizada'], 8: ['Aguardando protocolo', 'pendente'],
  9: ['Denegada', 'recusada'], 10: ['Consulta situação', 'pendente'], 11: ['Bloqueada', 'recusada'],
};
export const situacaoNfe = (n: number): [string, Desfecho] => SITUACOES_NFE[n] ?? [`situação ${n}`, 'pendente'];
