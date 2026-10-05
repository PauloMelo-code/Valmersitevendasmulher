const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const ICONE = {
  usuario: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  cadeado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  alerta: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
};
const svg = (nome: keyof typeof ICONE, tam = 18) =>
  `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[nome]}</svg>`;

export function renderLogin(opcoes: { erro?: string; usuario?: string; desligado?: boolean } = {}): string {
  const { erro, usuario = '', desligado } = opcoes;
  const msg = desligado ? 'Painel desligado. Defina PAINEL_SENHA (12+ caracteres) no Easypanel e faça o deploy.' : erro;
  const aviso = msg ? `<div class="msg" role="alert">${svg('alerta')}<span>${esc(msg)}</span></div>` : '';
  const ano = new Date().getFullYear();

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#08132B"><title>Entrar · Painel Liderança Inteligente</title>
<link rel="icon" href="/img/livro-lideranca-inteligente.jpg">
<link rel="preload" as="image" href="/img/cinco-mulheres-profissionais-em-um-ambiente-corpor.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=Montserrat:wght@700;800&display=swap" rel="stylesheet">
<style>
:root{--navy:#08132B;--navy-2:#0C1A3A;--campo:#0A1733;--borda:rgba(212,168,85,.16);--gold:#D4A855;--gold-hi:#F0D798;--gold-lo:#A87B2A;
  --txt:#F6F2EA;--mut:#93A0BD;--erro:#F4A796;--ease:cubic-bezier(.2,.7,.2,1)}
*{box-sizing:border-box}
html,body{margin:0;background:var(--navy);color:var(--txt);font:15px/1.55 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.tela{min-height:100vh;min-height:100dvh;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}

/* ---------- lado da imagem ---------- */
.arte{position:relative;overflow:hidden;isolation:isolate;display:flex;flex-direction:column;justify-content:space-between;padding:48px 56px}
.arte img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 18%;z-index:-2;
  filter:saturate(.85) contrast(1.05);animation:zoom 18s var(--ease) both}
.arte::before{content:"";position:absolute;inset:0;z-index:-1;
  background:linear-gradient(180deg,rgba(8,19,43,.55) 0%,rgba(8,19,43,.1) 30%,rgba(8,19,43,.55) 62%,rgba(8,19,43,.97) 100%),
             linear-gradient(90deg,rgba(8,19,43,0) 55%,rgba(8,19,43,.75) 85%,#08132B 100%)}
.marca{display:flex;align-items:center;gap:12px;font:400 20px/1 'Bebas Neue',sans-serif;letter-spacing:3px;color:var(--txt)}
.marca i{width:28px;height:1px;background:var(--gold)}
.marca b{font-weight:400;color:var(--gold)}
.titulo{max-width:560px}
.selo{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border:1px solid rgba(212,168,85,.4);border-radius:999px;
  background:rgba(8,19,43,.45);backdrop-filter:blur(8px);font:600 11px Inter,sans-serif;letter-spacing:2px;color:var(--gold-hi);margin-bottom:20px}
.selo::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--gold)}
h2{margin:0;font:400 clamp(48px,5.4vw,86px)/.9 'Bebas Neue',sans-serif;letter-spacing:.5px;text-shadow:0 4px 30px rgba(0,0,0,.35)}
h2 em{font-style:normal;background:linear-gradient(90deg,var(--gold-lo),var(--gold-hi) 45%,var(--gold));-webkit-background-clip:text;background-clip:text;color:transparent}
.numeros{display:flex;gap:28px;margin-top:28px;padding-top:22px;border-top:1px solid rgba(255,255,255,.14)}
.numeros div{font-size:13px;color:#C7CFDF;line-height:1.3}
.numeros b{display:block;font:400 34px/1 'Bebas Neue',sans-serif;color:var(--gold);letter-spacing:.5px;margin-bottom:4px}

/* ---------- lado do formulário ---------- */
.lado{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 32px;overflow:hidden;
  background:radial-gradient(45% 40% at 55% 45%,rgba(212,168,85,.09),transparent 70%),radial-gradient(60% 45% at 100% 100%,rgba(22,58,126,.4),transparent 70%),var(--navy)}
.lado::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
  background-size:44px 44px;mask-image:radial-gradient(70% 60% at 50% 45%,#000,transparent)}
.cartao{position:relative;width:100%;max-width:440px;padding:44px 40px 32px;border-radius:24px;
  background:linear-gradient(180deg,rgba(19,38,80,.72),rgba(10,23,51,.78));border:1px solid var(--borda);backdrop-filter:blur(18px);
  box-shadow:0 40px 80px -20px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);animation:sobe .8s .1s var(--ease) both}
.cartao::before{content:"";position:absolute;top:-1px;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,var(--gold-hi),transparent)}
.eyebrow{font:600 11px Inter,sans-serif;letter-spacing:2.5px;color:var(--gold);text-transform:uppercase}
h1{margin:8px 0 8px;font:800 30px/1.15 Montserrat,sans-serif;letter-spacing:-.3px}
.sub{margin:0 0 28px;color:var(--mut)}
.msg{display:flex;gap:10px;align-items:flex-start;margin:0 0 20px;padding:12px 14px;border-radius:12px;font-size:14px;
  background:rgba(244,167,150,.08);border:1px solid rgba(244,167,150,.3);color:var(--erro);animation:treme .4s}
.msg svg{flex:none;margin-top:1px}
label{display:block;margin:0 0 8px;font-size:13px;font-weight:600;color:#C7CFDF}
.campo{margin-bottom:20px}
.entrada{position:relative}
.entrada>svg{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--mut);transition:color .2s;pointer-events:none}
input{width:100%;height:54px;padding:0 48px 0 46px;border-radius:14px;border:1px solid rgba(147,160,189,.22);background:var(--campo);color:var(--txt);
  font:500 15px Inter,sans-serif;transition:border-color .2s,box-shadow .2s,background .2s}
input::placeholder{color:#5D6B8A}
input:hover{border-color:rgba(212,168,85,.35)}
input:focus{outline:none;border-color:var(--gold);background:#0C1B3D;box-shadow:0 0 0 4px rgba(212,168,85,.14)}
.entrada:focus-within>svg{color:var(--gold)}
input:-webkit-autofill{-webkit-text-fill-color:var(--txt);-webkit-box-shadow:0 0 0 40px var(--campo) inset;caret-color:var(--txt)}
.olho{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:42px;height:42px;border:0;border-radius:10px;background:transparent;
  color:var(--mut);cursor:pointer;display:grid;place-items:center;transition:color .2s,background .2s}
.olho:hover,.olho:focus-visible{color:var(--gold-hi);background:rgba(212,168,85,.1);outline:none}
.olho[aria-pressed=true]{color:var(--gold)}
.caps{display:none;margin-top:8px;font-size:12px;color:var(--gold-hi)}.caps.on{display:block}
.entrar{position:relative;overflow:hidden;width:100%;height:56px;margin-top:6px;border:0;border-radius:14px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:10px;color:#0A1430;font:800 14px Montserrat,sans-serif;letter-spacing:1.5px;
  background:linear-gradient(135deg,var(--gold-lo),var(--gold) 40%,var(--gold-hi) 75%,var(--gold));
  box-shadow:0 14px 34px -12px rgba(212,168,85,.7),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .2s var(--ease),box-shadow .2s}
.entrar::after{content:"";position:absolute;inset:0;transform:translateX(-120%);
  background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%)}
.entrar:hover{transform:translateY(-2px);box-shadow:0 20px 40px -12px rgba(212,168,85,.8),inset 0 1px 0 rgba(255,255,255,.35)}
.entrar:hover::after{transform:translateX(120%);transition:transform .9s var(--ease)}
.entrar:active{transform:translateY(0)}
.entrar:focus-visible{outline:2px solid var(--gold-hi);outline-offset:3px}
.entrar .seta{transition:transform .2s}.entrar:hover .seta{transform:translateX(4px)}
.entrar[disabled]{cursor:wait;opacity:.85;transform:none}
.giro{display:none;width:18px;height:18px;border-radius:50%;border:2px solid rgba(10,20,48,.25);border-top-color:#0A1430;animation:gira .7s linear infinite}
.entrar.carregando .giro{display:block}.entrar.carregando .seta{display:none}
.rodape{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:28px;padding-top:20px;border-top:1px solid rgba(147,160,189,.14);font-size:12.5px;color:var(--mut)}
.rodape span{display:inline-flex;align-items:center;gap:6px}.rodape svg{color:var(--gold)}
.rodape a{color:var(--gold-hi);text-decoration:none}.rodape a:hover{text-decoration:underline}
.copy{position:relative;margin-top:22px;font-size:12px;color:#55617E}

@keyframes sobe{from{opacity:0;transform:translateY(18px)}}
@keyframes zoom{from{transform:scale(1.08)}}
@keyframes gira{to{transform:rotate(360deg)}}
@keyframes treme{20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}

@media (max-width:960px){
  .tela{grid-template-columns:minmax(0,1fr)}
  .arte{min-height:340px;padding:28px 24px 72px;justify-content:space-between}
  .arte::before{background:linear-gradient(180deg,rgba(8,19,43,.5) 0%,rgba(8,19,43,.2) 35%,rgba(8,19,43,.98) 100%)}
  h2{font-size:44px}.numeros{display:none}
  .lado{padding:0 16px 40px;justify-content:flex-start;overflow:visible}
  .cartao{margin-top:-48px;padding:32px 24px 24px}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
</style></head><body>
<div class="tela">
<aside class="arte">
  <img src="/img/cinco-mulheres-profissionais-em-um-ambiente-corpor.jpg" alt="" fetchpriority="high">
  <div class="marca"><i></i>LIDERANÇA <b>INTELIGENTE</b></div>
  <div class="titulo">
    <div class="selo">PAINEL DA CAMPANHA</div>
    <h2>Chegou a vez das mulheres <em>liderarem.</em></h2>
    <div class="numeros"><div><b>+30 mil</b>profissionais formados</div><div><b>22 anos</b>formando líderes</div><div><b>6 obras</b>publicadas</div></div>
  </div>
</aside>
<main class="lado">
  <form class="cartao" method="post" action="/painel/entrar" novalidate>
    <div class="eyebrow">Área restrita</div>
    <h1>Bem-vindo de volta</h1>
    <p class="sub">Entre para acompanhar visitas, cliques e o resultado de cada campanha.</p>
    ${aviso}
    <div class="campo"><label for="usuario">Usuário</label>
      <div class="entrada">${svg('usuario')}<input id="usuario" name="usuario" autocomplete="username" placeholder="Seu usuário" required value="${esc(usuario)}" ${usuario ? '' : 'autofocus'}></div></div>
    <div class="campo"><label for="senha">Senha</label>
      <div class="entrada">${svg('cadeado')}<input id="senha" name="senha" type="password" autocomplete="current-password" placeholder="••••••••••••" required ${usuario ? 'autofocus' : ''}>
        <button type="button" class="olho" aria-label="Mostrar senha" aria-pressed="false">${svg('olho', 20)}</button></div>
      <div class="caps" role="status">Caps Lock está ativado</div></div>
    <button type="submit" class="entrar"${desligado ? ' disabled' : ''}><span class="txt">ENTRAR NO PAINEL</span><span class="seta" aria-hidden="true">→</span><span class="giro" aria-hidden="true"></span></button>
    <div class="rodape"><span>${svg('escudo', 15)}Conexão protegida</span><a href="/">Ver página de vendas ↗</a></div>
  </form>
  <div class="copy">© ${ano} Grupo Impacto Educacional · Liderança Inteligente</div>
</main>
</div>
<script>
var o=document.querySelector('.olho'),s=document.getElementById('senha'),c=document.querySelector('.caps');
o.addEventListener('click',function(){var v=s.type==='password';s.type=v?'text':'password';o.setAttribute('aria-pressed',v);o.setAttribute('aria-label',v?'Ocultar senha':'Mostrar senha');s.focus()});
['keydown','keyup'].forEach(function(t){s.addEventListener(t,function(e){c.classList.toggle('on',!!(e.getModifierState&&e.getModifierState('CapsLock')))})});
document.querySelector('form').addEventListener('submit',function(e){var b=e.target.querySelector('.entrar');b.disabled=true;b.classList.add('carregando');b.querySelector('.txt').textContent='ENTRANDO'});
</script>
</body></html>`;
}
