// Valida o que o navegador manda para /api/evento. Tudo aqui vem de fora: desconfiar.

const TIPOS = ['view', 'scroll', 'click', 'sair'] as const;
type Tipo = (typeof TIPOS)[number];

export type Evento = {
  tipo: Tipo;
  visitante: string;
  valor: number | null;
  detalhe: string | null;
  origem: string;
  campanha: string | null;
  midia: string | null;
  conteudo: string | null;
  dispositivo: 'celular' | 'tablet' | 'computador';
  sistema: string;
};

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|pingdom|uptime/i;

function texto(v: unknown, max = 120): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  return s || null;
}

function hostDe(url: string | null): string | null {
  if (!url) return null;
  // l.instagram.com, lm.facebook.com, m.facebook.com... viram instagram.com / facebook.com
  try { return new URL(url).host.replace(/^(www|m|l|lm)\./, '') || null; } catch { return null; }
}

export function dispositivoDe(ua: string): Evento['dispositivo'] {
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'celular';
  return 'computador';
}

export function sistemaDe(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux|CrOS/i.test(ua)) return 'Linux';
  return 'Outro';
}

export function lerEvento(corpo: string, ua: string, hostProprio: string): Evento | null {
  if (!ua || BOT.test(ua)) return null;
  let d: Record<string, unknown>;
  try { d = JSON.parse(corpo); } catch { return null; }
  if (!d || typeof d !== 'object') return null;

  const tipo = d.t as Tipo;
  if (!TIPOS.includes(tipo)) return null;
  const visitante = typeof d.v === 'string' && /^[a-z0-9]{6,40}$/.test(d.v) ? d.v : null;
  if (!visitante) return null;

  let valor: number | null = null;
  if (tipo === 'scroll') {
    if (![25, 50, 75, 100].includes(d.n as number)) return null;
    valor = d.n as number;
  } else if (tipo === 'sair') {
    if (!Number.isInteger(d.n) || (d.n as number) < 0) return null;
    valor = Math.min(d.n as number, 86400);
  }

  const ref = hostDe(texto(d.r, 500));
  const origem = texto(d.o, 60)?.toLowerCase() ?? (ref && ref !== hostProprio.replace(/^www\./, '') ? ref : 'direto');

  return {
    tipo,
    visitante,
    valor,
    detalhe: tipo === 'click' ? texto(d.b, 80) : null,
    origem,
    campanha: texto(d.c),
    midia: texto(d.m, 60),
    conteudo: texto(d.a),
    dispositivo: dispositivoDe(ua),
    sistema: sistemaDe(ua),
  };
}
