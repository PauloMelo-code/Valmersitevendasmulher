/* Rastreio próprio da página (alimenta /painel) + eventos do Pixel da Meta. */
(function () {
  var id;
  try {
    id = localStorage.getItem('lv_id');
    if (!id) { id = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24); localStorage.setItem('lv_id', id); }
  } catch (e) { id = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24); }

  var q = new URLSearchParams(location.search);
  var base = { v: id, o: q.get('utm_source'), c: q.get('utm_campaign'), m: q.get('utm_medium'), a: q.get('utm_content'), r: document.referrer };
  function enviar(t, extra) {
    var d = { t: t }, k;
    for (k in base) if (base[k]) d[k] = base[k];
    for (k in extra) d[k] = extra[k];
    var corpo = JSON.stringify(d);
    if (!(navigator.sendBeacon && navigator.sendBeacon('/api/evento', corpo)))
      fetch('/api/evento', { method: 'POST', body: corpo, keepalive: true }).catch(function () {});
  }
  function fb() { if (window.fbq) window.fbq.apply(null, arguments); }

  enviar('view');
  fb('track', 'ViewContent', { content_name: 'Liderança Inteligente', value: 97, currency: 'BRL' });

  /* repassa as UTMs da página para o checkout (a plataforma atribui a venda à campanha) */
  if (location.search) document.querySelectorAll('.js-checkout').forEach(function (a) {
    if (a.href.indexOf('http') !== 0 || a.getAttribute('href').charAt(0) === '#') return;
    var u = new URL(a.href);
    q.forEach(function (v, k) { if (!u.searchParams.has(k)) u.searchParams.set(k, v); });
    a.href = u.toString();
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.js-checkout');
    if (!a) return;
    enviar('click', { b: a.textContent.replace(/[→\s]+/g, ' ').trim() });
    fb('track', 'InitiateCheckout', { value: 97, currency: 'BRL' });
  });

  var marcos = [25, 50, 75, 100], ticking = false;
  function rolou() {
    ticking = false;
    var h = document.documentElement.scrollHeight - innerHeight;
    var p = h > 0 ? (scrollY / h) * 100 : 100;
    while (marcos.length && p >= marcos[0] - 1) enviar('scroll', { n: marcos.shift() });
    if (!marcos.length) removeEventListener('scroll', aoRolar);
  }
  function aoRolar() { if (!ticking) { ticking = true; setTimeout(rolou, 150); } }
  addEventListener('scroll', aoRolar, { passive: true });

  var t0 = Date.now(), saiu = false;
  function sair() { if (saiu) return; saiu = true; enviar('sair', { n: Math.round((Date.now() - t0) / 1000) }); }
  addEventListener('pagehide', sair);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sair(); });
})();
