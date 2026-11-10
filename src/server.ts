import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { EMPRESA, env, opcional, PIXEL_TAG, PORT, SITE_URL } from './ambiente.ts';
import { rotaCheckout } from './checkout.ts';
import { carregarPainel, exportarCsv } from './consultas.ts';
import { erroSemDados, migrar, salvarEvento } from './db.ts';
import { lerEvento } from './evento.ts';
import { lerFiltro } from './filtros.ts';
import { fim, html, ir, lerCorpo, mesmaOrigem, PRIVADO, SEGURANCA } from './http.ts';
import { INFINITEPAY } from './infinitepay.ts';
import { NOME_PAGINA, PAGINA } from './pagina.ts';
import { COOKIE_TEMA, lerTema } from './tema.ts';
import { renderLogin } from './login.ts';
import { renderPainel } from './painel.ts';
import { rotaPedidos } from './painel-pedidos.ts';
import { rotaBling } from './painel-bling.ts';
import { iniciarRotina } from './rotina.ts';
import { bloqueado, chaveDe, COOKIE, credenciaisOk, criarSessao, lerCookie, registrarFalha, sessaoValida } from './sessao.ts';

// Checkout próprio ligado (INFINITEPAY_HANDLE) tem precedência: os botões .js-checkout vão para /comprar.
const CHECKOUT = INFINITEPAY.handle ? `${SITE_URL}/comprar` : opcional('CHECKOUT_URL', /^https:\/\/\S+$/, 'deve ser um link começando com https://');
const USUARIO = env('PAINEL_USUARIO', 'admin');
const SENHA = env('PAINEL_SENHA');

if (SENHA.length < 12) console.warn('PAINEL_SENHA ausente ou com menos de 12 caracteres: /painel desligado.');
const HOST = new URL(SITE_URL).host;

// Dados do vendedor no rodapé e em /privacidade; escapados porque viram HTML.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const preencher = (t: string) => t
  .replaceAll('{{SITE_URL}}', SITE_URL)
  .replaceAll('{{CHECKOUT_URL}}', JSON.stringify(CHECKOUT).slice(1, -1).replaceAll('<', '\\u003c'))
  .replaceAll('{{EMPRESA_RAZAO}}', esc(EMPRESA.RAZAO))
  .replaceAll('{{EMPRESA_CNPJ}}', esc(EMPRESA.CNPJ))
  .replaceAll('{{EMPRESA_ENDERECO}}', esc(EMPRESA.ENDERECO))
  .replaceAll('{{CONTATO_EMAIL}}', esc(EMPRESA.CONTATO))
  .replace('<!--PIXEL-->', PIXEL_TAG);

// Tudo de public/ fica em memória (≈1 MB): sem leitura de disco por request e sem path traversal.
type Arquivo = { corpo: Buffer; gz?: Buffer; tipo: string; cache: string };
const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};
const BINARIOS = new Set(['.jpg', '.png', '.webp']);
const arquivos = new Map<string, Arquivo>();
function registrar(rota: string, corpo: Buffer, ext: string, cache = 'public, max-age=300') {
  const texto = !BINARIOS.has(ext);
  arquivos.set(rota, { corpo, gz: texto ? zlib.gzipSync(corpo) : undefined, tipo: TIPOS[ext], cache });
}
function carregarPasta(pasta: string) {
  const base = path.join(import.meta.dirname, '..', pasta);
  for (const rel of fs.readdirSync(base, { recursive: true }) as string[]) {
    const abs = path.join(base, rel), ext = path.extname(rel);
    if (!TIPOS[ext] || fs.statSync(abs).isDirectory()) continue;
    const rota = '/' + rel.split(path.sep).join('/');
    if (BINARIOS.has(ext)) registrar(rota, fs.readFileSync(abs), ext, 'public, max-age=604800');
    else registrar(rota, Buffer.from(preencher(fs.readFileSync(abs, 'utf8'))), ext);
  }
}
// public/ tem o que é comum (privacidade, consentimento, rastreio) e a página das mulheres;
// a pasta da página escolhida em PAGINA sobrepõe index.html, llms.txt e imagens.
carregarPasta('public');
if (PAGINA.pasta) carregarPasta(PAGINA.pasta);
// Endereço sem ".html" para a política (é o que vai no rodapé, no banner e no cadastro da Meta).
arquivos.set('/privacidade', arquivos.get('/privacidade.html')!);
const hoje = new Date().toISOString().slice(0, 10);
registrar('/robots.txt', Buffer.from(`User-agent: *\nAllow: /\nDisallow: /painel\nDisallow: /api/\nDisallow: /comprar\nDisallow: /obrigado\n\nSitemap: ${SITE_URL}/sitemap.xml\n`), '.txt');
registrar('/sitemap.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${hoje}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE_URL}/privacidade</loc><lastmod>${hoje}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
</urlset>\n`), '.xml');

function enviar(req: http.IncomingMessage, res: http.ServerResponse, a: Arquivo) {
  const gzip = a.gz && /\bgzip\b/.test(String(req.headers['accept-encoding']));
  const corpo = gzip ? a.gz! : a.corpo;
  res.writeHead(200, {
    ...SEGURANCA, 'Content-Type': a.tipo, 'Cache-Control': a.cache, 'Content-Length': corpo.length,
    ...(a.gz ? { Vary: 'Accept-Encoding' } : {}), ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
  });
  res.end(req.method === 'HEAD' ? undefined : corpo);
}

const CHAVE = chaveDe(USUARIO, SENHA);
const SECURE = SITE_URL.startsWith('https://') ? '; Secure' : '';
const logado = (req: http.IncomingMessage) => SENHA.length >= 12 && sessaoValida(lerCookie(req.headers.cookie, COOKIE), CHAVE);
const tema = (req: http.IncomingMessage) => lerTema(lerCookie(req.headers.cookie, COOKIE_TEMA));

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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname === '/api/evento' && req.method === 'POST') {
      const corpo = await lerCorpo(req, 4096);
      const ev = corpo && lerEvento(corpo, String(req.headers['user-agent'] ?? ''), HOST);
      if (ev) await salvarEvento({ ...ev, pagina: NOME_PAGINA }).catch((e) => console.error('evento:', erroSemDados(e)));
      return fim(res, 204);
    }
    if (await rotaCheckout(req, res, url)) return;
    if (url.pathname === '/painel/pedidos' || url.pathname.startsWith('/painel/pedidos/')) {
      if (!logado(req)) return req.method === 'GET' ? ir(res, '/painel/entrar') : fim(res, 403, 'Sessão expirada', PRIVADO);
      return await rotaPedidos(req, res, url, { usuario: USUARIO, tema: tema(req) });
    }
    if (url.pathname === '/painel/bling' || url.pathname.startsWith('/painel/bling/')) {
      if (!logado(req)) return req.method === 'GET' ? ir(res, '/painel/entrar') : fim(res, 403, 'Sessão expirada', PRIVADO);
      return await rotaBling(req, res, url, { usuario: USUARIO, tema: tema(req), sessao: lerCookie(req.headers.cookie, COOKIE) ?? '' });
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
      return html(res, 200, renderPainel(await carregarPainel(f), f, { usuario: USUARIO, tema: tema(req) }), req);
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
    console.error(`erro interno em ${req.method} ${(req.url ?? '').split('?')[0]}:`, erroSemDados(e));
    if (!res.headersSent) fim(res, 500, 'Erro interno');
  }
});

await migrar();
iniciarRotina();
server.listen(PORT, () => console.log(`Página no ar em ${SITE_URL} (porta ${PORT}) · ${PAGINA.nome}${INFINITEPAY.handle ? ' · checkout próprio ligado' : ''}`));
