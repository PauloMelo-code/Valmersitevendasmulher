import type http from 'node:http';
import zlib from 'node:zlib';

// Respostas e leitura de corpo compartilhadas pelas rotas (site, checkout e painel).
export const SEGURANCA = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
export const PRIVADO = { 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex' };

export function fim(res: http.ServerResponse, status: number, corpo = '', extra: Record<string, string> = {}) {
  res.writeHead(status, { ...SEGURANCA, 'Content-Type': 'text/plain; charset=utf-8', ...extra });
  res.end(corpo);
}

// HTML do painel tem SVG inline (≈125 KB): comprime quando o navegador aceita.
export function html(res: http.ServerResponse, status: number, corpo: string, req?: http.IncomingMessage) {
  const gz = req && /\bgzip\b/.test(String(req.headers['accept-encoding']));
  res.writeHead(status, { ...SEGURANCA, 'Content-Type': 'text/html; charset=utf-8', ...PRIVADO, Vary: 'Accept-Encoding', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
  res.end(gz ? zlib.gzipSync(corpo) : corpo);
}

export const ir = (res: http.ServerResponse, para: string, extra: Record<string, string> = {}) => fim(res, 303, '', { Location: para, ...PRIVADO, ...extra });

// CSRF: POST só aceita Origin do próprio host (navegadores sempre mandam Origin em POST de formulário).
export function mesmaOrigem(req: http.IncomingMessage): boolean {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}

export function lerCorpo(req: http.IncomingMessage, limite: number): Promise<string | null> {
  return new Promise((ok) => {
    let tam = 0; const partes: Buffer[] = [];
    req.on('data', (c: Buffer) => { tam += c.length; if (tam > limite) { ok(null); req.destroy(); } else partes.push(c); });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', () => ok(null));
  });
}
