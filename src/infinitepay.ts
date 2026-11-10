import { env, opcional, SITE_URL, URL_API } from './ambiente.ts';

// Checkout Integrado da InfinitePay (https://www.infinitepay.io/checkout-documentacao). Sem API key:
// o handle identifica a conta, e só o payment_check confirma pagamento (o webhook não tem assinatura).

// Aceita a InfiniteTag como aparece no app ("$EditoraSignature"): tira o $ e os espaços e põe em minúsculas.
export function lerHandle(bruto: string): string {
  const h = bruto.replace(/\s+/g, '').replace(/^\$/, '').toLowerCase();
  if (!h || /^[a-z0-9_.-]{2,40}$/.test(h)) return h;
  console.warn(`INFINITEPAY_HANDLE ignorada: recebi ${JSON.stringify(bruto)}, mas deve ser a InfiniteTag da conta (ex.: editorasignature). O site sobe sem ela.`);
  return '';
}

export const INFINITEPAY = {
  handle: lerHandle(env('INFINITEPAY_HANDLE')),
  base: (opcional('INFINITEPAY_API_URL', URL_API, 'deve ser https:// (ou http://127.0.0.1 em teste local)') || 'https://api.checkout.infinitepay.io').replace(/\/+$/, ''),
  precoCentavos: Number(opcional('PRECO_CENTAVOS', /^[1-9]\d{2,6}$/, 'deve ser o preço em centavos, mínimo 100 (ex.: 9700)') || 9700),
  descricao: opcional('PRODUTO_DESCRICAO', /^[^<>]{3,200}$/, 'deve ter de 3 a 200 caracteres, sem < >')
    || 'Liderança Inteligente: livro físico + treinamento Líder na Prática + 3 materiais',
  site: SITE_URL,
};
export type ConfigIP = typeof INFINITEPAY;

type PedidoLink = {
  orderNsu: string; valorCentavos: number; nome: string; email: string; telefone: string;
  cep: string; rua: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string;
};

export function corpoLink(cfg: ConfigIP, p: PedidoLink) {
  return {
    handle: cfg.handle,
    items: [{ quantity: 1, price: p.valorCentavos, description: cfg.descricao }],
    order_nsu: p.orderNsu,
    redirect_url: `${cfg.site}/obrigado`,
    webhook_url: `${cfg.site}/api/infinitepay/webhook`,
    customer: { name: p.nome, email: p.email, phone_number: `+55${p.telefone}` },
    address: { cep: p.cep, street: p.rua, number: p.numero, neighborhood: p.bairro, city: p.cidade, state: p.uf, complement: p.complemento ?? '' },
  };
}

// A doc não mostra o JSON da resposta: aceita `url` ou `payment_url`; sem nenhum, é erro.
export function urlDoLink(body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const u = b.url ?? b.payment_url;
  if (typeof u !== 'string' || !/^https:\/\/\S+$/.test(u)) throw new Error('InfinitePay não devolveu o link de pagamento (sem url/payment_url)');
  return u;
}

// Comprovante só de domínio da InfinitePay: o link vira "abrir" no painel e não pode servir de isca (phishing).
export function reciboOk(u: unknown): u is string {
  if (typeof u !== 'string' || u.length > 500) return false;
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === 'https:' && (hostname === 'infinitepay.io' || hostname.endsWith('.infinitepay.io'));
  } catch { return false; }
}

export type Checagem = { success?: unknown; paid?: unknown; amount?: unknown; paid_amount?: unknown; installments?: unknown; capture_method?: unknown; order_nsu?: unknown };
// paid_amount pode ser MAIOR que amount (juros do parcelado): o que vale é amount === valor do pedido.
export function regraConfirmacao(r: Checagem, valorCentavos: number): 'pago' | 'divergente' | 'pendente' {
  if (r.success !== true || r.paid !== true) return 'pendente';
  return r.amount != null && r.amount !== '' && Number(r.amount) === valorCentavos ? 'pago' : 'divergente';
}

// Mensagem curta para log/erro, sem eco de dado pessoal (só código/mensagem da API).
const motivo = (b: unknown) => {
  const o = (b ?? {}) as Record<string, unknown>;
  return String(o.error ?? o.message ?? o.code ?? '').replace(/[^\w .:/-]/g, '').slice(0, 120) || 'sem detalhe';
};

async function post(cfg: ConfigIP, caminho: string, corpo: unknown): Promise<unknown> {
  const r = await fetch(`${cfg.base}${caminho}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corpo), signal: AbortSignal.timeout(10_000),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const m = motivo(body);
    const dica = m.includes('external_checkout_not_enabled') ? ' (o Checkout Integrado não está habilitado nesta conta: falar com a InfinitePay)' : '';
    throw new Error(`InfinitePay ${caminho} respondeu ${r.status}: ${m}${dica}`);
  }
  return body;
}

export async function criarLink(cfg: ConfigIP, p: PedidoLink): Promise<string> {
  const body = await post(cfg, '/links', corpoLink(cfg, p));
  // Primeiro uso: registra só o formato da resposta (nomes dos campos), nunca os valores.
  console.log(`infinitepay /links ${p.orderNsu}: campos da resposta = ${Object.keys((body ?? {}) as object).join(',')}`);
  return urlDoLink(body);
}

export async function checarPagamento(cfg: ConfigIP, a: { orderNsu: string; transactionNsu: string; slug: string }): Promise<Checagem> {
  return (await post(cfg, '/payment_check', { handle: cfg.handle, order_nsu: a.orderNsu, transaction_nsu: a.transactionNsu, slug: a.slug })) as Checagem;
}
