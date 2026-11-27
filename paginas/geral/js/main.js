/* Liderança Inteligente · comportamento da página.
   Regra geral: sem JavaScript ou sem GSAP, todo o conteúdo e o preço continuam visíveis. */
(function () {
  "use strict";

  var C = window.LI_CONFIG || {};
  var FIM = Date.parse(window.DEADLINE);
  var doc = document, html = doc.documentElement;
  var reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var ok = function (v) { return !!v && String(v).indexOf("{{") !== 0; };
  var br = function (n) { return Math.round(n).toLocaleString("pt-BR"); };
  var expirado = Date.now() > FIM;

  /* =========================================================
     ANIM-13 · troca automática de preço depois do prazo
     ========================================================= */
  function aplicarExpirado() {
    expirado = true;
    html.classList.add("expired");
    $$("[data-bf-only]").forEach(function (el) { el.remove(); });
    $$("[data-price]").forEach(function (el) { el.textContent = "R$ " + C.PRECO_CHEIO; });
    var hv = $("#heroVideo");
    if (hv && !ok(C.VIDEO_HERO_URL_DEPOIS)) { var vv = $("video", hv); if (vv) { vv.pause(); vv.remove(); } hv.classList.remove("is-vertical"); var vb = $("#videoBtn"); if (vb) vb.remove(); }
    ligarCheckout();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  /* =========================================================
     Checkout: link direto + UTMs da página
     ========================================================= */
  function ligarCheckout() {
    var base = expirado ? C.CHECKOUT_URL_497 : C.CHECKOUT_URL_147;
    var marcador = expirado ? "{{CHECKOUT_URL_497}}" : "{{CHECKOUT_URL_147}}";
    var href = marcador;
    if (ok(base)) {
      try {
        var u = new URL(base, location.href);
        new URLSearchParams(location.search).forEach(function (v, k) { if (!u.searchParams.has(k)) u.searchParams.set(k, v); });
        href = u.toString();
      } catch (e) { href = base; }
    }
    $$(".js-buy").forEach(function (a) { a.setAttribute("href", href); });
  }

  /* =========================================================
     Pixel da Meta, Google Tag e consentimento (LGPD)
     O pixel só carrega depois do "Aceitar", como na página atual.
     ========================================================= */
  var CHAVE = "lv_consentimento", fila = [], viuFerramentas = false;
  function ler() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function gravar(v) { try { localStorage.setItem(CHAVE, v); } catch (e) {} }
  function preco() { return expirado ? C.PRECO_CHEIO : C.PRECO_BF; }

  function evento(nomeMeta, nomeGoogle, extra) {
    var dados = { content_name: "Liderança Inteligente", value: preco(), currency: "BRL" };
    for (var k in extra) dados[k] = extra[k];
    if (!window.fbq && !window.gtag) { fila.push([nomeMeta, nomeGoogle, extra]); return; }
    if (window.fbq) window.fbq("track", nomeMeta, dados);
    if (window.gtag) window.gtag("event", nomeGoogle, dados);
  }

  function carregarTags() {
    if (ok(C.PIXEL_ID) && !window.fbq) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, doc, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", C.PIXEL_ID);
      window.fbq("track", "PageView");
    }
    if (ok(C.GTAG_ID) && !window.gtag) {
      var s = doc.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(C.GTAG_ID); doc.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date()); window.gtag("config", C.GTAG_ID);
    }
    var pend = fila; fila = [];
    pend.forEach(function (e) { evento(e[0], e[1], e[2]); });
  }

  var aviso;
  function mostrarAviso() {
    if (aviso || (!ok(C.PIXEL_ID) && !ok(C.GTAG_ID))) return;
    aviso = doc.createElement("div");
    aviso.className = "lv-cookies"; aviso.setAttribute("role", "region"); aviso.setAttribute("aria-label", "Preferências de cookies");
    aviso.innerHTML = '<p>Usamos cookies para medir os anúncios desta campanha. Você escolhe. <a href="/privacidade">Política de privacidade</a>.</p>' +
      '<div><button type="button" data-v="recusado">Recusar</button><button type="button" data-v="aceito">Aceitar</button></div>';
    aviso.addEventListener("click", function (e) {
      var v = e.target.getAttribute && e.target.getAttribute("data-v"); if (!v) return;
      gravar(v); aviso.remove(); aviso = null; if (v === "aceito") carregarTags();
    });
    doc.body.appendChild(aviso);
  }
  doc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".js-preferencias");
    if (a) { e.preventDefault(); try { localStorage.removeItem(CHAVE); } catch (er) {} mostrarAviso(); }
  });

  /* Rastreio próprio da página atual (alimenta /painel). Só no domínio publicado (lider, Maringá...), nunca no localhost. */
  var emProducao = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var visitante = (function () {
    var id; try { id = localStorage.getItem("lv_id"); if (!id) { id = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24); localStorage.setItem("lv_id", id); } } catch (e) { id = Math.random().toString(36).slice(2); }
    return id;
  })();
  function painel(t, extra) {
    if (!emProducao) return;
    var q = new URLSearchParams(location.search);
    var d = { t: t, v: visitante, o: q.get("utm_source"), c: q.get("utm_campaign"), m: q.get("utm_medium"), a: q.get("utm_content"), j: q.get("utm_term"), r: doc.referrer };
    for (var k in d) if (!d[k]) delete d[k];
    for (k in extra) d[k] = extra[k];
    var corpo = JSON.stringify(d);
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/evento", corpo))) fetch("/api/evento", { method: "POST", body: corpo, keepalive: true }).catch(function () {});
  }

  doc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".js-buy");
    if (!a) return;
    var sec = a.closest("section");
    var bloco = a.getAttribute("data-block") || (sec && sec.id) || "pagina";
    evento("InitiateCheckout", "begin_checkout", { content_category: bloco });
    painel("click", { b: bloco });
    if (a.getAttribute("href").indexOf("{{") === 0) {
      e.preventDefault();
      console.warn("[Liderança Inteligente] Link de checkout ainda não preenchido em js/config.js (" + a.getAttribute("href") + "). Clique no bloco: " + bloco);
    }
  });

  /* =========================================================
     ANIM-02 · cronômetro real, com data fixa
     ========================================================= */
  var cds = $$("[data-countdown]").map(function (el) {
    var partes = [["d", "DIAS"], ["h", "HORAS"], ["m", "MIN"], ["s", "SEG"]], refs = {};
    el.innerHTML = "";
    partes.forEach(function (p, i) {
      if (i) { var sep = doc.createElement("span"); sep.className = "cd-s"; sep.textContent = ":"; el.appendChild(sep); }
      var u = doc.createElement("span"); u.className = "cd-u";
      u.innerHTML = '<span class="cd-n"><b>0</b><b>0</b></span><span class="cd-l">' + p[1] + "</span>";
      el.appendChild(u); refs[p[0]] = $$("b", u);
    });
    return { el: el, refs: refs };
  });
  function pinta(digs, valor) {
    var t = (valor < 10 ? "0" : "") + valor;
    for (var i = 0; i < 2; i++) {
      var b = digs[i], ch = t.charAt(t.length - 2 + i);
      if (b.textContent === ch) continue;
      b.textContent = ch;
      if (!reduz) { b.classList.remove("flip"); void b.offsetWidth; b.classList.add("flip"); }
    }
  }
  var relogio;
  function tique() {
    var ms = FIM - Date.now();
    if (ms <= 0) { clearInterval(relogio); if (!expirado || $("[data-bf-only]")) aplicarExpirado(); return; }
    var s = Math.floor(ms / 1000), v = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
    var final48 = ms < 48 * 3600 * 1000;
    cds.forEach(function (c) {
      for (var k in v) pinta(c.refs[k], v[k]);
      c.el.classList.toggle("is-final", final48);
    });
  }

  /* =========================================================
     Interações que não dependem do GSAP
     ========================================================= */
  function interacoes() {
    /* ANIM-05 · autoavaliação */
    var caixas = $$("#quiz input"), num = $("#quizNum"), res = $("#quizResult"), msg = $("#quizMsg"), faixa = "";
    var textos = {
      a: "Você está no caminho. O método vai acelerar o que você já faz bem.",
      b: "O problema não é esforço. É método. E método se aprende.",
      c: "Você está liderando no limite. Não é falta de capacidade. É falta de ferramenta."
    };
    function atualizaQuiz() {
      var n = caixas.filter(function (c) { return c.checked; }).length;
      num.textContent = n;
      if (!reduz) { num.classList.remove("pop"); void num.offsetWidth; num.classList.add("pop"); }
      var nova = n <= 2 ? "a" : n <= 6 ? "b" : "c";
      if (res.hidden && n > 0) {
        res.hidden = false; msg.textContent = textos[nova]; faixa = nova;
        if (window.gsap && !reduz) window.gsap.from(res, { opacity: 0, y: 14, duration: .45 });
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      } else if (nova !== faixa && !res.hidden) {
        faixa = nova; msg.classList.add("troca");
        setTimeout(function () { msg.textContent = textos[nova]; msg.classList.remove("troca"); }, reduz ? 0 : 250);
      }
    }
    caixas.forEach(function (c) { c.addEventListener("change", atualizaQuiz); });

    /* ANIM-06 · comparador dos dois líderes (desktop) */
    var duo = $("#duo"), range = $("#duoRange");
    if (duo && range) range.addEventListener("input", function () { duo.style.setProperty("--pos", range.value + "%"); });

    /* barra de urgência: rolagem suave até a oferta (em JS, para não brigar com o ScrollTrigger) */
    var urg = $("#urgencia");
    if (urg) urg.addEventListener("click", function (e) {
      var alvo = $("#oferta"); if (!alvo) return;
      e.preventDefault(); alvo.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
    });

    /* FAQ: uma aberta por vez */
    var itens = $$("#faqList .acc-item");
    itens.forEach(function (it, i) {
      var b = $("button", it), p = $(".acc-p", it);
      b.id = "faq-b" + i; p.id = "faq-p" + i; b.setAttribute("aria-controls", p.id); p.setAttribute("role", "region"); p.setAttribute("aria-labelledby", b.id);
      b.addEventListener("click", function () {
        var abrir = !it.classList.contains("aberto");
        itens.forEach(function (o) { o.classList.remove("aberto"); $("button", o).setAttribute("aria-expanded", "false"); });
        if (abrir) { it.classList.add("aberto"); b.setAttribute("aria-expanded", "true"); }
      });
    });

    /* vídeo do hero: a capa aparece na hora; o arquivo só carrega quando entra na tela ou no clique */
    var caixa = $("#heroVideo"), botao = $("#videoBtn"), video;
    var src = expirado ? C.VIDEO_HERO_URL_DEPOIS : C.VIDEO_HERO_URL;
    function montaVideo() {
      if (video || !ok(src)) return !!video;
      video = doc.createElement("video");
      video.muted = true; video.loop = true; video.playsInline = true; video.setAttribute("playsinline", ""); video.preload = "none";
      if (ok(C.VIDEO_HERO_POSTER)) video.poster = C.VIDEO_HERO_POSTER;
      video.setAttribute("aria-label", "Vídeo de apresentação da oferta Liderança Inteligente");
      video.src = src;
      if (ok(C.VIDEO_HERO_LEGENDAS)) { var tr = doc.createElement("track"); tr.kind = "captions"; tr.srclang = "pt-BR"; tr.label = "Português"; tr.src = C.VIDEO_HERO_LEGENDAS; tr.default = true; video.appendChild(tr); }
      caixa.insertBefore(video, botao);
      return true;
    }
    if (caixa && ok(src)) {
      if (C.VIDEO_HERO_VERTICAL) caixa.classList.add("is-vertical");
      montaVideo();
      if ("IntersectionObserver" in window && !reduz) {
        var ov = new IntersectionObserver(function (es) {
          if (!video) return;
          if (es[0].isIntersecting) { if (video.muted) video.play().catch(function () {}); }
          else if (video.muted) video.pause();
        }, { threshold: .35 });
        ov.observe(caixa);
      }
    } else if (botao) { botao.remove(); botao = null; }
    if (botao) botao.addEventListener("click", function () {
      if (!montaVideo()) { console.warn("[Liderança Inteligente] Vídeo do hero não preenchido em js/config.js."); return; }
      video.muted = false; video.loop = false; video.controls = true; video.currentTime = 0; video.play().catch(function () {});
      botao.hidden = true; botao.style.display = "none";
      evento("ViewContent", "video_start", { content_category: "video-hero" });
    });

    /* depoimentos: o vídeo só carrega no clique; tocar um pausa os outros */
    var deps = $$(".dep-video");
    deps.forEach(function (d, i) {
      var v = $("video", d), b = $(".dep-play", d);
      b.addEventListener("click", function () {
        v.controls = true; d.classList.add("tocando");
        v.play().catch(function () {});
        evento("ViewContent", "video_start", { content_category: "depoimento-" + (i + 1) });
      });
      v.addEventListener("play", function () { deps.forEach(function (o) { if (o !== d) $("video", o).pause(); }); });
    });
    /* carrossel do celular: bolinhas acompanham o arrasto */
    var trilho = $("#deps"), dots = $("#depsDots");
    if (trilho && dots) {
      var itens = $$(".dep", trilho);
      itens.forEach(function () { dots.appendChild(doc.createElement("i")); });
      var pontos = $$("i", dots), marcado = -1, tick = false;
      var marca = function () {
        tick = false;
        var meio = trilho.scrollLeft + trilho.clientWidth / 2, melhor = 0, dist = Infinity;
        itens.forEach(function (it, i) { var d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - meio); if (d < dist) { dist = d; melhor = i; } });
        if (melhor === marcado) return; marcado = melhor;
        pontos.forEach(function (p, i) { p.classList.toggle("on", i === melhor); });
      };
      trilho.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(marca); } }, { passive: true });
      marca();
    }

    /* barra fixa no celular: aparece depois do hero, some com a oferta na tela */
    var barra = $("#cta-mobile"), heroV = true, ofertaV = false;
    function barraOn() {
      var on = !heroV && !ofertaV;
      barra.classList.toggle("on", on); barra.setAttribute("aria-hidden", on ? "false" : "true");
      $("a", barra).tabIndex = on ? 0 : -1;
    }
    if (barra && "IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { heroV = es[0].isIntersecting; barraOn(); }).observe($("#hero"));
      new IntersectionObserver(function (es) { ofertaV = es[0].isIntersecting; barraOn(); }, { threshold: .08 }).observe($("#oferta"));
    }

    /* ViewContent ao chegar no bloco de ferramentas */
    if ("IntersectionObserver" in window) {
      var of = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting || viuFerramentas) return;
        viuFerramentas = true; of.disconnect();
        evento("ViewContent", "view_item", { content_category: "ferramentas" });
      }, { threshold: .05 });
      of.observe($("#ferramentas"));
    }

    /* painel próprio: visita, rolagem e saída */
    painel("view");
    var marcos = [25, 50, 75, 100], esperando = false;
    function rolou() {
      esperando = false;
      var h = html.scrollHeight - innerHeight, p = h > 0 ? scrollY / h * 100 : 100;
      while (marcos.length && p >= marcos[0] - 1) painel("scroll", { n: marcos.shift() });
    }
    addEventListener("scroll", function () { if (!esperando && marcos.length) { esperando = true; setTimeout(rolou, 150); } }, { passive: true });
    var t0 = Date.now(), saiu = false;
    function sair() { if (saiu) return; saiu = true; painel("sair", { n: Math.round((Date.now() - t0) / 1000) }); }
    addEventListener("pagehide", sair);
    doc.addEventListener("visibilitychange", function () { if (doc.visibilityState === "hidden") sair(); });
  }

  /* =========================================================
     Animações de rolagem (GSAP + ScrollTrigger)
     ========================================================= */
  function estadoFinal() {
    /* sem animação: tudo aceso e o medidor cheio */
    $$(".marco, .passo").forEach(function (el) { el.classList.add("on"); });
    var m = $("#meter"); if (m) { $("#meterNum").textContent = "1.032"; $("#meterFill").style.setProperty("--p", 1); }
  }

  function animacoes() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (reduz || !gsap || !ST) { estadoFinal(); return; }
    gsap.registerPlugin(ST);

    /* entradas simples */
    gsap.set("[data-reveal]", { opacity: 0, y: 24 });
    ST.batch("[data-reveal]", { start: "top 90%", once: true, onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: .6, stagger: .08, ease: "power2.out", overwrite: true }); } });

    /* ANIM-03 · contagem dos números */
    var extras = $$(".autoridade .num-x");
    gsap.set(extras, { opacity: 0 });
    $$("[data-count]").forEach(function (el) {
      var alvo = +el.getAttribute("data-count"), o = { v: 0 };
      el.textContent = "0";
      gsap.to(o, { v: alvo, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: ".nums", start: "top 85%", once: true },
        onUpdate: function () { el.textContent = Math.round(o.v); },
        onComplete: function () { gsap.to($$(".num-x", el.parentNode), { opacity: 1, duration: .4 }); } });
    });

    var mm = gsap.matchMedia();

    /* ANIM-06 · no celular, o lado frio perde saturação enquanto o dourado acende */
    mm.add("(max-width: 959px)", function () {
      gsap.from(".duo-cold", { opacity: 0, y: 30, duration: .6, scrollTrigger: { trigger: ".duo-cold", start: "top 85%", once: true } });
      gsap.from(".duo-gold", { opacity: 0, y: 30, duration: .6, scrollTrigger: { trigger: ".duo-gold", start: "top 85%", once: true } });
      gsap.fromTo(".duo-cold", { filter: "saturate(1) brightness(1)" }, { filter: "saturate(.15) brightness(.72)", ease: "none", scrollTrigger: { trigger: "#duo", start: "top 35%", end: "bottom 55%", scrub: .4 } });
      gsap.fromTo(".duo-gold", { "--acende": .2 }, { "--acende": 1.6, ease: "none", scrollTrigger: { trigger: "#duo", start: "top 35%", end: "bottom 55%", scrub: .4 } });
    });
    mm.add("(min-width: 960px)", function () {
      /* convite a arrastar: o divisor desliza até o meio uma vez */
      var duo = $("#duo"), range = $("#duoRange"), o = { p: 86 };
      gsap.to(o, { p: 50, duration: 1.4, ease: "power3.inOut", scrollTrigger: { trigger: duo, start: "top 65%", once: true },
        onStart: function () { duo.style.setProperty("--pos", "86%"); },
        onUpdate: function () { duo.style.setProperty("--pos", o.p + "%"); range.value = o.p; } });
    });

    /* ANIM-07 · trilha do método */
    var marcos = $$(".marco"), limites = [.03, .5, .97];
    gsap.fromTo(".trilha-fg", { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none",
      scrollTrigger: { trigger: "#trilha", start: "top 72%", end: "bottom 62%", scrub: .5,
        onUpdate: function (s) { marcos.forEach(function (m, i) { m.classList.toggle("on", s.progress >= limites[i]); }); } } });

    /* ANIM-08 · medidor de valor acumulado */
    var medidor = $("#meter"), mNum = $("#meterNum"), mFill = $("#meterFill"), mv = { v: 0 }, cards = $$(".tool");
    function mede(valor) {
      gsap.to(mv, { v: valor, duration: .8, ease: "power2.out", overwrite: true, onUpdate: function () { mNum.textContent = br(mv.v); } });
      mFill.style.setProperty("--p", valor / 1032);
      medidor.classList.remove("cheio");
      if (valor === 1032) { void medidor.offsetWidth; medidor.classList.add("cheio"); }
    }
    cards.forEach(function (card, i) {
      var acc = +card.getAttribute("data-acc"), antes = i ? +cards[i - 1].getAttribute("data-acc") : 0;
      ST.create({ trigger: card, start: "top 50%", onEnter: function () { mede(acc); }, onLeaveBack: function () { mede(antes); } });

      /* ANIM-09 · entrada dos cards */
      var tl = gsap.timeline({ scrollTrigger: { trigger: card, start: "top 84%", once: true } });
      tl.from($(".tool-media", card), { y: 40, rotate: 6, opacity: 0, duration: .7, ease: "power3.out" })
        .from($$(".tool-k, .tool-n, dl, .grade", card), { y: 18, opacity: 0, duration: .45, stagger: .06, ease: "power2.out" }, "-=.45")
        .from($(".acc", card), { opacity: 0, duration: .3 }, "-=.1")
        .from($(".tag", card), { scale: .9, opacity: 0, duration: .35, ease: "back.out(3)" }, "-=.15");
    });

    /* ANIM-10 · o recibo. Dispara uma única vez, com o recibo a 40% da tela. */
    var linhas = $$("#recibo .r-l"), total = $("#totalNum"), totalV = $(".r-total-v"), tv = { v: 0 };
    var depois = $(".rv-depois"), label = $(".rv-label"), precoEl = $(".rv-preco strong"), brilho = $(".rv-preco .glow");
    var finais = $$(".rv-eco, .rv-dia, .rv-parc");
    gsap.set(linhas, { opacity: 0, y: -10 });
    gsap.set([depois, label, precoEl].concat(finais).filter(Boolean), { opacity: 0 });
    gsap.set(totalV, { "--risco": 0 });
    total.textContent = "0";
    var rt = gsap.timeline({ scrollTrigger: { trigger: "#recibo", start: "top 60%", once: true } });
    rt.to(linhas, { opacity: 1, y: 0, duration: .28, stagger: .15, ease: "power1.out" })
      .to(tv, { v: 1032, duration: 1, ease: "power2.out", onUpdate: function () { total.textContent = br(tv.v); } }, .15 * (linhas.length - 1));
    if (depois) rt.fromTo(depois, { y: 12 }, { opacity: 1, y: 0, duration: .45 }, "+=.6");
    rt.to(totalV, { "--risco": 1, duration: .4, ease: "power2.inOut" }, "+=.4")
      .to(label, { opacity: 1, duration: .3 })
      .fromTo(precoEl, { scale: .6 }, { opacity: 1, scale: 1, duration: .7, ease: "back.out(1.8)" }, "-=.1")
      .fromTo(brilho, { opacity: .95, scale: .3 }, { opacity: 0, scale: 2.6, duration: 1.1, ease: "power2.out" }, "<")
      .fromTo(finais, { y: 10 }, { opacity: 1, y: 0, duration: .4, stagger: .14 }, "-=.6");

    /* ANIM-12 · linha do tempo pós-compra */
    var passos = $$(".passo"), fio = $("#passosFill");
    gsap.fromTo(fio, { "--p": 0 }, { "--p": 1, ease: "none",
      scrollTrigger: { trigger: "#passos", start: "top 70%", end: "bottom 60%", scrub: .5,
        onUpdate: function (s) { passos.forEach(function (p, i) { p.classList.toggle("on", s.progress > .001 && s.progress >= i / (passos.length - 1) - .02); }); } } });

    addEventListener("load", function () { ST.refresh(); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { ST.refresh(); });
  }

  /* =========================================================
     Partida
     ========================================================= */
  if (expirado) aplicarExpirado(); else ligarCheckout();
  tique(); relogio = setInterval(tique, 1000);
  interacoes();
  animacoes();

  var escolha = ler();
  if (escolha === "aceito") carregarTags();
  else if (escolha !== "recusado") mostrarAviso();
})();
