const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderLogin(opcoes: { erro?: string; usuario?: string; desligado?: boolean } = {}): string {
  const { erro, usuario = '', desligado } = opcoes;
  const aviso = desligado
    ? '<p class="msg" role="alert">Painel desligado. Defina <b>PAINEL_SENHA</b> (12+ caracteres) no Easypanel e faça o deploy.</p>'
    : erro ? `<p class="msg" role="alert">${esc(erro)}</p>` : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Entrar · Painel Liderança Inteligente</title>
<link rel="icon" href="/img/livro-lideranca-inteligente.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=Montserrat:wght@700;800&display=swap" rel="stylesheet">
<style>
:root{--navy:#08132B;--navy2:#0F1E3F;--line:#1F3263;--gold:#D4A855;--gold-hi:#F0D798;--gold-lo:#B8892F;--txt:#F4F1EA;--mut:#93A0BD;--err:#F2A38F}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--navy);color:var(--txt);font:16px/1.5 Inter,system-ui,sans-serif;display:grid;grid-template-columns:1.05fr .95fr}
.arte{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:48px;
  background:radial-gradient(120% 80% at 20% 10%,rgba(212,168,85,.22),transparent 60%),linear-gradient(160deg,#0B1A3A,#08132B 70%)}
.arte::after{content:"";position:absolute;inset:auto -20% -30% auto;width:70%;aspect-ratio:1;border-radius:50%;
  background:radial-gradient(circle,rgba(212,168,85,.18),transparent 65%);pointer-events:none}
.marca{font:400 22px/1 'Bebas Neue',sans-serif;letter-spacing:2px;color:var(--gold)}
.livro{align-self:center;width:min(360px,70%);border-radius:6px;transform:rotate(-4deg);
  box-shadow:0 30px 60px rgba(0,0,0,.45),0 0 0 1px rgba(212,168,85,.25);animation:sobe .9s cubic-bezier(.2,.7,.2,1) both}
.frase{font:400 46px/0.95 'Bebas Neue',sans-serif;letter-spacing:.5px;margin:0;max-width:440px}
.frase em{font-style:normal;background:linear-gradient(90deg,var(--gold-lo),var(--gold-hi),var(--gold));-webkit-background-clip:text;background-clip:text;color:transparent}
.lado{display:flex;align-items:center;justify-content:center;padding:40px 24px}
form{width:100%;max-width:380px;animation:sobe .7s .1s cubic-bezier(.2,.7,.2,1) both}
h1{font:800 26px/1.2 Montserrat,sans-serif;margin:0 0 6px}
.sub{color:var(--mut);margin:0 0 28px}
label{display:block;font-size:13px;font-weight:600;color:var(--mut);margin:0 0 6px;letter-spacing:.3px}
.campo{margin-bottom:18px}.entrada{position:relative}
input{width:100%;height:52px;padding:0 16px;border-radius:10px;border:1px solid var(--line);background:var(--navy2);color:var(--txt);
  font:500 16px Inter,sans-serif;transition:border-color .2s,box-shadow .2s}
input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 4px rgba(212,168,85,.18)}
.olho{position:absolute;right:6px;top:6px;width:40px;height:40px;border:0;border-radius:8px;background:transparent;color:var(--mut);cursor:pointer;display:grid;place-items:center}
.olho:hover,.olho:focus-visible{color:var(--gold);outline:none;background:rgba(212,168,85,.08)}
#senha{padding-right:52px}
button[type=submit]{width:100%;height:54px;margin-top:8px;border:0;border-radius:999px;cursor:pointer;color:var(--navy);
  font:800 15px Montserrat,sans-serif;letter-spacing:1px;background:linear-gradient(90deg,var(--gold-lo),var(--gold),var(--gold-hi),var(--gold));
  background-size:200% 100%;transition:background-position .4s,transform .15s,box-shadow .2s}
button[type=submit]:hover{background-position:100% 0;box-shadow:0 10px 30px rgba(212,168,85,.35);transform:translateY(-1px)}
button[type=submit]:focus-visible{outline:2px solid var(--gold-hi);outline-offset:3px}
button[disabled]{opacity:.7;cursor:wait;transform:none}
.msg{margin:0 0 20px;padding:12px 14px;border-radius:10px;background:rgba(242,163,143,.1);border:1px solid rgba(242,163,143,.35);color:var(--err);font-size:14px}
.rodape{margin-top:28px;color:var(--mut);font-size:13px;text-align:center}
.rodape a{color:var(--gold);text-decoration:none}
@keyframes sobe{from{opacity:0;transform:translateY(16px)}}
@media (max-width:860px){
  body{grid-template-columns:1fr;grid-template-rows:auto 1fr}
  .arte{padding:24px;flex-direction:row;align-items:center;justify-content:flex-start;gap:18px}
  .livro{width:84px;transform:rotate(-4deg);order:-1}
  .frase{font-size:30px}.arte .marca{display:none}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head><body>
<aside class="arte" aria-hidden="true">
  <div class="marca">LIDERANÇA INTELIGENTE · PAINEL</div>
  <img class="livro" src="/img/livro-lideranca-inteligente-de-valmer-albuquerque.jpg" alt="">
  <p class="frase">Quem mede, <em>lidera</em> melhor.</p>
</aside>
<main class="lado">
  <form method="post" action="/painel/entrar" novalidate>
    <h1>Painel de desempenho</h1>
    <p class="sub">Acompanhe visitas, cliques e campanhas da página de vendas.</p>
    ${aviso}
    <div class="campo"><label for="usuario">Usuário</label>
      <input id="usuario" name="usuario" autocomplete="username" required value="${esc(usuario)}" ${usuario ? '' : 'autofocus'}></div>
    <div class="campo"><label for="senha">Senha</label>
      <div class="entrada"><input id="senha" name="senha" type="password" autocomplete="current-password" required ${usuario ? 'autofocus' : ''}>
      <button type="button" class="olho" aria-label="Mostrar senha" aria-pressed="false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
      </button></div></div>
    <button type="submit"${desligado ? ' disabled' : ''}>ENTRAR NO PAINEL</button>
    <p class="rodape"><a href="/">← Voltar para a página de vendas</a></p>
  </form>
</main>
<script>
var o=document.querySelector('.olho'),s=document.getElementById('senha');
o.addEventListener('click',function(){var v=s.type==='password';s.type=v?'text':'password';o.setAttribute('aria-pressed',v);o.setAttribute('aria-label',v?'Ocultar senha':'Mostrar senha');s.focus()});
document.querySelector('form').addEventListener('submit',function(e){var b=e.target.querySelector('[type=submit]');b.disabled=true;b.textContent='ENTRANDO...'});
</script>
</body></html>`;
}
