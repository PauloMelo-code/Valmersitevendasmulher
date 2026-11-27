/* Emoções Inteligentes | interações da página
   Cópia do main.js com os textos desta página. Mesmo destino de inscrições e mesmo pixel. */
(function () {
  'use strict';

  /* ================= CONFIGURAÇÃO =================
     FORM_ENDPOINT: endereço que recebe as inscrições (veja o README).
     Enquanto estiver vazio, a página fica em MODO DEMONSTRAÇÃO e
     nunca diz que a inscrição foi concluída. */
  var CONFIG = {
    FORM_ENDPOINT: 'https://lider-de-impacto.lideresdeimpacto.com.br/api/paginas/inscricao/palestra-maringa',
    EVENT_START: '2026-12-14T19:00:00-03:00',
    EVENT_TITLE: 'Palestra Emoções Inteligentes, com Valmer Albuquerque',
    EVENT_PLACE: 'Família Vida Nova, Rua Estados Unidos, Av. Colombo, 2073, Jardim América, Maringá, PR, 87045-010',
    HEADLINE_B: 'Descubra como usar suas emoções como aliadas para o seu crescimento pessoal e profissional.',
    PIXEL_ID: '1181979381174003' // mesmo pixel das páginas do livro
  };
  /* ================================================ */

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  /* Eventos de medição: só disparam se GA4 ou Meta Pixel existirem na página */
  function track(name, data) {
    try {
      if (window.gtag) window.gtag('event', name, data || {});
      if (window.fbq) {
        var map = { view_content: 'ViewContent', begin_registration: 'InitiateCheckout', complete_registration: 'CompleteRegistration' };
        if (map[name]) window.fbq('track', map[name]);
      }
    } catch (e) {}
  }

  /* Pixel da Meta só depois do "Aceitar" (LGPD), mesma regra das páginas do livro.
     autoConfig desligado: a correspondência automática leria e-mail e WhatsApp do formulário. */
  var CHAVE = 'lv_consentimento', barra = null;
  function lerEscolha() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function carregarPixel() {
    if (window.fbq) return;
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('set', 'autoConfig', false, CONFIG.PIXEL_ID);
    window.fbq('init', CONFIG.PIXEL_ID);
    window.fbq('track', 'PageView');
  }
  function mostrarAviso() {
    if (barra) return;
    barra = document.createElement('div');
    barra.className = 'cookies';
    barra.setAttribute('role', 'region');
    barra.setAttribute('aria-label', 'Preferências de cookies');
    barra.innerHTML = '<p>Usamos cookies da Meta para medir a divulgação desta palestra. Você escolhe. <a href="privacidade.html">Aviso de Privacidade</a>.</p>' +
      '<div><button type="button" class="btn btn--ghost btn--sm" data-v="recusado">Recusar</button>' +
      '<button type="button" class="btn btn--sm" data-v="aceito">Aceitar</button></div>';
    barra.addEventListener('click', function (e) {
      var v = e.target.getAttribute && e.target.getAttribute('data-v');
      if (!v) return;
      try { localStorage.setItem(CHAVE, v); } catch (er) { /* aba anônima: vale só nesta visita */ }
      barra.remove(); barra = null;
      if (v === 'aceito') { carregarPixel(); track('view_content'); }
    });
    document.body.appendChild(barra);
  }
  var cookiesBtn = $('#cookiesBtn');
  if (cookiesBtn) cookiesBtn.addEventListener('click', function () { try { localStorage.removeItem(CHAVE); } catch (e) {} mostrarAviso(); });
  var escolha = lerEscolha();
  if (escolha === 'aceito') carregarPixel();
  else if (escolha !== 'recusado') mostrarAviso();

  track('view_content');

  /* Teste A/B de headline: abra a página com ?h=b para ver a versão B */
  if (/[?&]h=b\b/.test(location.search)) { $('#headline').textContent = CONFIG.HEADLINE_B; }

  /* Entrada suave dos blocos */
  var rv = $$('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    rv.forEach(function (el) { io.observe(el); });
  } else { rv.forEach(function (el) { el.classList.add('in'); }); }

  /* Barra de progresso e topo */
  var bar = $('#progressBar'), top = $('#topbar'), ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(scrollY / h, 1) : 0) + ')';
      top.classList.toggle('is-solid', scrollY > 40);
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* Contagem regressiva real até o início da palestra */
  var target = new Date(CONFIG.EVENT_START).getTime();
  var cd = { d: $('#cd-d'), h: $('#cd-h'), m: $('#cd-m'), s: $('#cd-s') };
  var daysLeft = $('#daysLeft');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function put(el, v) {
    if (el.textContent === v) return;
    el.textContent = v; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
  }
  function tickCd() {
    var diff = Math.max(0, target - Date.now()), s = Math.floor(diff / 1000);
    var d = Math.floor(s / 86400);
    put(cd.d, String(d)); put(cd.h, pad(Math.floor(s % 86400 / 3600))); put(cd.m, pad(Math.floor(s % 3600 / 60))); put(cd.s, pad(s % 60));
    if (daysLeft) daysLeft.textContent = diff === 0 ? 'Segunda-feira' : d > 1 ? 'Segunda-feira. Faltam ' + d + ' dias.' : d === 1 ? 'Segunda-feira. Falta 1 dia.' : 'Segunda-feira. É hoje.';
    if (diff === 0) { var c = $('.count__label'); if (c) c.textContent = 'A palestra já começou'; clearInterval(timer); }
  }
  var timer = setInterval(tickCd, 1000); tickCd();

  /* Números das credenciais contando ao aparecer */
  if ('IntersectionObserver' in window && !reduce) {
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; io2.unobserve(e.target);
        var end = +e.target.dataset.count, t0 = performance.now();
        (function step(t) {
          var p = Math.min((t - t0) / 1100, 1);
          e.target.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) { io2.observe(el); });
  }

  /* Botão fixo do celular: aparece depois do botão do topo e some perto do formulário */
  var sticky = $('#sticky'), heroCta = $('#heroCta'), formSec = $('#inscricao'), seen = { hero: true, form: false };
  function syncSticky() {
    if (document.activeElement === sticky) return;
    var on = !seen.hero && !seen.form;
    sticky.classList.toggle('is-on', on);
    sticky.setAttribute('aria-hidden', on ? 'false' : 'true');
    sticky.tabIndex = on ? 0 : -1;
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { seen.hero = es[0].isIntersecting; syncSticky(); }).observe(heroCta);
    new IntersectionObserver(function (es) { seen.form = es[0].isIntersecting; syncSticky(); }, { rootMargin: '0px 0px -10% 0px' }).observe(formSec);
  }

  /* Cliques nos botões de inscrição: rola e foca o primeiro campo */
  $$('a[href="#inscricao"]').forEach(function (a) {
    a.addEventListener('click', function () {
      track('begin_registration', { origem: a.dataset.cta || '' });
      setTimeout(function () {
        var n = $('#nome');
        if (n && !$('#form').hidden) { n.focus({ preventScroll: true }); n.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }
      }, reduce ? 0 : 700);
    });
  });

  /* Botão para pausar todas as animações em loop */
  var mb = $('#motionBtn');
  if (mb) mb.addEventListener('click', function () {
    var off = document.documentElement.classList.toggle('no-motion');
    mb.setAttribute('aria-pressed', off ? 'true' : 'false');
    mb.textContent = off ? 'Retomar animações' : 'Pausar animações';
  });

  /* ================= FORMULÁRIO ================= */
  var form = $('#form'), btn = $('#submit'), msg = $('#formMsg'), done = $('#done');
  var demo = !CONFIG.FORM_ENDPOINT;

  var whats = $('#whats');
  whats.addEventListener('input', function () {
    var d = whats.value.replace(/\D/g, '').slice(0, 11), o = '';
    if (d.length) o = '(' + d.slice(0, 2);
    if (d.length > 2) o += ') ' + d.slice(2, d.length > 10 ? 7 : 6);
    if (d.length > 6) o += '-' + d.slice(d.length > 10 ? 7 : 6);
    whats.value = o;
  });

  var rules = {
    nome: function (v) { return v.trim().split(/\s+/).filter(function (p) { return p.length > 1; }).length >= 2 ? '' : 'Informe seu nome e sobrenome.'; },
    whats: function (v) { var d = v.replace(/\D/g, ''); return (d.length === 10 || d.length === 11) && d[0] !== '0' ? '' : 'Informe o WhatsApp com DDD, por exemplo (44) 99999-9999.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Informe um e-mail válido.'; }
  };
  function check(id) {
    var el = $('#' + id), e = rules[id](el.value);
    var box = $('#e-' + id); if (box.textContent !== e) box.textContent = e;
    el.setAttribute('aria-invalid', e ? 'true' : 'false');
    el.closest('.f').classList.toggle('bad', !!e);
    return !e;
  }
  Object.keys(rules).forEach(function (id) {
    $('#' + id).addEventListener('blur', function () { if (this.value) check(id); });
    $('#' + id).addEventListener('input', function () { if (this.closest('.f').classList.contains('bad')) check(id); });
  });

  function showDone() {
    form.hidden = true; done.hidden = false; done.focus();
    var s = new Date(CONFIG.EVENT_START).toISOString().replace(/[-:]|\.\d{3}/g, '');
    $('#invite').href = 'https://wa.me/?text=' + encodeURIComponent('Vou à palestra Emoções Inteligentes, com Valmer Albuquerque, dia 14 de dezembro, às 19h, em Maringá. É para toda a família, a entrada é 1 kg de alimento não perecível e as vagas são limitadas. Vem comigo? A inscrição é por aqui: ' + location.origin + location.pathname);
    $('#gcal').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(CONFIG.EVENT_TITLE) +
      '&dates=' + s + '/' + s + '&location=' + encodeURIComponent(CONFIG.EVENT_PLACE) +
      '&details=' + encodeURIComponent('Entrada solidária: leve 1 kg de alimento não perecível.');
  }
  $('#ics').addEventListener('click', function () {
    var s = new Date(CONFIG.EVENT_START).toISOString().replace(/[-:]|\.\d{3}/g, '');
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lideranca Inteligente//PT-BR', 'BEGIN:VEVENT',
      'UID:emocoes-inteligentes-20261214@palestra', 'DTSTAMP:' + s, 'DTSTART:' + s,
      'SUMMARY:' + CONFIG.EVENT_TITLE, 'LOCATION:' + CONFIG.EVENT_PLACE.replace(/,/g, '\\,'),
      'DESCRIPTION:Entrada solidária: leve 1 kg de alimento não perecível.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'palestra-emocoes-inteligentes.ics'; document.body.appendChild(a); a.click(); a.remove();
  });

  var sending = false;
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (sending) return;
    msg.textContent = ''; msg.className = 'formmsg';
    var ok = ['nome', 'whats', 'email'].map(check);
    if (ok.indexOf(false) > -1) { $('#' + ['nome', 'whats', 'email'][ok.indexOf(false)]).focus(); return; }
    if ($('#site').value) { msg.textContent = 'Não foi possível enviar. Recarregue a página e preencha os campos manualmente.'; return; } /* armadilha para robôs */

    var data = {
      nome: $('#nome').value.trim(),
      whatsapp: whats.value.replace(/\D/g, ''),
      email: $('#email').value.trim().toLowerCase(),
      perfil: $('#perfil').value,
      marketing: $('#marketing').checked,
      origem: location.href,
      enviado_em: new Date().toISOString()
    };

    if (demo) {
      msg.className = 'formmsg is-info';
      msg.textContent = 'Modo demonstração: os dados estão corretos, mas a inscrição NÃO foi registrada porque o formulário ainda não está conectado.';
      return;
    }
    try { if (localStorage.getItem('li_inscrito') === data.email) { showDone(); return; } } catch (e) {}

    sending = true; btn.classList.add('is-loading'); btn.setAttribute('aria-disabled', 'true');
    msg.className = 'formmsg is-info'; msg.textContent = 'Enviando sua inscrição…';
    $('.btn__t', btn).textContent = 'Enviando';
    fetch(CONFIG.FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (j) {
        msg.textContent = ''; msg.className = 'formmsg';
        if (!j || j.ok !== true) throw new Error((j && j.erro) || 'recusado');
        try { localStorage.setItem('li_inscrito', data.email); } catch (e) {}
        if (j.duplicado) { $('#doneTitle').textContent = 'Você já está inscrito'; $('#doneText').textContent = 'Encontramos sua inscrição anterior. Seu lugar continua reservado e nossa equipe vai entrar em contato com você.'; }
        track('complete_registration');
        showDone();
      })
      .catch(function (e) {
        msg.className = 'formmsg';
        msg.textContent = e.message && e.message !== 'http' && e.message !== 'recusado' && !/fetch|network|json/i.test(e.message)
          ? e.message
          : 'Não foi possível registrar sua inscrição agora. Confira sua conexão e tente de novo em instantes.';
      })
      .then(function () {
        sending = false; btn.classList.remove('is-loading'); btn.removeAttribute('aria-disabled');
        $('.btn__t', btn).textContent = 'Confirmar minha inscrição';
      });
  });
})();

/* Emoções Inteligentes | efeitos só desta página */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Frase de destaque: uma palavra por vez */
  var t = document.querySelector('[data-words]');
  if (t) {
    var full = t.textContent.trim(), n = 0;
    t.setAttribute('aria-label', full);
    var out = document.createDocumentFragment();
    Array.prototype.forEach.call(t.childNodes, function (node) {
      var em = node.nodeType === 1;
      (node.textContent || '').split(/\s+/).filter(Boolean).forEach(function (w) {
        var s = document.createElement('span');
        s.className = 'w' + (em ? ' w--em' : ''); s.textContent = w; s.style.setProperty('--w', n++); s.setAttribute('aria-hidden', 'true');
        out.appendChild(s); out.appendChild(document.createTextNode(' '));
      });
    });
    t.textContent = ''; t.appendChild(out);
  }

  /* Celular: carrosséis de arrastar, com bolinhas e um empurrão para mostrar que desliza */
  Array.prototype.forEach.call(document.querySelectorAll('.car'), function (car) {
    var box = car.nextElementSibling;
    if (!box || !box.classList.contains('swipe')) return;
    var small = window.matchMedia('(max-width: 619px)');
    function light(k) { for (var z = 0; z < car.children.length; z++) car.children[z].classList.toggle('is-lit', z === k); }
    var dots = box.querySelector('.swipe__dots'), items = car.children, on = -1, hinted = false;
    for (var i = 0; i < items.length; i++) dots.appendChild(document.createElement('i'));
    function sync() {
      var best = 0, min = 1e9, left = car.getBoundingClientRect().left;
      for (var k = 0; k < items.length; k++) { var d = Math.abs(items[k].getBoundingClientRect().left - left - 20); if (d < min) { min = d; best = k; } }
      if (car.scrollLeft + car.clientWidth >= car.scrollWidth - 4) best = items.length - 1;
      if (best !== on) { on = best; for (var q = 0; q < dots.children.length; q++) dots.children[q].classList.toggle('on', q === best); if (small.matches) light(best); }
    }
    var tk = false;
    car.addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(function () { sync(); tk = false; }); } }, { passive: true });
    ['touchstart', 'pointerdown', 'wheel'].forEach(function (ev) { car.addEventListener(ev, function () { box.classList.add('is-used'); }, { passive: true }); });
    sync();
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting || hinted || car.scrollWidth <= car.clientWidth + 4) return;
        hinted = true; io.disconnect();
        if (document.documentElement.classList.contains('no-motion')) return;
        setTimeout(function () {
          if (box.classList.contains('is-used')) return;
          car.style.scrollSnapType = 'none';
          car.scrollTo({ left: 72, behavior: 'smooth' });
          setTimeout(function () { car.scrollTo({ left: 0, behavior: 'smooth' }); setTimeout(function () { car.style.scrollSnapType = ''; }, 600); }, 650);
        }, 500);
      }, { threshold: 0.6 });
      io.observe(car);
    }
  });

  /* Computador e tablet: a luz passa de cartão em cartão enquanto a seção está na tela */
  if (!reduce && 'IntersectionObserver' in window) {
    Array.prototype.forEach.call(document.querySelectorAll('.who.car, .pillars.car'), function (list) {
      var cards = list.children, idx = -1, timer = null, hover = false;
      function step() {
        if (hover || window.matchMedia('(max-width: 619px)').matches || document.documentElement.classList.contains('no-motion')) return;
        idx = (idx + 1) % cards.length;
        for (var z = 0; z < cards.length; z++) cards[z].classList.toggle('is-lit', z === idx);
      }
      list.addEventListener('pointerenter', function () { hover = true; if (!window.matchMedia('(max-width: 619px)').matches) for (var z = 0; z < cards.length; z++) cards[z].classList.remove('is-lit'); });
      list.addEventListener('pointerleave', function () { hover = false; });
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { if (!timer) { step(); timer = setInterval(step, 1700); } }
        else { clearInterval(timer); timer = null; }
      }, { threshold: 0.35 }).observe(list);
    });
  }

  /* Cartões: inclinam de leve e a luz segue o cursor (só com mouse) */
  if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    Array.prototype.forEach.call(document.querySelectorAll('.card'), function (c) {
      c.addEventListener('pointermove', function (e) {
        if (document.documentElement.classList.contains('no-motion')) return;
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%');
        c.style.setProperty('--ry', ((x - .5) * 7) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 7) + 'deg');
      });
      c.addEventListener('pointerenter', function () { c.style.transitionDelay = '0s'; });
      c.addEventListener('pointerleave', function () { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
  }
})();
