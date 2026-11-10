import { opcional, URL_API } from './ambiente.ts';

// Melhor Envio (https://docs.melhorenvio.com.br): cotação → carrinho → compra (debita a carteira) → geração → impressão.
// Token gerado no painel do ME (env). Nada aqui grava no banco: quem orquestra e garante "comprar uma vez só" é a rotina.

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const AMBIENTE = opcional('MELHOR_ENVIO_AMBIENTE', /^(producao|sandbox)$/, 'deve ser producao ou sandbox') || 'producao';
export const MELHOR_ENVIO = {
  token: opcional('MELHOR_ENVIO_TOKEN', /^\S{20,}$/, 'deve ser o token gerado no painel do Melhor Envio', true),
  email: opcional('MELHOR_ENVIO_EMAIL', EMAIL, 'deve ser um e-mail') || 'editorasignature@gmail.com',
  base: (opcional('MELHOR_ENVIO_API_URL', URL_API, 'deve ser https:// (ou http://127.0.0.1 em teste local)')
    || (AMBIENTE === 'sandbox' ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br')).replace(/\/+$/, ''),
  modo: (opcional('ENVIO_MODO', /^(nota|declaracao)$/, 'deve ser nota ou declaracao') || 'nota') as 'nota' | 'declaracao',
  servicos: (opcional('ENVIO_SERVICOS', /^\d{1,4}(,\d{1,4})*$/, 'deve ser ids de serviço separados por vírgula (ex.: 1,2)') || '1,2').split(',').map(Number),
};
export type ConfigME = typeof MELHOR_ENVIO;

// Remetente = Editora Signature Ltda (PJ com IE no PR).
const REMETENTE = {
  name: 'Editora Signature Ltda', phone: '4488556073', email: 'editorasignature@gmail.com',
  company_document: '66911358000184', state_register: '9123226450',
  address: 'Rua Néo Alves Martins', number: '2789', complement: 'Sala 103/104', district: 'Zona 01',
  city: 'Maringá', state_abbr: 'PR', postal_code: '87013060', country_id: 'BR',
};
// Livro: 15 × 23 × 2 cm, 0,336 kg (cadastro real da loja). Correios: 1 volume por inserção.
const LIVRO = { width: 15, height: 2, length: 23, weight: 0.336 };

export type PedidoEnvio = {
  orderNsu: string; valorCentavos: number; nome: string; email: string; telefone: string; cpf: string;
  cep: string; rua: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string; notaChave: string | null;
};

export const cabecalhos = (cfg: ConfigME) => ({
  Accept: 'application/json', 'Content-Type': 'application/json',
  Authorization: `Bearer ${cfg.token}`, 'User-Agent': `Pagina Lideranca Inteligente (${cfg.email})`,
});

export const corpoCotacao = (p: PedidoEnvio) => ({
  from: { postal_code: REMETENTE.postal_code }, to: { postal_code: p.cep },
  products: [{ id: 'livro', ...LIVRO, insurance_value: p.valorCentavos / 100, quantity: 1 }],
});

// Mais barato entre os serviços permitidos; ignora os que voltam com `error`.
export function escolherServico(cotacao: unknown, permitidos: number[]): { servico: number; freteCentavos: number; prazo: number | null } | null {
  if (!Array.isArray(cotacao)) return null;
  let melhor: { servico: number; freteCentavos: number; prazo: number | null } | null = null;
  for (const c of cotacao as Record<string, unknown>[]) {
    if (!c || c.error || !permitidos.includes(Number(c.id))) continue;
    const preco = Number(c.custom_price ?? c.price);
    if (!Number.isFinite(preco) || preco <= 0) continue;
    const frete = Math.round(preco * 100), prazo = Number(c.custom_delivery_time ?? c.delivery_time) || null;
    if (!melhor || frete < melhor.freteCentavos) melhor = { servico: Number(c.id), freteCentavos: frete, prazo };
  }
  return melhor;
}

export function corpoCarrinho(cfg: ConfigME, p: PedidoEnvio, servico: number) {
  const nota = cfg.modo === 'nota', valor = p.valorCentavos / 100;
  return {
    service: servico,
    from: { ...REMETENTE, state_register: nota ? REMETENTE.state_register : 'ISENTO' },
    to: {
      name: p.nome, phone: p.telefone, email: p.email, document: p.cpf,
      address: p.rua, number: p.numero, complement: p.complemento ?? '', district: p.bairro,
      city: p.cidade, state_abbr: p.uf, postal_code: p.cep, country_id: 'BR',
    },
    products: [{ name: 'Livro Liderança Inteligente', quantity: 1, unitary_value: valor }],
    volumes: [{ height: LIVRO.height, width: LIVRO.width, length: LIVRO.length, weight: LIVRO.weight }],
    options: {
      insurance_value: valor, receipt: false, own_hand: false, reverse: false, non_commercial: !nota,
      ...(nota ? { invoice: { key: p.notaChave } } : {}),
      platform: 'Pagina Lideranca Inteligente', tags: [{ tag: p.orderNsu, url: null }],
    },
  };
}

// Erro legível para o painel. Mensagens da API citam o campo, não o valor; mesmo assim, cortadas.
export class ErroME extends Error {
  status: number;
  constructor(msg: string, status = 0) { super(msg); this.status = status; }
}
function legivel(status: number, body: unknown): string {
  if (status === 401) return 'Token do Melhor Envio inválido ou vencido: gere outro no painel do Melhor Envio e atualize MELHOR_ENVIO_TOKEN.';
  const o = (body ?? {}) as { message?: unknown; error?: unknown; errors?: Record<string, unknown> };
  const detalhes = Object.values(o.errors ?? {}).flat().slice(0, 3).map(String);
  return [`Melhor Envio respondeu ${status}`, String(o.message ?? o.error ?? ''), ...detalhes].filter(Boolean).join(' · ').slice(0, 300);
}

async function chamar(cfg: ConfigME, caminho: string, corpo: unknown): Promise<{ status: number; body: unknown }> {
  const r = await fetch(`${cfg.base}/api/v2/me${caminho}`, {
    method: 'POST', headers: cabecalhos(cfg), body: JSON.stringify(corpo), signal: AbortSignal.timeout(20_000),
  });
  const body = await r.json().catch(() => null);
  if (r.status === 401 || (body as { message?: string } | null)?.message === 'Unauthenticated.') throw new ErroME(legivel(401, body), 401);
  return { status: r.status, body };
}
async function ok(cfg: ConfigME, caminho: string, corpo: unknown): Promise<unknown> {
  const r = await chamar(cfg, caminho, corpo);
  if (r.status < 200 || r.status > 299) throw new ErroME(legivel(r.status, r.body), r.status);
  return r.body;
}

export async function cotar(cfg: ConfigME, p: PedidoEnvio) {
  const escolhido = escolherServico(await ok(cfg, '/shipment/calculate', corpoCotacao(p)), cfg.servicos);
  if (!escolhido) throw new ErroME(`Nenhum dos serviços permitidos (${cfg.servicos.join(', ')}) atende este CEP.`);
  return escolhido;
}

export async function inserirCarrinho(cfg: ConfigME, p: PedidoEnvio, servico: number): Promise<string> {
  const id = ((await ok(cfg, '/cart', corpoCarrinho(cfg, p, servico))) as { id?: unknown } | null)?.id;
  if (typeof id !== 'string' || !id) throw new ErroME('Melhor Envio não devolveu o id da etiqueta no carrinho.');
  return id;
}

// Compra com a carteira. Pedido já pago volta 422 com errors.orders: é o "já comprado", segue o fluxo.
export async function comprar(cfg: ConfigME, id: string): Promise<'comprada' | 'ja_comprada'> {
  const r = await chamar(cfg, '/shipment/checkout', { orders: [id] });
  if (r.status >= 200 && r.status < 300) return 'comprada';
  if (r.status === 422 && (r.body as { errors?: { orders?: unknown } } | null)?.errors?.orders) return 'ja_comprada';
  throw new ErroME(legivel(r.status, r.body), r.status);
}

export const gerar = (cfg: ConfigME, id: string) => ok(cfg, '/shipment/generate', { orders: [id] });

export async function imprimir(cfg: ConfigME, id: string): Promise<string> {
  const url = ((await ok(cfg, '/shipment/print', { mode: 'private', orders: [id] })) as { url?: unknown } | null)?.url;
  if (typeof url !== 'string' || !/^https?:\/\/\S+$/.test(url)) throw new ErroME('Melhor Envio não devolveu o link de impressão.');
  return url;
}

export type Rastreio = { status?: string; tracking?: string | null; posted_at?: string | null; delivered_at?: string | null };
export async function rastrear(cfg: ConfigME, ids: string[]): Promise<Record<string, Rastreio>> {
  return ((await ok(cfg, '/shipment/tracking', { orders: ids })) ?? {}) as Record<string, Rastreio>;
}
