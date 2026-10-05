import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { carregarPainel, exportarCsv } from './consultas.ts';
import { migrar, salvarEvento } from './db.ts';
import { lerEvento } from './evento.ts';
import { lerFiltro } from './filtros.ts';
import { COOKIE_TEMA, lerTema } from './tema.ts';
import { renderLogin } from './login.ts';
import { renderPainel } from './painel.ts';
import { bloqueado, chaveDe, COOKIE, credenciaisOk, criarSessao, lerCookie, registrarFalha, sessaoValida } from './sessao.ts';

const PORT = Number(process.env.PORT ?? 3000);
const SITE_URL = (process.env.SITE_URL ?? `http://localhost:${PORT}`).replace(/\/+$/, '');
const PIXEL = process.env.META_PIXEL_ID ?? '';
const CHECKOUT = process.env.CHECKOUT_URL ?? '';
const USUARIO = process.env.PAINEL_USUARIO ?? 'admin';
const SENHA = process.env.PAINEL_SENHA ?? '';

if (!/^https?:\/\/[^/\s]+$/.test(SITE_URL)) throw new Error('SITE_URL inválida (ex.: https://lideranca.seudominio.com.br)');
if (PIXEL && !/^\d{5,20}$/.test(PIXEL)) throw new Error('META_PIXEL_ID deve ter só números');
if (CHECKOUT && !/^https:\/\/\S+$/.test(CHECKOUT)) throw new Error('CHECKOUT_URL deve começar com https://');
if (SENHA.length < 12) console.warn('PAINEL_SENHA ausente ou com menos de 12 caracteres: /painel desligado.');
const HOST = new URL(SITE_URL).host;

const pixel = PIXEL ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');</script>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${PIXEL}&ev=PageView&noscript=1"></noscript>` : '';

const preencher = (t: string) => t
  .replaceAll('{{SITE_URL}}', SITE_URL)
  .replaceAll('{{CHECKOUT_URL}}', JSON.stringify(CHECKOUT).slice(1, -1).replaceAll('<', '\\u003c'))
  .replace('<!--PIXEL-->', pixel);

// Tudo de public/ fica em memória (≈1 MB): sem leitura de disco por request e sem path traversal.
type Arquivo = { corpo: Buffer; gz?: Buffer; tipo: string; cache: string };
const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.jpg': 'image/jpeg',
};
const arquivos = new Map<string, Arquivo>();
function registrar(rota: string, corpo: Buffer, ext: string, cache = 'public, max-age=300') {
  const texto = !ext.startsWith('.jpg');
  arquivos.set(rota, { corpo, gz: texto ? zlib.gzipSync(corpo) : undefined, tipo: TIPOS[ext], cache });
}
const PUB = path.join(import.meta.dirname, '..', 'public');
for (const rel of fs.readdirSync(PUB, { recursive: true }) as string[]) {
  const abs = path.join(PUB, rel), ext = path.extname(rel);
  if (!TIPOS[ext] || fs.statSync(abs).isDirectory()) continue;
  const rota = '/' + rel.split(path.sep).join('/');
  if (ext === '.jpg') registrar(rota, fs.readFileSync(abs), ext, 'public, max-age=604800');
  else registrar(rota, Buffer.from(preencher(fs.readFileSync(abs, 'utf8'))), ext);
}
const hoje = new Date().toISOString().slice(0, 10);
registrar('/robots.txt', Buffer.from(`User-agent: *\nAllow: /\nDisallow: /painel\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`), '.txt');
registrar('/sitemap.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${hoje}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>\n`), '.xml');

const SEGURANCA = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };

function enviar(req: http.IncomingMessage, res: http.ServerResponse, a: Arquivo) {
  const gzip = a.gz && /\bgzip\b/.test(String(req.headers['accept-encoding']));
  const corpo = gzip ? a.gz! : a.corpo;
  res.writeHead(200, {
    ...SEGURANCA, 'Content-Type': a.tipo, 'Cache-Control': a.cache, 'Content-Length': corpo.length,
    ...(a.gz ? { Vary: 'Accept-Encoding' } : {}), ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
  });
  res.end(req.method === 'HEAD' ? undefined : corpo);
}

function fim(res: http.ServerResponse, status: number, corpo = '', extra: Record<string, string> = {}) {
  res.writeHead(status, { ...SEGURANCA, 'Content-Type': 'text/plain; charset=utf-8', ...extra });
  res.end(corpo);
}

const CHAVE = chaveDe(USUARIO, SENHA);
const SECURE = SITE_URL.startsWith('https://') ? '; Secure' : '';
const logado = (req: http.IncomingMessage) => SENHA.length >= 12 && sessaoValida(lerCookie(req.headers.cookie, COOKIE), CHAVE);
// CSRF: POST do painel só aceita Origin do próprio host (navegadores sempre mandam Origin em POST de formulário).
function mesmaOrigem(req: http.IncomingMessage): boolean {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}
const PRIVADO = { 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex' };
// HTML do painel tem SVG inline (≈125 KB): comprime quando o navegador aceita.
function html(res: http.ServerResponse, status: number, corpo: string, req?: http.IncomingMessage) {
  const gz = req && /\bgzip\b/.test(String(req.headers['accept-encoding']));
  res.writeHead(status, { ...SEGURANCA, 'Content-Type': 'text/html; charset=utf-8', ...PRIVADO, Vary: 'Accept-Encoding', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
  res.end(gz ? zlib.gzipSync(corpo) : corpo);
}
const ir = (res: http.ServerResponse, para: string, extra: Record<string, string> = {}) => fim(res, 303, '', { Location: para, ...PRIVADO, ...extra });

async function entrar(req: http.IncomingMessage, res: http.ServerResponse) {
  if (!mesmaOrigem(req)) return fim(res, 403, 'Origem inválida');
  if (SENHA.length < 12) return html(res, 503, renderLogin({ desligado: true }));
  const form = new URLSearchParams((await lerCorpo(req, 2048)) ?? '');
  const usuario = (form.get('usuario') ?? '').trim().slice(0, 100);
  if (bloqueado()) {
    console.warn('painel: login bloqueado por excesso de tentativas');
    return html(res, 429, renderLogin({ usuario, erro: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.' }));
  }
  if (!credenciaisOk(usuario, form.get('senha') ?? '', USUARIO, SENHA)) {
    registrarFalha();
    console.warn('painel: login recusado');
    return html(res, 401, renderLogin({ usuario, erro: 'Usuário ou senha incorretos.' }));
  }
  console.log('painel: login ok');
  ir(res, '/painel', { 'Set-Cookie': `${COOKIE}=${criarSessao(CHAVE)}; Path=/painel; HttpOnly; SameSite=Lax; Max-Age=604800${SECURE}` });
}

function lerCorpo(req: http.IncomingMessage, limite: number): Promise<string | null> {
  return new Promise((ok) => {
    let tam = 0; const partes: Buffer[] = [];
    req.on('data', (c: Buffer) => { tam += c.length; if (tam > limite) { ok(null); req.destroy(); } else partes.push(c); });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', () => ok(null));
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname === '/api/evento' && req.method === 'POST') {
      const corpo = await lerCorpo(req, 4096);
      const ev = corpo && lerEvento(corpo, String(req.headers['user-agent'] ?? ''), HOST);
      if (ev) await salvarEvento(ev).catch((e) => console.error('evento:', e.message));
      return fim(res, 204);
    }
    if (url.pathname === '/painel/entrar' && req.method === 'POST') return await entrar(req, res);
    if (url.pathname === '/painel/sair' && req.method === 'POST') {
      if (!mesmaOrigem(req)) return fim(res, 403, 'Origem inválida');
      return ir(res, '/painel/entrar', { 'Set-Cookie': `${COOKIE}=; Path=/painel; HttpOnly; SameSite=Lax; Max-Age=0${SECURE}` });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return fim(res, 405, 'Método não permitido');
    if (url.pathname === '/saude') return fim(res, 200, 'ok');
    if (url.pathname === '/painel/entrar') {
      if (logado(req)) return ir(res, '/painel');
      return html(res, SENHA.length < 12 ? 503 : 200, renderLogin({ desligado: SENHA.length < 12 }));
    }
    if (url.pathname === '/painel' || url.pathname === '/painel/') {
      if (!logado(req)) return ir(res, '/painel/entrar');
      const f = lerFiltro(url.searchParams);
      return html(res, 200, renderPainel(await carregarPainel(f), f, { usuario: USUARIO, tema: lerTema(lerCookie(req.headers.cookie, COOKIE_TEMA)) }), req);
    }
    if (url.pathname === '/painel/exportar.csv') {
      if (!logado(req)) return ir(res, '/painel/entrar');
      const f = lerFiltro(url.searchParams);
      return fim(res, 200, await exportarCsv(f), {
        'Content-Type': 'text/csv; charset=utf-8', ...PRIVADO,
        'Content-Disposition': `attachment; filename="eventos_${f.de}_a_${f.ate}.csv"`,
      });
    }
    const a = arquivos.get(url.pathname === '/' ? '/index.html' : url.pathname);
    if (!a) return fim(res, 404, 'Página não encontrada');
    enviar(req, res, a);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) fim(res, 500, 'Erro interno');
  }
});

await migrar();
server.listen(PORT, () => console.log(`Página no ar em ${SITE_URL} (porta ${PORT})`));
