import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { chaveNfe } from '../src/validar.ts';

// Fluxo de ponta a ponta contra o Postgres local e servidores falsos de InfinitePay, Melhor Envio e Líder de Impacto.
// Sem DATABASE_URL, pula (os testes de unidade continuam rodando).
const pular = process.env.DATABASE_URL ? false : 'DATABASE_URL não definida (este teste precisa do Postgres local)';
const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres!';
const CHAVE = '41251166911358000184550010000001231000001238';

type Pedido = { metodo: string; caminho: string; corpo: Record<string, any>; cru: string; headers: http.IncomingHttpHeaders };
// JSON ou form-urlencoded (o /oauth/token do Bling).
const lerCru = (cru: string): Record<string, any> => { if (!cru) return {}; try { return JSON.parse(cru); } catch { return Object.fromEntries(new URLSearchParams(cru)); } };
async function fake(responder: (r: Pedido) => [number, unknown]) {
  const recebidos: Pedido[] = [];
  const s = http.createServer(async (req, res) => {
    let cru = '';
    for await (const c of req) cru += c;
    const r = { metodo: req.method ?? '', caminho: req.url ?? '', corpo: lerCru(cru), cru, headers: req.headers };
    recebidos.push(r);
    const [st, body] = responder(r);
    res.writeHead(st, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((ok) => s.listen(0, '127.0.0.1', ok));
  return { s, recebidos, url: `http://127.0.0.1:${(s.address() as AddressInfo).port}` };
}

// Estado dos falsos: valor confirmado por pedido, carrinhos/checkouts por pedido e falhas programadas.
const amount = new Map<string, number>(), carrinhos = new Map<string, number>(), checkouts = new Map<string, number>(), falharCheckout = new Set<string>(), falharGerar = new Set<string>();
const somar = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

// Bling falso: OAuth (Basic + enable-jwt), contatos, produto, pedidos (por numeroLoja), NF-e e roteiro de situações por pedido.
const BLING_SEGREDO = 'segredo-do-app-de-teste-1234567890';
const bl = {
  tokens: new Set<string>(), refresh: '', n: 0, refreshes: 0, recusarRefresh: false, expirarUmaVez: false, seq: 5000,
  contatos: new Map<string, number>(), pedidos: new Map<string, number>(), notaDoPedido: new Map<number, number>(), nsuDoPedido: new Map<number, string>(),
  notas: new Map<number, { nsu: string; enviada: boolean }>(), pedidosCriados: new Map<string, number>(), notasCriadas: new Map<string, number>(),
  envios: new Map<string, number>(), gerar: new Map<string, number>(), roteiro: new Map<string, number[]>(), falharEnviar: new Set<string>(), corpoPedido: new Map<string, any>(), emails: [] as string[],
};
// Chave válida (DV mod 11) diferente por nota.
const chaveDaNota = (id: number) => { const base = `41251166911358000184550010${String(id).padStart(9, '0')}10000012`; return [...'0123456789'].map((d) => base + d).find((c) => chaveNfe(c))!; };
function responderBling(r: Pedido): [number, unknown] {
  const u = new URL(r.caminho, 'http://x'), cam = u.pathname, q = u.searchParams;
  if (cam === '/oauth/token') {
    if (r.headers.authorization !== `Basic ${Buffer.from(`cliente-teste-123:${BLING_SEGREDO}`).toString('base64')}` || r.headers['enable-jwt'] !== '1') return [401, { error: { type: 'invalid_client' } }];
    const ok = r.corpo.grant_type === 'authorization_code' ? r.corpo.code === 'code-ok' : !bl.recusarRefresh && r.corpo.refresh_token === bl.refresh;
    if (!ok) return [400, { error: { type: 'invalid_grant', message: 'invalid_grant' } }];
    if (r.corpo.grant_type === 'refresh_token') bl.refreshes++;
    bl.n++; bl.tokens.clear(); bl.tokens.add(`acc-${bl.n}`); bl.refresh = `ref-${bl.n}`;
    return [200, { access_token: `acc-${bl.n}`, refresh_token: bl.refresh, expires_in: 21600, token_type: 'Bearer', scope: '1 2 3' }];
  }
  const token = String(r.headers.authorization).replace('Bearer ', '');
  if (!bl.tokens.has(token) || r.headers['enable-jwt'] !== '1' || bl.expirarUmaVez) { bl.expirarUmaVez = false; return [401, { error: { type: 'invalid_token' } }]; }
  const pid = Number(/^\/pedidos\/vendas\/(\d+)/.exec(cam)?.[1]), nid = Number(/^\/nfe\/(\d+)/.exec(cam)?.[1]);
  const id = () => ++bl.seq;
  if (cam === '/produtos') return [200, { data: q.get('codigos[]') === 'LIVRO-LI' ? [{ id: 555, codigo: 'LIVRO-LI', nome: 'Livro Liderança Inteligente', preco: 97 }] : [] }];
  if (cam === '/contatos' && r.metodo === 'GET') { const c = bl.contatos.get(q.get('numeroDocumento') ?? ''); return [200, { data: c ? [{ id: c }] : [] }]; }
  if (cam === '/contatos') { const c = id(); bl.contatos.set(r.corpo.numeroDocumento, c); return [201, { data: { id: c } }]; }
  if (cam === '/pedidos/vendas' && r.metodo === 'GET') { const p = bl.pedidos.get(q.get('numerosLojas[]') ?? ''); return [200, { data: p ? [{ id: p }] : [] }]; }
  if (cam === '/pedidos/vendas') {
    const nsu = r.corpo.numeroLoja, p = id();
    somar(bl.pedidosCriados, nsu); bl.pedidos.set(nsu, p); bl.nsuDoPedido.set(p, nsu); bl.corpoPedido.set(nsu, r.corpo);
    return [201, { data: { id: p, alertas: [] } }];
  }
  if (pid && cam.endsWith('/gerar-nfe')) {
    somar(bl.gerar, bl.nsuDoPedido.get(pid) ?? '');
    if (bl.notaDoPedido.has(pid)) return [400, { error: { type: 'VALIDATION_ERROR', message: 'erro', description: 'O pedido já possui nota fiscal' } }];
    const nsu = bl.nsuDoPedido.get(pid)!, n = id();
    bl.notaDoPedido.set(pid, n); bl.notas.set(n, { nsu, enviada: false }); somar(bl.notasCriadas, nsu);
    return [201, { idNotaFiscal: n }];
  }
  if (pid) return [200, { data: { id: pid, numeroLoja: bl.nsuDoPedido.get(pid), notaFiscal: { id: bl.notaDoPedido.get(pid) ?? 0 } } }];
  const nota = bl.notas.get(nid);
  if (!nota) return [404, { error: { type: 'RESOURCE_NOT_FOUND', message: 'x', description: 'Nota não encontrada' } }];
  if (cam.endsWith('/enviar')) {
    somar(bl.envios, nota.nsu); bl.emails.push(q.get('enviarEmail') ?? '');
    if (bl.falharEnviar.delete(nota.nsu)) return [503, { error: { type: 'SERVER_ERROR', message: 'x', description: 'Instabilidade' } }];
    nota.enviada = true;
    return [200, { data: { xml: '<xml/>' } }];
  }
  const fila = bl.roteiro.get(nota.nsu) ?? [5];
  const situacao = !nota.enviada ? 1 : fila.length > 1 ? fila.shift()! : fila[0];
  return [200, { data: { id: nid, situacao, numero: String(nid).slice(-6), chaveAcesso: chaveDaNota(nid), linkDanfe: `https://www.bling.com.br/danfe/${nid}?accessKey=x` } }];
}

async function preparar() {
  const ip = await fake((r) => {
    if (r.caminho === '/links') return [200, { url: `https://pagar.exemplo/${r.corpo.order_nsu}` }];
    const a = amount.get(r.corpo.order_nsu) ?? 9700;
    return [200, { success: true, paid: true, amount: a, paid_amount: a + 500, installments: 3, capture_method: 'credit_card' }];
  });
  const me = await fake((r) => {
    if (r.headers.authorization !== 'Bearer token-de-teste-1234567890') return [401, { message: 'Unauthenticated.' }];
    const id = r.corpo.orders?.[0];
    switch (r.caminho) {
      case '/api/v2/me/shipment/calculate': return [200, [{ id: 1, custom_price: '20.00', custom_delivery_time: 7 }, { id: 2, custom_price: '30.00' }, { id: 3, custom_price: '5.00' }]];
      case '/api/v2/me/cart': somar(carrinhos, r.corpo.options.tags[0].tag); return [201, { id: `etq-${r.corpo.options.tags[0].tag}` }];
      case '/api/v2/me/shipment/checkout':
        somar(checkouts, id);
        if (falharCheckout.delete(id)) return [500, { message: 'Erro interno no Melhor Envio' }];
        return [200, { purchase: { status: 'paid' } }];
      case '/api/v2/me/shipment/generate': return falharGerar.delete(id) ? [500, { message: 'Erro ao gerar' }] : [200, {}];
      case '/api/v2/me/shipment/print': return [200, { url: `https://melhorenvio.com.br/imprimir/${id}` }];
      default: return [200, {}];
    }
  });
  const lider = await fake(() => [200, { ok: true }]);
  const bling = await fake(responderBling);

  Object.assign(process.env, {
    INFINITEPAY_HANDLE: 'teste-local', INFINITEPAY_API_URL: ip.url, MELHOR_ENVIO_TOKEN: 'token-de-teste-1234567890', MELHOR_ENVIO_API_URL: me.url,
    ENVIO_MODO: 'nota', ENVIO_APOS_DIAS: '0', LIDER_WEBHOOK_URL: `${lider.url}/aviso`, LIDER_WEBHOOK_SEGREDO: SEGREDO, SITE_URL: 'http://localhost:3999',
    BLING_CLIENT_ID: 'cliente-teste-123', BLING_CLIENT_SECRET: BLING_SEGREDO, BLING_SKU: 'LIVRO-LI', BLING_FORMA_PAGAMENTO_ID: '777', BLING_API_URL: bling.url, BLING_ENVIAR_EMAIL: 'sim',
  });
  const { rotaCheckout } = await import('../src/checkout.ts');
  const db = await import('../src/db.ts');
  const pedidos = await import('../src/pedidos.ts');
  const rotina = await import('../src/rotina.ts');
  const { assinaturaOk } = await import('../src/lider.ts');
  const conta = await import('../src/bling-conta.ts');
  (await import('../src/bling.ts')).BLING.intervaloMs = 5; // os 350 ms de produção só deixariam o teste lento
  await db.migrar();
  // Pedidos de rodadas anteriores saem de cena (soft delete) para a rotina não mexer neles.
  await db.pool.query(`update pagina_vendas_pedidos set is_deleted = true, deleted_at = now(), modified_by = 'teste' where email like '%@teste.local' and is_deleted = false`);
  await db.pool.query(`update pagina_vendas_integracoes set is_deleted = true, deleted_at = now(), modified_by = 'teste' where nome = 'bling'`); // começa sem conta autorizada

  const app = http.createServer(async (req, res) => {
    if (!(await rotaCheckout(req, res, new URL(req.url ?? '/', 'http://x')))) { res.writeHead(404); res.end(); }
  });
  await new Promise<void>((ok) => app.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;

  const fechar = async () => {
    for (const s of [app, ip.s, me.s, lider.s, bling.s]) { s.closeAllConnections(); s.close(); }
    await db.pool.end();
  };
  return { base, ip, me, lider, bling, pedidos, rotina, conta, assinaturaOk, db, fechar };
}

let m: Awaited<ReturnType<typeof preparar>>;
before(async () => { if (!pular) m = await preparar(); });
after(async () => { if (m) await m.fechar(); });

const esperar = async <T>(f: () => Promise<T>, ok: (v: T) => boolean, ms = 4000): Promise<T> => {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await f();
    if (ok(v) || Date.now() > limite) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
};
const status = (nsu: string) => m.pedidos.porNsu(nsu);
const historico = async (nsu: string) => m.pedidos.historicoDe((await status(nsu))!.id);

const FORM = {
  nome: 'Maria da Silva', celular: '(44) 99999-8888', cpf: '529.982.247-25', cep: '01310-100', rua: 'Av. Paulista', numero: '1000',
  complemento: '', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', visitante: 'abc123def456', utm_source: 'facebook',
};
let ip = 0; // um IP por compra: o limite de 10 compras/10 min por IP não entra no caminho do teste
async function comprar(): Promise<string> {
  const email = `maria.${Date.now()}${Math.random().toString(36).slice(2, 6)}@teste.local`;
  const r = await fetch(`${m.base}/comprar`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ ...FORM, email }), headers: { 'x-forwarded-for': `10.0.0.${++ip}` } });
  assert.equal(r.status, 303);
  const nsu = /^https:\/\/pagar\.exemplo\/(LI-[A-Z2-7]{10})$/.exec(r.headers.get('location') ?? '')?.[1];
  assert.ok(nsu, `Location inesperado: ${r.headers.get('location')}`);
  return nsu;
}
const webhook = (corpo: unknown) => fetch(`${m.base}/api/infinitepay/webhook`, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
async function pagar(nsu: string) {
  const r = await webhook({ order_nsu: nsu, transaction_nsu: `tx-${nsu}`, invoice_slug: `slug-${nsu}`, amount: 9700, paid_amount: 10200 });
  assert.equal(r.status, 200);
  return esperar(() => status(nsu), (p) => p?.status !== 'AGUARDANDO_PAGAMENTO');
}

let principal = '';

test('formulário inválido volta 422 com os valores e as mensagens', { skip: pular }, async () => {
  const r = await fetch(`${m.base}/comprar`, { method: 'POST', body: new URLSearchParams({ ...FORM, email: 'x', cpf: '111.111.111-11' }) });
  assert.equal(r.status, 422);
  const html = await r.text();
  assert.match(html, /CPF inválido/);
  assert.match(html, /aria-describedby="e-email/);
  assert.match(html, /value="Maria da Silva"/);
});

test('criar pedido → webhook → payment_check → PAGO e aviso assinado ao Líder', { skip: pular }, async () => {
  principal = await comprar();
  const p = await pagar(principal);
  assert.equal(p?.status, 'PAGO');
  assert.equal(p?.metodo, 'credit_card');
  assert.equal(p?.parcelas, 3);
  assert.equal(p?.valorPagoCentavos, 10200, 'paid_amount com juros fica registrado');
  assert.ok(p?.pagoEm && p.envioPrevistoEm && p.envioPrevistoEm.getTime() === p.pagoEm.getTime(), 'ENVIO_APOS_DIAS=0');
  assert.equal(p?.origem, 'facebook');

  const comAcesso = await esperar(() => status(principal), (x) => x?.acessoStatus === 'ENVIADO');
  assert.equal(comAcesso?.acessoStatus, 'ENVIADO');
  const avisos = m.lider.recebidos.filter((r) => r.corpo.id === principal);
  assert.equal(avisos.length, 1);
  assert.ok(m.assinaturaOk(SEGREDO, avisos[0].cru, String(avisos[0].headers['x-assinatura'])), 'HMAC confere');
  assert.equal(avisos[0].headers['x-evento-id'], principal);
  assert.deepEqual(avisos[0].corpo.comprador, { nome: 'Maria da Silva', email: p!.email, cpf: '52998224725', telefone: '44999998888' });

  const pg = await (await fetch(`${m.base}/obrigado?order_nsu=${principal}`)).text();
  assert.match(pg, /Pagamento confirmado, Maria!/);
  assert.ok(!pg.includes(p!.email) && !pg.includes('Silva'), 'obrigado sem dado pessoal além do primeiro nome');
});

test('webhook repetido não faz nada novo; inexistente ou inválido = 400', { skip: pular }, async () => {
  const antes = (await historico(principal)).length, checks = m.ip.recebidos.length;
  const r = await webhook({ order_nsu: principal, transaction_nsu: `tx-${principal}`, invoice_slug: `slug-${principal}` });
  assert.equal(r.status, 200);
  await new Promise((ok) => setTimeout(ok, 200));
  assert.equal((await historico(principal)).length, antes);
  assert.equal(m.ip.recebidos.length, checks, 'sem novo payment_check');
  assert.equal((await webhook({ order_nsu: 'LI-AAAAAAAAAA', transaction_nsu: 'x', invoice_slug: 'y' })).status, 400);
  assert.equal((await fetch(`${m.base}/api/infinitepay/webhook`, { method: 'POST', body: '{nao json' })).status, 400);
});

test('amount divergente não marca pago e registra no histórico', { skip: pular }, async () => {
  const nsu = await comprar();
  amount.set(nsu, 100);
  await webhook({ order_nsu: nsu, transaction_nsu: `tx-${nsu}`, invoice_slug: `slug-${nsu}` });
  const h = await esperar(() => historico(nsu), (l) => l.some((x) => x.acao === 'valor divergente'));
  assert.ok(h.some((x) => x.acao === 'valor divergente'));
  assert.equal((await status(nsu))?.status, 'AGUARDANDO_PAGAMENTO');
});

test('rotina: sem nota ⇒ AGUARDANDO_NOTA; com chave ⇒ 1 carrinho e 1 checkout mesmo com 2 rotinas em paralelo', { skip: pular }, async () => {
  await m.rotina.rodarRotina();
  const semNota = await status(principal);
  assert.equal(semNota?.status, 'AGUARDANDO_NOTA');
  assert.match(semNota?.notaErro ?? '', /Bling não está autorizado/, 'Bling configurado mas sem conta: espera a chave, com o motivo');
  assert.ok(await m.pedidos.informarNota(semNota!, CHAVE, 'painel:teste'));

  await Promise.all([m.rotina.rodarRotina(), m.rotina.rodarRotina()]);
  const p = await status(principal);
  assert.equal(p?.status, 'ETIQUETA_COMPRADA', p?.envioErro ?? '');
  assert.equal(p?.meEtiquetaId, `etq-${principal}`);
  assert.equal(p?.meServico, 1, 'PAC, o mais barato entre 1 e 2');
  assert.equal(p?.meFreteCentavos, 2000);
  assert.match(p?.meImpressaoUrl ?? '', /imprimir/);
  assert.ok(p?.meCompradaEm);
  assert.equal(carrinhos.get(principal), 1);
  assert.equal(checkouts.get(`etq-${principal}`), 1);
  const carrinho = m.me.recebidos.find((r) => r.caminho === '/api/v2/me/cart' && r.corpo.options.tags[0].tag === principal)!;
  assert.deepEqual(carrinho.corpo.options.invoice, { key: CHAVE });
  assert.match(String(carrinho.headers['user-agent']), /^Pagina Lideranca Inteligente \(/);
});

test('falha no checkout ⇒ ERRO_ENVIO; rotina não repete; "tentar de novo" retoma sem nova inserção', { skip: pular }, async () => {
  const nsu = await comprar();
  assert.equal((await pagar(nsu))?.status, 'PAGO');
  assert.ok(await m.pedidos.informarNota((await status(nsu))!, CHAVE, 'painel:teste'));
  falharCheckout.add(`etq-${nsu}`);

  const p = (await status(nsu))!;
  await Promise.all([m.rotina.comprarEtiqueta(p), m.rotina.comprarEtiqueta(p)]); // reivindicação: só um compra
  let atual = await status(nsu);
  assert.equal(atual?.status, 'ERRO_ENVIO');
  assert.match(atual?.envioErro ?? '', /Falhou na compra/);
  assert.equal(atual?.envioTentativas, 1);
  assert.equal(carrinhos.get(nsu), 1);
  assert.equal(checkouts.get(`etq-${nsu}`), 1);

  await m.rotina.rodarRotina();
  assert.equal((await status(nsu))?.status, 'ERRO_ENVIO', 'ERRO_ENVIO só volta pelo painel');
  assert.equal(checkouts.get(`etq-${nsu}`), 1);

  assert.ok(await m.pedidos.tentarDeNovo((await status(nsu))!, 'painel:teste'));
  await m.rotina.rodarRotina();
  atual = await status(nsu);
  assert.equal(atual?.status, 'ETIQUETA_COMPRADA', atual?.envioErro ?? '');
  assert.equal(carrinhos.get(nsu), 1, 'nenhuma inserção nova no carrinho');
  assert.equal(checkouts.get(`etq-${nsu}`), 2);
  const acoes = (await historico(nsu)).map((h) => `${h.quem}:${h.acao}`);
  assert.ok(acoes.includes('painel:teste:nova tentativa de envio') && acoes.includes('sistema:erro no envio'));
  assert.ok((await historico(nsu)).every((h) => !String(h.detalhe).includes('52998224725')), 'histórico sem CPF');
});

test('um pagamento confirma um pedido só; pagamento em pedido cancelado vira alerta', { skip: pular }, async () => {
  const outro = await comprar();
  const r = await fetch(`${m.base}/obrigado?order_nsu=${outro}&slug=slug-${principal}&transaction_nsu=tx-${principal}&receipt_url=https://falso.exemplo/x`);
  assert.equal(r.status, 200);
  const p = await status(outro);
  assert.equal(p?.status, 'AGUARDANDO_PAGAMENTO', 'slug/transação de outro pedido não confirma este');
  assert.equal(p?.comprovanteUrl, null);
  assert.ok((await historico(outro)).some((h) => h.acao === 'pagamento já usado em outro pedido'));

  const cancelado = await comprar();
  assert.ok(await m.pedidos.cancelar((await status(cancelado))!, 'painel:teste'));
  assert.equal((await webhook({ order_nsu: cancelado, transaction_nsu: `tx-${cancelado}`, invoice_slug: `slug-${cancelado}` })).status, 200);
  const h = await esperar(() => historico(cancelado), (l) => l.some((x) => x.acao === 'pagamento recebido em pedido cancelado'));
  assert.ok(h.some((x) => x.acao === 'pagamento recebido em pedido cancelado'));
  assert.equal((await status(cancelado))?.status, 'CANCELADO');
});

test('compra em andamento trava cancelar/tentar; etiqueta paga fica registrada e o cancelamento avisa', { skip: pular }, async () => {
  const nsu = await comprar();
  assert.equal((await pagar(nsu))?.status, 'PAGO');
  const id = (await status(nsu))!.id;
  await m.pedidos.mudar(id, undefined, { status: 'COMPRANDO_ETIQUETA' }, 'sistema', null); // rotina no meio da compra
  let p = (await status(nsu))!;
  assert.equal(await m.pedidos.cancelar(p, 'painel:teste'), false);
  assert.equal(await m.pedidos.tentarDeNovo(p, 'painel:teste'), false);

  await m.pedidos.mudar(id, undefined, { status: 'PAGO', envioErro: null, notaChave: CHAVE }, 'sistema', null);
  falharGerar.add(`etq-${nsu}`);
  await m.rotina.comprarEtiqueta((await status(nsu))!);
  p = (await status(nsu))!;
  assert.equal(p.status, 'ERRO_ENVIO');
  assert.ok(p.meCompradaEm, 'me_comprada_em gravado logo após o checkout');
  assert.ok(await m.pedidos.cancelar(p, 'painel:teste'));
  const c = (await historico(nsu)).find((h) => h.acao === 'pedido cancelado');
  assert.match(c?.detalhe ?? '', /cancele a etiqueta no Melhor Envio/);
  assert.match(c?.detalhe ?? '', /NF-e autorizada: cancele no Bling \(Vendas > Notas Fiscais de Saída\), em até 24 h/);
});

// ---------- NF-e pelo Bling ----------
const atrasar = (nsu: string, min: number) =>
  m.db.pool.query(`update pagina_vendas_pedidos set updated_at = now() - make_interval(mins => $2) where order_nsu = $1`, [nsu, min]);
async function autorizar() {
  bl.recusarRefresh = false; bl.expirarUmaVez = false;
  await m.conta.conectar('code-ok', 'painel:teste');
}
async function pagoNoDia(): Promise<string> {
  const nsu = await comprar();
  assert.equal((await pagar(nsu))?.status, 'PAGO');
  await esperar(() => status(nsu), (x) => x?.acessoStatus === 'ENVIADO'); // o aviso de acesso também mexe no updated_at
  return nsu;
}
const resumo = (p: Awaited<ReturnType<typeof status>>) => `${p?.status} ${p?.notaErro ?? ''} ${p?.envioErro ?? ''}`;

test('Bling: PAGO no dia ⇒ EMITINDO_NOTA ⇒ autorizada ⇒ ETIQUETA_COMPRADA na mesma rodada, com a chave do Bling no carrinho', { skip: pular }, async () => {
  await autorizar();
  const tok = m.bling.recebidos.find((r) => r.caminho === '/oauth/token' && r.corpo.grant_type === 'authorization_code')!;
  assert.equal(tok.headers['enable-jwt'], '1');
  assert.equal((await m.conta.conta())?.situacao, 'AUTORIZADA');
  const { rows } = await m.db.pool.query(`select access_token_cifrado from pagina_vendas_integracoes where nome = 'bling' and is_deleted = false`);
  assert.ok(!String(rows[0].access_token_cifrado).includes('acc-'), 'token cifrado no banco');

  const nsu = await pagoNoDia();
  await m.rotina.rodarRotina();
  const p = (await status(nsu))!;
  assert.equal(p.status, 'ETIQUETA_COMPRADA', resumo(p));
  assert.equal(p.notaChave, chaveDaNota(Number(p.blingNfeId)));
  assert.equal(p.notaNumero, String(p.blingNfeId).slice(-6));
  assert.match(p.notaDanfeUrl ?? '', /^https:\/\/www\.bling\.com\.br\/danfe\//);
  assert.ok(p.blingContatoId && p.blingPedidoId);
  const carrinho = m.me.recebidos.find((r) => r.caminho === '/api/v2/me/cart' && r.corpo.options.tags[0].tag === nsu)!;
  assert.deepEqual(carrinho.corpo.options.invoice, { key: p.notaChave });
  const corpo = bl.corpoPedido.get(nsu);
  assert.equal(corpo.numeroLoja, nsu);
  assert.deepEqual(corpo.itens[0].produto, { id: 555 });
  assert.deepEqual(corpo.parcelas[0].formaPagamento, { id: 777 });
  assert.equal(bl.emails.at(-1), 'true', 'enviarEmail explícito');
  const h = await historico(nsu);
  assert.ok(h.some((x) => x.acao === `NF-e nº ${p.notaNumero} autorizada`));
  assert.ok(h.every((x) => !String(x.detalhe).includes('52998224725') && !String(x.detalhe).includes('acc-')), 'histórico sem CPF nem token');
});

test('Bling: NF-e pendente na 1ª consulta fica em EMITINDO_NOTA e é autorizada na rodada seguinte', { skip: pular }, async () => {
  const nsu = await pagoNoDia();
  bl.roteiro.set(nsu, [8, 5]);
  await m.rotina.rodarRotina();
  let p = await status(nsu);
  assert.equal(p?.status, 'EMITINDO_NOTA', resumo(p));
  assert.ok(p?.notaIniciadaEm);
  await m.rotina.rodarRotina(); // não está parada há 3 min: a rodada não mexe
  assert.equal((await status(nsu))?.status, 'EMITINDO_NOTA');
  await atrasar(nsu, 5);
  await m.rotina.rodarRotina();
  p = await status(nsu);
  assert.equal(p?.status, 'ETIQUETA_COMPRADA', resumo(p));
  assert.equal(bl.notasCriadas.get(nsu), 1);
  assert.equal(bl.envios.get(nsu), 1);
});

test('Bling: rejeitada ⇒ AGUARDANDO_NOTA com motivo; "Tentar de novo" retoma a mesma nota', { skip: pular }, async () => {
  const nsu = await pagoNoDia();
  bl.roteiro.set(nsu, [4]);
  await m.rotina.rodarRotina();
  let p = (await status(nsu))!;
  assert.equal(p.status, 'AGUARDANDO_NOTA', resumo(p));
  assert.match(p.notaErro ?? '', /NF-e rejeitada pela SEFAZ: corrija no Bling/);
  assert.ok((await historico(nsu)).some((h) => h.acao === 'NF-e rejeitada'));

  bl.roteiro.set(nsu, [5]); // corrigida e transmitida no Bling
  assert.ok(await m.pedidos.tentarNota(p, 'painel:teste'));
  await m.rotina.rodarRotina();
  p = (await status(nsu))!;
  assert.equal(p.status, 'ETIQUETA_COMPRADA', resumo(p));
  assert.equal(bl.pedidosCriados.get(nsu), 1);
  assert.equal(bl.notasCriadas.get(nsu), 1, 'não gera nota nova');
  assert.equal(bl.envios.get(nsu), 1);
});

test('Bling: queda depois de criar pedido e nota ⇒ retomada (2 em paralelo) sem 2º pedido nem 2ª nota', { skip: pular }, async () => {
  const nsu = await pagoNoDia();
  bl.falharEnviar.add(nsu);
  await m.rotina.rodarRotina();
  let p = (await status(nsu))!;
  assert.equal(p.status, 'EMITINDO_NOTA', 'falha temporária fica para a próxima rodada');
  assert.match(p.notaErro ?? '', /tenta de novo/);
  // O processo "caiu" antes de gravar os ids do pedido e da nota (o Bling já tem os dois).
  await m.db.pool.query(`update pagina_vendas_pedidos set bling_pedido_id = null, bling_nfe_id = null, updated_at = now() - interval '10 minutes' where order_nsu = $1`, [nsu]);
  p = (await status(nsu))!;
  await Promise.all([m.rotina.emitirNota(p, true), m.rotina.emitirNota(p, true)]);
  p = (await status(nsu))!;
  assert.equal(p.status, 'ETIQUETA_COMPRADA', resumo(p));
  assert.equal(bl.pedidosCriados.get(nsu), 1, 'achou pelo numeroLoja');
  assert.equal(bl.notasCriadas.get(nsu), 1, 'leu a nota do pedido');
  assert.equal(bl.gerar.get(nsu), 1, 'retomada lê a nota do pedido antes, sem chamar gerar-nfe de novo');
  assert.equal(bl.envios.get(nsu), 2, '1 falhou + 1 ok');
  assert.equal(carrinhos.get(nsu), 1);
  assert.ok((await historico(nsu)).some((h) => h.acao === 'pedido de venda já existia no Bling'));
});

test('Bling: token recusado (401) ⇒ renova e repete', { skip: pular }, async () => {
  const antes = bl.refreshes;
  const nsu = await pagoNoDia();
  bl.expirarUmaVez = true;
  await m.rotina.rodarRotina();
  const p = await status(nsu);
  assert.equal(p?.status, 'ETIQUETA_COMPRADA', resumo(p));
  assert.equal(bl.refreshes, antes + 1);
  assert.equal((await m.conta.conta())?.situacao, 'AUTORIZADA');
});

test('Bling: refresh recusado ⇒ REAUTORIZAR e pedidos em AGUARDANDO_NOTA com motivo', { skip: pular }, async () => {
  const nsu = await pagoNoDia();
  bl.expirarUmaVez = true; bl.recusarRefresh = true;
  await m.rotina.rodarRotina();
  const p = await status(nsu);
  assert.equal(p?.status, 'AGUARDANDO_NOTA', resumo(p));
  assert.match(p?.notaErro ?? '', /Bling não está autorizado/);
  const c = await m.conta.conta();
  assert.equal(c?.situacao, 'REAUTORIZAR');
  assert.match(c?.erro ?? '', /renovação recusada/);

  const outro = await pagoNoDia();
  const chamadas = m.bling.recebidos.length;
  await m.rotina.rodarRotina();
  assert.equal((await status(outro))?.status, 'AGUARDANDO_NOTA');
  assert.equal(m.bling.recebidos.length, chamadas, 'sem conta autorizada nem chama o Bling');
  await autorizar();
});

test('COMPRANDO_ETIQUETA abandonado há mais de 15 min é retomado sem nova inserção nem checkout', { skip: pular }, async () => {
  const nsu = await pagoNoDia();
  const id = (await status(nsu))!.id;
  // O processo caiu depois do checkout: etiqueta no carrinho e paga, faltando geração e impressão.
  await m.pedidos.mudar(id, undefined, { status: 'COMPRANDO_ETIQUETA', notaChave: CHAVE, meEtiquetaId: `etq-${nsu}`, meServico: 1, meFreteCentavos: 2000, meCompradaEm: new Date() }, 'sistema', null);
  await atrasar(nsu, 5);
  await m.rotina.rodarRotina();
  assert.equal((await status(nsu))?.status, 'COMPRANDO_ETIQUETA', 'parado há 5 min ainda pode estar comprando');
  await atrasar(nsu, 20);
  await Promise.all([m.rotina.rodarRotina(), m.rotina.rodarRotina()]);
  const p = await status(nsu);
  assert.equal(p?.status, 'ETIQUETA_COMPRADA', resumo(p));
  assert.match(p?.meImpressaoUrl ?? '', /imprimir/);
  assert.equal(carrinhos.get(nsu), undefined, 'nenhuma inserção no carrinho');
  assert.equal(checkouts.get(`etq-${nsu}`), undefined, 'nenhum checkout');
  assert.equal((await historico(nsu)).filter((h) => h.acao === 'compra da etiqueta retomada').length, 1);
});

