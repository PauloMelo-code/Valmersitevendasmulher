import type http from 'node:http';
import { EMPRESA, PIXEL_TAG } from './ambiente.ts';
import { esc } from './graficos.ts';
import { fim, html, ir, lerCorpo, mesmaOrigem } from './http.ts';
import { and, isNull } from 'drizzle-orm';
import { erroSemDados } from './db.ts';
import { criarLink, INFINITEPAY, reciboOk } from './infinitepay.ts';
import { NOME_PAGINA } from './pagina.ts';
import { anotar, criarPedido, em, mudar, porNsu, type Pedido } from './pedidos.ts';
import { confirmarPagamento } from './rotina.ts';
import { paginaVendasPedidos as P } from './schema.ts';
import { UFS, validarCompra, type Campo } from './validar.ts';

// Rotas do checkout próprio: /comprar (formulário), /obrigado (volta da InfinitePay) e o webhook.
// Dado pessoal nunca vai para URL nem log: o order_nsu é o único identificador que circula.

const preco = (c: number) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: c % 100 ? 2 : 0 })}`;
const ID = /^[\w-]{1,100}$/;
const param = (q: URLSearchParams, k: string, re = ID) => { const v = q.get(k) ?? ''; return re.test(v) ? v : null; };

// ponytail: limite por IP em memória e por container (com 2 containers vira até 20 a cada 10 min); zera no restart.
// Se /comprar virar alvo de abuso, mover a contagem para o Postgres.
const JANELA = 10 * 60_000, MAX = 10, porIp = new Map<string, number[]>();
export function limitado(ip: string, agora = Date.now()): boolean {
  if (porIp.size > 5000) porIp.clear();
  const t = (porIp.get(ip) ?? []).filter((x) => agora - x < JANELA);
  t.push(agora);
  porIp.set(ip, t);
  return t.length > MAX;
}
// Atrás do proxy do Easypanel o socket é o proxy: vale o último IP do X-Forwarded-For (o que o proxy anexou, não o que o cliente mandou).
const ipDe = (req: http.IncomingMessage) => String(req.headers['x-forwarded-for'] ?? '').split(',').pop()?.trim() || req.socket.remoteAddress || '?';

// ---------- HTML ----------
const CSS = `:root{--navy:#08132B;--navy-2:#0C1A3A;--campo:#0A1733;--gold:#D4A855;--gold-hi:#F0D798;--txt:#F6F2EA;--mut:#A3AEC6;--erro:#F4A796;--linha:rgba(212,168,85,.18)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--navy);color:var(--txt);font:16px/1.55 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--gold)}a:hover{color:var(--gold-hi)}
.topo{border-bottom:1px solid var(--linha)}.topo div{max-width:1080px;margin:0 auto;padding:16px;font:400 20px/1 'Bebas Neue',sans-serif;letter-spacing:3px}.topo b{font-weight:400;color:var(--gold)}
main{max-width:1080px;margin:0 auto;padding:24px 16px 48px;display:grid;gap:24px}
h1{margin:0;font:800 26px/1.2 Montserrat,sans-serif;letter-spacing:-.3px}h2{margin:0 0 12px;font:700 18px/1.3 Montserrat,sans-serif}
.oferta,.cartao{background:linear-gradient(180deg,rgba(19,38,80,.6),rgba(10,23,51,.7));border:1px solid var(--linha);border-radius:18px;padding:20px}
.prod{display:flex;gap:16px;align-items:center}.prod img{width:84px;height:auto;border-radius:6px;flex:none;box-shadow:0 10px 24px -8px rgba(0,0,0,.6)}
.prod p{margin:4px 0 0;color:var(--mut);font-size:14px}
.valor{margin:18px 0 6px;font:400 54px/1 'Bebas Neue',sans-serif;color:#fff}.valor small{font:600 14px Inter,sans-serif;color:var(--mut);margin-left:6px}
.formas{margin:0 0 16px;color:var(--gold-hi);font-weight:600;font-size:15px}
.itens{list-style:none;margin:0;padding:16px 0 0;border-top:1px solid var(--linha);display:grid;gap:10px;font-size:15px}
.itens li{display:flex;gap:10px;align-items:flex-start}.itens svg{flex:none;margin-top:3px;color:var(--gold)}
.aviso{margin:0 0 18px;padding:12px 14px;border-radius:12px;background:rgba(244,167,150,.08);border:1px solid rgba(244,167,150,.35);color:var(--erro);font-size:15px}
.grade{display:grid;gap:16px}.lin{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
label{display:block;margin:0 0 6px;font-size:14px;font-weight:600;color:#D5DCEA}label small{font-weight:400;color:var(--mut)}
input,select{width:100%;height:52px;padding:0 14px;border-radius:12px;border:1px solid rgba(147,160,189,.3);background:var(--campo);color:var(--txt);font:500 16px Inter,sans-serif}
select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--mut) 50%),linear-gradient(135deg,var(--mut) 50%,transparent 50%);background-position:calc(100% - 20px) 50%,calc(100% - 15px) 50%;background-size:5px 5px;background-repeat:no-repeat}
input:focus,select:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 4px rgba(212,168,85,.18)}
[aria-invalid=true]{border-color:var(--erro)}
.erro{margin:6px 0 0;color:var(--erro);font-size:14px}.dica{margin:6px 0 0;color:var(--mut);font-size:13.5px;min-height:1px}
.enviar{width:100%;min-height:58px;margin-top:8px;border:0;border-radius:12px;cursor:pointer;color:#0A1430;font:800 16px Montserrat,sans-serif;letter-spacing:.5px;
  background:linear-gradient(135deg,#A87B2A,var(--gold) 40%,var(--gold-hi) 75%,var(--gold));box-shadow:0 14px 34px -12px rgba(212,168,85,.7)}
.enviar:focus-visible{outline:2px solid var(--gold-hi);outline-offset:3px}.enviar[disabled]{cursor:wait;opacity:.8}
.seguro{margin:12px 0 0;text-align:center;color:var(--mut);font-size:13.5px}
.rodape{border-top:1px solid var(--linha);color:#7D8AA5;font-size:13px}.rodape div{max-width:1080px;margin:0 auto;padding:20px 16px;display:flex;flex-wrap:wrap;gap:6px 16px}
.rodape a{color:#9AA6BF}
.msg{max-width:560px;margin:0 auto;text-align:center}.msg p{color:#C9D2E3}.msg .bt{display:inline-block;margin-top:12px;padding:16px 28px;border:0;border-radius:12px;background:var(--gold);color:#0A1430;font:800 15px Montserrat,sans-serif;text-decoration:none;cursor:pointer}
@media (min-width:560px){.lin{grid-template-columns:repeat(2,minmax(0,1fr))}.lin.l3{grid-template-columns:1.4fr .8fr 1fr}}
@media (min-width:900px){main{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);align-items:start;padding-top:40px}.oferta{position:sticky;top:24px}h1{font-size:30px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

const OK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function moldura(titulo: string, corpo: string, extra = '') {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#08132B"><title>${titulo} · Liderança Inteligente</title>
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=Inter:wght@400;500;600&amp;family=Montserrat:wght@700;800&amp;display=swap" rel="stylesheet">
<style>${CSS}</style>${extra}</head><body>
<header class="topo"><div>LIDERANÇA <b>INTELIGENTE</b></div></header>
${corpo}
<footer class="rodape"><div><span>${esc(EMPRESA.RAZAO)} · CNPJ ${esc(EMPRESA.CNPJ)}</span><span>${esc(EMPRESA.ENDERECO)}</span>
<a href="mailto:${esc(EMPRESA.CONTATO)}">${esc(EMPRESA.CONTATO)}</a><a href="/privacidade">Política de privacidade</a></div></footer>
</body></html>`;
}

type Def = { rotulo: string; attrs: string; dica?: string };
const CAMPOS: Record<Exclude<Campo, 'uf'>, Def> = {
  nome: { rotulo: 'Nome completo', attrs: 'autocomplete="name" maxlength="100" autocapitalize="words"' },
  email: { rotulo: 'E-mail', attrs: 'type="email" autocomplete="email" inputmode="email" maxlength="120" autocapitalize="off" spellcheck="false"', dica: 'O acesso ao treinamento chega neste e-mail.' },
  celular: { rotulo: 'Celular com DDD', attrs: 'type="tel" autocomplete="tel-national" inputmode="tel" maxlength="20" placeholder="(44) 99999-8888"' },
  cpf: { rotulo: 'CPF', attrs: 'inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00"', dica: 'Necessário para a nota fiscal e o envio.' },
  cep: { rotulo: 'CEP', attrs: 'inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000"', dica: '' },
  rua: { rotulo: 'Rua', attrs: 'autocomplete="address-line1" maxlength="120"' },
  numero: { rotulo: 'Número', attrs: 'maxlength="10"' },
  complemento: { rotulo: 'Complemento <small>(opcional)</small>', attrs: 'autocomplete="address-line2" maxlength="60" placeholder="Apto, bloco, sala"' },
  bairro: { rotulo: 'Bairro', attrs: 'autocomplete="address-level3" maxlength="80"' },
  cidade: { rotulo: 'Cidade', attrs: 'autocomplete="address-level2" maxlength="80"' },
};

// Ordem dos campos na tela (o Estado vem logo após o CEP): o foco vai para o primeiro erro visível.
const ORDEM: Campo[] = ['nome', 'email', 'celular', 'cpf', 'cep', 'uf', 'rua', 'numero', 'complemento', 'bairro', 'cidade'];

function paginaCompra(f: URLSearchParams, erros: Partial<Record<Campo, string>> = {}): string {
  const primeiro = ORDEM.find((k) => erros[k]);
  const pe = (k: Campo, dica?: string) => `${erros[k] ? `<p class="erro" id="e-${k}">${esc(erros[k])}</p>` : ''}${dica !== undefined ? `<p class="dica" id="d-${k}"${k === 'cep' ? ' aria-live="polite"' : ''}>${dica}</p>` : ''}`;
  const campo = (k: Exclude<Campo, 'uf'>) => {
    const d = CAMPOS[k], ds = [erros[k] ? `e-${k}` : '', d.dica !== undefined ? `d-${k}` : ''].filter(Boolean).join(' ');
    return `<div><label for="${k}">${d.rotulo}</label><input id="${k}" name="${k}" ${d.attrs}${k === 'complemento' ? '' : ' required'} value="${esc(f.get(k) ?? '')}"${erros[k] ? ' aria-invalid="true"' : ''}${ds ? ` aria-describedby="${ds}"` : ''}${primeiro === k ? ' autofocus' : ''}>${pe(k, d.dica)}</div>`;
  };
  const uf = f.get('uf') ?? '';
  const selUf = `<div><label for="uf">Estado</label><select id="uf" name="uf" autocomplete="address-level1" required${erros.uf ? ' aria-invalid="true" aria-describedby="e-uf"' : ''}${primeiro === 'uf' ? ' autofocus' : ''}>
<option value="">UF</option>${UFS.map((u) => `<option${u === uf ? ' selected' : ''}>${u}</option>`).join('')}</select>${pe('uf')}</div>`;
  const ocultos = ['visitante', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
    .map((k) => `<input type="hidden" name="${k}" value="${esc((f.get(k) ?? '').slice(0, 120))}">`).join('');
  const resumo = Object.keys(erros).length ? `<p class="aviso" role="alert">Confira ${Object.keys(erros).length > 1 ? 'os campos marcados' : 'o campo marcado'} abaixo.</p>` : '';
  const valor = INFINITEPAY.precoCentavos;

  return moldura('Finalizar compra', `<main>
<section class="oferta" aria-labelledby="t-oferta">
  <div class="prod"><img src="/img/livro-lideranca-inteligente.jpg" alt="Livro Liderança Inteligente, de Valmer Albuquerque" width="84" height="120">
  <div><h1 id="t-oferta">Liderança Inteligente</h1><p>Livro físico + treinamento Líder na Prática + 3 materiais</p></div></div>
  <div class="valor">${preco(valor)}<small>à vista</small></div>
  <p class="formas">ou em até 12x no cartão · Pix</p>
  <ul class="itens">
    <li>${OK}<span><b>Frete grátis</b> para todo o Brasil. O livro é enviado após 10 dias da compra, com código de rastreio.</span></li>
    <li>${OK}<span><b>Acesso ao treinamento</b> Líder na Prática e aos 3 materiais após a confirmação do pagamento.</span></li>
    <li>${OK}<span><b>Garantia de 7 dias:</b> não gostou, devolvemos seu dinheiro.</span></li>
  </ul>
</section>
<section class="cartao" aria-labelledby="t-dados">
  <h2 id="t-dados">Seus dados para entrega</h2>${resumo}
  <form id="compra" method="post" action="/comprar" novalidate class="grade">
    ${campo('nome')}${campo('email')}<div class="lin">${campo('celular')}${campo('cpf')}</div>
    <div class="lin">${campo('cep')}${selUf}</div>${campo('rua')}
    <div class="lin">${campo('numero')}${campo('complemento')}</div><div class="lin">${campo('bairro')}${campo('cidade')}</div>
    ${ocultos}
    <button class="enviar" type="submit">IR PARA O PAGAMENTO</button>
    <p class="seguro">Pagamento seguro pela InfinitePay. Ao continuar, você concorda com a <a href="/privacidade">política de privacidade</a>.
    <a href="/privacidade" class="js-preferencias">Preferências de cookies</a></p>
  </form>
</section></main>
<script>
(function(){
  var f=document.getElementById('compra'),b=f.querySelector('.enviar'),aviso=document.getElementById('d-cep');
  function por(n,v){var el=f.elements[n];if(el.dataset.auto||(!el.value&&v)){el.value=v||'';el.dataset.auto=v?'1':''}}
  f.elements.cep.addEventListener('input',function(){
    var d=this.value.replace(/\\D/g,'');if(d.length!==8)return;
    aviso.textContent='Buscando o endereço...';
    fetch('https://viacep.com.br/ws/'+d+'/json/').then(function(r){return r.json()}).then(function(j){
      if(j.erro)throw 0;por('rua',j.logradouro);por('bairro',j.bairro);por('cidade',j.localidade);por('uf',j.uf);
      aviso.textContent='';(f.elements.rua.value?f.elements.numero:f.elements.rua).focus();
    }).catch(function(){aviso.textContent='Não encontramos este CEP. Preencha o endereço abaixo.'});
  });
  f.addEventListener('submit',function(){try{f.elements.visitante.value=localStorage.getItem('lv_id')||''}catch(e){}b.disabled=true;b.textContent='Indo para o pagamento...'});
  addEventListener('pageshow',function(){b.disabled=false;b.textContent='IR PARA O PAGAMENTO'});
})();
</script>
<script src="/consentimento.js" defer></script>
<script src="/t.js" defer></script>`, PIXEL_TAG);
}

const mensagem = (titulo: string, corpo: string, extra = '') => moldura(titulo, `<main><section class="cartao msg"><h1>${titulo}</h1>${corpo}</section></main>`, extra);

const paginaFalha = (nsu: string) => mensagem('Não conseguimos abrir o pagamento',
  `<p>A plataforma de pagamento não respondeu agora. Seus dados estão guardados: é só tentar de novo, sem preencher tudo outra vez.</p>
<form method="post" action="/comprar/tentar"><input type="hidden" name="pedido" value="${esc(nsu)}"><button class="bt" type="submit">Tentar de novo</button></form>
<p>Se continuar, escreva para <a href="mailto:${esc(EMPRESA.CONTATO)}">${esc(EMPRESA.CONTATO)}</a> informando o pedido ${esc(nsu)}.</p>`);

// Volta da InfinitePay. Atualiza a cada 5 s por até ~1 min enquanto o pagamento não confirma.
function paginaObrigado(p: Pedido | undefined, q: URLSearchParams, t: number): string {
  if (!p) return mensagem('Pedido não encontrado', `<p>Não encontramos este pedido. Se você já pagou, fique tranquilo: escreva para <a href="mailto:${esc(EMPRESA.CONTATO)}">${esc(EMPRESA.CONTATO)}</a>.</p>`);
  const nome = esc(p.nome.split(' ')[0]);
  if (p.status === 'CANCELADO') return mensagem('Pedido cancelado', `<p>Este pedido foi cancelado. Dúvidas: <a href="mailto:${esc(EMPRESA.CONTATO)}">${esc(EMPRESA.CONTATO)}</a> (pedido ${esc(p.orderNsu)}).</p>`);
  if (p.status !== 'AGUARDANDO_PAGAMENTO') return mensagem(`Pagamento confirmado, ${nome}!`,
    `<p>Obrigado pela compra. O acesso ao treinamento Líder na Prática e aos 3 materiais chega no seu e-mail.</p>
<p>O livro é enviado após 10 dias, com frete grátis, e o código de rastreio também vai por e-mail.</p><p>Pedido ${esc(p.orderNsu)}</p>`,
    // Purchase da Meta: só com pagamento confirmado e só se o comprador aceitou os cookies (consentimento.js).
    `${PIXEL_TAG}<script>window.LV_COMPRA=${JSON.stringify({ id: p.orderNsu, valor: p.valorCentavos / 100 }).replaceAll('<', '\\u003c')}</script>
<script src="/consentimento.js" defer></script>`);
  if (t >= 12) return mensagem('Estamos confirmando seu pagamento',
    `<p>${nome}, a confirmação está demorando um pouco mais que o normal (no Pix e no cartão costuma ser imediata). Você receberá o e-mail de acesso assim que o pagamento for confirmado.</p><p>Pedido ${esc(p.orderNsu)}</p>`);
  const prox = new URLSearchParams({ order_nsu: p.orderNsu, t: String(t + 1) });
  for (const k of ['slug', 'transaction_nsu']) { const v = param(q, k); if (v) prox.set(k, v); }
  return mensagem('Estamos confirmando seu pagamento',
    `<p role="status">${nome}, só um instante: estamos confirmando seu pagamento com a InfinitePay. Esta página atualiza sozinha.</p><p>Pedido ${esc(p.orderNsu)}</p>`,
    `<meta http-equiv="refresh" content="5;url=/obrigado?${esc(prox.toString())}">`);
}

// ---------- rotas ----------
async function irParaPagamento(res: http.ServerResponse, p: Pedido) {
  if (p.checkoutUrl) return ir(res, p.checkoutUrl);
  try {
    const url = await criarLink(INFINITEPAY, p);
    await mudar(p.id, em('AGUARDANDO_PAGAMENTO'), { checkoutUrl: url }, 'sistema', 'link de pagamento criado');
    return ir(res, url);
  } catch (e) {
    const msg = (e as Error).name === 'TimeoutError' ? 'InfinitePay /links não respondeu em 10 s' : erroSemDados(e);
    console.error(`checkout ${p.orderNsu}: ${msg}`);
    await anotar(p.id, 'sistema', 'falha ao criar link de pagamento', msg.slice(0, 200));
    return html(res, 502, paginaFalha(p.orderNsu));
  }
}

async function comprar(req: http.IncomingMessage, res: http.ServerResponse) {
  if (!mesmaOrigem(req)) return fim(res, 403, 'Origem inválida');
  if (limitado(ipDe(req))) return html(res, 429, mensagem('Muitas tentativas', '<p>Aguarde alguns minutos e tente de novo.</p>'));
  const corpo = await lerCorpo(req, 8192);
  if (corpo === null) return fim(res, 413, 'Formulário grande demais');
  const form = new URLSearchParams(corpo);
  const { dados, erros } = validarCompra(form);
  if (!dados) return html(res, 422, paginaCompra(form, erros), req);
  let p: Pedido;
  try {
    p = await criarPedido({ ...dados, pagina: NOME_PAGINA, valorCentavos: INFINITEPAY.precoCentavos });
  } catch (e) {
    console.error('checkout: falha ao gravar o pedido:', erroSemDados(e)); // nunca o erro cru: ele traz os dados do comprador
    return html(res, 503, mensagem('Não conseguimos registrar seu pedido', '<p>Tivemos uma falha momentânea. Volte e tente de novo em alguns instantes.</p>'));
  }
  return irParaPagamento(res, p);
}

async function tentarDeNovo(req: http.IncomingMessage, res: http.ServerResponse) {
  if (!mesmaOrigem(req)) return fim(res, 403, 'Origem inválida');
  if (limitado(ipDe(req))) return html(res, 429, mensagem('Muitas tentativas', '<p>Aguarde alguns minutos e tente de novo.</p>'));
  const p = await porNsu(new URLSearchParams((await lerCorpo(req, 512)) ?? '').get('pedido') ?? '');
  if (!p) return html(res, 404, paginaObrigado(undefined, new URLSearchParams(), 0));
  if (p.status !== 'AGUARDANDO_PAGAMENTO') return ir(res, `/obrigado?order_nsu=${p.orderNsu}`);
  return irParaPagamento(res, p);
}

// Sem assinatura: só grava slug/nsu e responde 200 na hora; quem confirma de verdade é o payment_check, fora da resposta.
async function webhook(req: http.IncomingMessage, res: http.ServerResponse) {
  const corpo = await lerCorpo(req, 16384);
  let b: Record<string, unknown>;
  try { b = JSON.parse(corpo ?? ''); if (!b || typeof b !== 'object') throw 0; } catch { return fim(res, 400, 'JSON inválido'); }
  const nsu = typeof b.order_nsu === 'string' ? b.order_nsu : '';
  const p = await porNsu(nsu);
  if (!p) return fim(res, 400, 'Pedido inexistente');
  const tx = ID.test(String(b.transaction_nsu ?? '')) ? String(b.transaction_nsu) : null;
  const slug = ID.test(String(b.invoice_slug ?? '')) ? String(b.invoice_slug) : null;
  const recibo = reciboOk(b.receipt_url) ? b.receipt_url : null;
  const pendente = p.status === 'AGUARDANDO_PAGAMENTO' && tx && slug;
  // Grava só o primeiro aviso: avisos com valores alternados não reescrevem nem enchem a trilha (a dica segue para o payment_check).
  if (pendente && !p.transactionNsu && !p.invoiceSlug) {
    await mudar(p.id, and(em('AGUARDANDO_PAGAMENTO'), isNull(P.transactionNsu), isNull(P.invoiceSlug)),
      { transactionNsu: tx, invoiceSlug: slug, ...(recibo ? { comprovanteUrl: recibo } : {}) }, 'sistema', 'aviso da InfinitePay recebido');
  }
  fim(res, 200, 'ok');
  // Pedido cancelado também é checado: pagamento pelo link antigo vira alerta no histórico (reembolsar ou reativar).
  if ((pendente || p.status === 'CANCELADO') && tx && slug) setImmediate(() => confirmarPagamento(nsu, { slug, transactionNsu: tx, receiptUrl: recibo })
    .catch((e) => console.error(`confirmação ${nsu}:`, erroSemDados(e))));
}

async function obrigado(req: http.IncomingMessage, res: http.ServerResponse, q: URLSearchParams) {
  const nsu = q.get('order_nsu') ?? '';
  let p = await porNsu(nsu);
  if (p?.status === 'AGUARDANDO_PAGAMENTO' || p?.status === 'CANCELADO') {
    // receipt_url do navegador não é aceito: os parâmetros do redirect só disparam o payment_check (o comprovante vem do webhook).
    await confirmarPagamento(nsu, { slug: param(q, 'slug'), transactionNsu: param(q, 'transaction_nsu') })
      .catch((e) => console.error(`confirmação ${nsu}:`, erroSemDados(e)));
    p = await porNsu(nsu);
  }
  return html(res, p ? 200 : 404, paginaObrigado(p, q, Math.min(Number(q.get('t')) || 0, 99)), req);
}

// No GET só passam visitante e UTMs: link de terceiro não pré-preenche nome, CPF nem endereço de entrega.
const soCampanha = (q: URLSearchParams) => new URLSearchParams(
  ['visitante', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].flatMap((k) => (q.has(k) ? [[k, q.get(k)!]] : [])));

// true = a rota é do checkout (respondida aqui).
export async function rotaCheckout(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  const r = url.pathname, m = req.method;
  if (r !== '/comprar' && r !== '/comprar/tentar' && r !== '/obrigado' && r !== '/api/infinitepay/webhook') return false;
  if (!INFINITEPAY.handle) { if (r === '/comprar' && m === 'GET') ir(res, '/'); else fim(res, 404, 'Checkout desligado'); return true; }
  if (r === '/comprar' && m === 'GET') html(res, 200, paginaCompra(soCampanha(url.searchParams)), req);
  else if (r === '/comprar' && m === 'POST') await comprar(req, res);
  else if (r === '/comprar/tentar' && m === 'POST') await tentarDeNovo(req, res);
  else if (r === '/api/infinitepay/webhook' && m === 'POST') await webhook(req, res);
  else if (r === '/obrigado' && m === 'GET') await obrigado(req, res, url.searchParams);
  else fim(res, 405, 'Método não permitido');
  return true;
}
