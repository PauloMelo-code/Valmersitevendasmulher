/* Consentimento de cookies (LGPD): o Pixel da Meta só carrega depois do "Aceitar".
   O rastreio próprio do /painel (t.js) não usa cookie de terceiro e segue por legítimo interesse
   (descrito em /privacidade). A escolha fica no localStorage; "Preferências de cookies" reabre. */
(function () {
  var CHAVE = 'lv_consentimento';
  var pixel = window.LV_PIXEL;

  function ler() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function gravar(v) { try { localStorage.setItem(CHAVE, v); } catch (e) { /* aba anônima: vale só nesta visita */ } }

  function carregarPixel() {
    if (!pixel || window.fbq) return;
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', pixel);
    window.fbq('track', 'PageView');
    window.fbq('track', 'ViewContent', { content_name: 'Liderança Inteligente', value: 97, currency: 'BRL' });
  }

  var barra;
  function fechar() { if (barra) { barra.remove(); barra = null; } }
  function escolher(v) { gravar(v); fechar(); if (v === 'aceito') carregarPixel(); }

  function mostrar() {
    if (barra || !pixel) return;
    barra = document.createElement('div');
    barra.setAttribute('role', 'region');
    barra.setAttribute('aria-label', 'Preferências de cookies');
    barra.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:50;max-width:560px;margin:0 auto;background:#0E1E3F;color:#E6EBF5;border:1px solid #2A3B5F;border-radius:10px;padding:16px 18px;font:14px/1.5 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)';
    barra.innerHTML = '<p style="margin:0 0 12px">Usamos cookies da Meta para medir os anúncios desta campanha. Você escolhe. ' +
      '<a href="/privacidade" style="color:#D4A855">Política de privacidade</a>.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">' +
      '<button type="button" data-v="recusado" style="min-height:44px;padding:0 18px;border-radius:6px;border:1px solid #2A3B5F;background:transparent;color:#E6EBF5;font:600 14px Inter,sans-serif;cursor:pointer">Recusar</button>' +
      '<button type="button" data-v="aceito" style="min-height:44px;padding:0 18px;border-radius:6px;border:0;background:#D4A855;color:#08132B;font:700 14px Inter,sans-serif;cursor:pointer">Aceitar</button></div>';
    barra.addEventListener('click', function (e) { var v = e.target.getAttribute && e.target.getAttribute('data-v'); if (v) escolher(v); });
    document.body.appendChild(barra);
  }

  window.lvPreferencias = function () { try { localStorage.removeItem(CHAVE); } catch (e) { /* nada */ } mostrar(); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.js-preferencias');
    if (a) { e.preventDefault(); window.lvPreferencias(); }
  });

  var atual = ler();
  if (atual === 'aceito') carregarPixel();
  else if (atual !== 'recusado') mostrar();
})();
