import crypto from 'node:crypto';
import { opcional, URL_API } from './ambiente.ts';

// Aviso de compra aprovada à plataforma Líder de Impacto (libera as 10 aulas). Corpo assinado com HMAC-SHA256;
// o x-evento-id (= order_nsu) deixa o lado de lá ignorar repetição.

export const LIDER = {
  url: opcional('LIDER_WEBHOOK_URL', URL_API, 'deve ser um link https://'),
  segredo: opcional('LIDER_WEBHOOK_SEGREDO', /^\S{32,}$/, 'deve ter 32 caracteres ou mais, sem espaço', true),
};
export type ConfigLider = typeof LIDER;
export const liderLigado = (cfg: ConfigLider) => !!cfg.url && !!cfg.segredo;

export const assinatura = (segredo: string, corpo: string) => `sha256=${crypto.createHmac('sha256', segredo).update(corpo).digest('hex')}`;

// Conferência em tempo constante (usada pelo teste e pronta para o lado da plataforma copiar).
export function assinaturaOk(segredo: string, corpo: string, recebida: string): boolean {
  const a = Buffer.from(assinatura(segredo, corpo)), b = Buffer.from(recebida);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type Compra = {
  orderNsu: string; valorCentavos: number; pagoEm: Date | null;
  nome: string; email: string; cpf: string; telefone: string;
};

export function corpoAviso(p: Compra): string {
  return JSON.stringify({
    id: p.orderNsu, evento: 'compra_aprovada', produto: 'lideranca-inteligente', valor_centavos: p.valorCentavos,
    pago_em: p.pagoEm?.toISOString() ?? null, comprador: { nome: p.nome, email: p.email, cpf: p.cpf, telefone: p.telefone },
  });
}

// Devolve '' se a plataforma aceitou (2xx) ou a mensagem do erro (sem dado pessoal).
export async function avisarLider(cfg: ConfigLider, p: Compra): Promise<string> {
  const corpo = corpoAviso(p);
  try {
    const r = await fetch(cfg.url, {
      method: 'POST', body: corpo, signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json', 'x-assinatura': assinatura(cfg.segredo, corpo), 'x-evento-id': p.orderNsu },
    });
    await r.arrayBuffer().catch(() => null);
    return r.ok ? '' : `plataforma respondeu ${r.status}`;
  } catch (e) {
    return `sem resposta da plataforma (${(e as Error).name})`;
  }
}
