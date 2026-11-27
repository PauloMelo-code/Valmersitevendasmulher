/* Programa Liderança Inteligente · comportamento da página.
   Regra geral: sem JavaScript ou sem GSAP, o conteúdo, o preço e o botão de compra continuam visíveis. */
(function () {
  "use strict";

  var C = window.LI_CONFIG || {}, L = window.LIQuiz;
  var doc = document, html = doc.documentElement;
  var reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var ok = function (v) { return !!v && String(v).indexOf("{{") !== 0; };
  var br = function (n) { return Math.round(n).toLocaleString("pt-BR"); };
  var COR = C.VARIANTE_COR || "verde";
  var PRECO = C.PRECO || 147;

  /* =========================================================
     Preço único e link do checkout (com UTMs, fbclid e gclid)
     ========================================================= */
  $$("[data-price]").forEach(function (el) { el.textContent = "R$ " + br(PRECO); });
  (function () {
    if (!ok(C.CHECKOUT_URL)) return;
    var href = C.CHECKOUT_URL;
    try {
      var u = new URL(C.CHECKOUT_URL, location.href);
      new URLSearchParams(location.search).forEach(function (v, k) { if (/^utm_|^fbclid$|^gclid$/.test(k) && !u.searchParams.has(k)) u.searchParams.set(k, v); });
      href = u.toString();
    } catch (e) {}
    $$(".js-buy").forEach(function (a) { a.setAttribute("href", href); });
  })();

  /* =========================================================
     Rastreio: Pixel e Google Tag só com consentimento (LGPD) + painel próprio
     ========================================================= */
  var CHAVE = "lv_consentimento", fila = [];
  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* custom = true usa fbq('trackCustom') */
  function evento(nomeMeta, nomeGoogle, dados, custom) {
    if (!window.fbq && !window.gtag) { fila.push([nomeMeta, nomeGoogle, dados, custom]); return; }
    if (window.fbq) window.fbq(custom ? "trackCustom" : "track", nomeMeta, dados);
    if (window.gtag) window.gtag("event", nomeGoogle, dados);
  }
  function carregarTags() {
    if (ok(C.PIXEL_ID) && !window.fbq) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, doc, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", C.PIXEL_ID); window.fbq("track", "PageView");
    }
    if (ok(C.GTAG_ID) && !window.gtag) {
      var s = doc.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(C.GTAG_ID); doc.head.appendChild(s);
      window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date()); window.gtag("config", C.GTAG_ID);
    }
    var pend = fila; fila = []; pend.forEach(function (e) { evento(e[0], e[1], e[2], e[3]); });
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
      gravar(CHAVE, v); aviso.remove(); aviso = null; if (v === "aceito") carregarTags();
    });
    doc.body.appendChild(aviso);
  }
  doc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".js-preferencias");
    if (a) { e.preventDefault(); try { localStorage.removeItem(CHAVE); } catch (er) {} mostrarAviso(); }
  });

  /* Painel próprio (/painel). Fora do localhost: a página de Maringá roda em outro domínio. Tipos novos: quiz_inicio, quiz_fim, quiz_cta. */
  var emProducao = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var visitante = (function () {
    var id = ler("lv_id");
    if (!id) { id = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24); gravar("lv_id", id); }
    return id;
  })();
  var enviados = [];
  function painel(t, extra) {
    var q = new URLSearchParams(location.search);
    var d = { t: t, v: visitante, cor: COR, o: q.get("utm_source"), c: q.get("utm_campaign"), m: q.get("utm_medium"), a: q.get("utm_content"), j: q.get("utm_term"), r: doc.referrer };
    for (var k in d) if (!d[k]) delete d[k];
    for (k in extra) d[k] = extra[k];
    enviados.push(d); window.__li_eventos = enviados; /* para conferência em teste */
    if (!emProducao) return;
    var corpo = JSON.stringify(d);
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/evento", corpo))) fetch("/api/evento", { method: "POST", body: corpo, keepalive: true }).catch(function () {});
  }

  /* todo botão de compra: InitiateCheckout com o bloco e a variante de cor */
  doc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".js-buy");
    if (!a) return;
    var bloco = a.getAttribute("data-block") || "pagina";
    evento("InitiateCheckout", "begin_checkout", { content_name: "Programa Liderança Inteligente", value: PRECO, currency: "BRL", content_category: bloco, variante_cor: COR });
    painel("click", { b: bloco, variante_cor: COR });
    if (bloco === "resultado_quiz") painel("quiz_cta", { variante_cor: COR });
  });

  /* =========================================================
     Quiz
     ========================================================= */
  var estado = null; /* {d: dimensão mais fraca, f: faixa} */

  function destacarItem(dim) {
    $$("#itens .item").forEach(function (t) { t.classList.remove("match"); var e = $(".match-tag", t); if (e) e.remove(); });
    if (dim == null || dim < 0) return;
    var alvo = $('#itens .item[data-dim="' + dim + '"]'); if (!alvo) return;
    alvo.classList.add("match");
    var tag = doc.createElement("span"); tag.className = "match-tag"; tag.textContent = "Indicado no seu resultado";
    alvo.insertBefore(tag, alvo.firstChild);
  }

  function quiz() {
    var lista = $("#situacoes"); if (!lista || !L) return;
    var perguntas = $$(":scope > li", lista).map(function (li) {
      var ops = $$("li[data-p]", li);
      return { grupo: +li.getAttribute("data-g"), texto: $(".sit-p", li).textContent, respostas: ops.map(function (o) { return o.textContent; }), pontos: ops.map(function (o) { return +o.getAttribute("data-p"); }) };
    });
    var N = perguntas.length;
    var intro = $("#qIntro"), form = $("#qForm"), res = $("#qResult"), campo = $("#qCampo"), escolhas = $("#qChoices"), prog = $("#qProg"), box = $("#quizBox");
    var i = 0, respostas = [], comecou = false, travado = false;

    function topo() { var y = box.getBoundingClientRect().top + scrollY - 16; if (Math.abs(scrollY - y) > 40) scrollTo({ top: y, behavior: reduz ? "auto" : "smooth" }); }

    function pergunta() {
      travado = false;
      var p = perguntas[i];
      $("#qCounter").textContent = "Situação " + (i + 1) + " de " + N;
      prog.setAttribute("aria-valuenow", i + 1); $("i", prog).style.width = ((i + 1) / N * 100) + "%";
      $("#qPrompt").textContent = p.texto;
      escolhas.innerHTML = "";
      p.respostas.forEach(function (txt, v) {
        var b = doc.createElement("button"); b.type = "button"; b.className = "choice"; b.textContent = txt;
        b.setAttribute("aria-pressed", respostas[i] === v ? "true" : "false");
        b.addEventListener("click", function () {
          if (travado) return; travado = true;
          if (!comecou) { comecou = true; painel("quiz_inicio"); evento("QuizInicio", "quiz_inicio", {}, true); }
          respostas[i] = v;
          $$(".choice", escolhas).forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
          setTimeout(avancar, 220); /* tocar na resposta avança sozinho */
        });
        escolhas.appendChild(b);
      });
      $("#qBack").style.visibility = i === 0 ? "hidden" : "visible";
      if (!reduz) { campo.classList.remove("entra"); void campo.offsetWidth; campo.classList.add("entra"); }
    }
    function avancar() { if (i === N - 1) { resultado(); return; } i++; pergunta(); $("#qPrompt").focus({ preventScroll: true }); }

    function conta(el, alvo) {
      if (reduz || !window.requestAnimationFrame) { el.textContent = alvo; return; }
      var t0 = null, dur = 800;
      (function passo(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(alvo * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(passo); })(performance.now());
    }

    function resultado() {
      var r = L.calcular(perguntas, respostas), fx = L.FAIXAS[r.faixa], foco = r.foco >= 0 ? L.DIMENSOES[r.foco] : null;
      form.hidden = true; res.hidden = false;
      $("#qScoreBox").hidden = !r.suficiente;
      $("#qTitle").textContent = fx.titulo; $("#qDesc").textContent = fx.texto;
      $("#qCount").textContent = r.respondidas + " de " + N + " situações respondidas";

      var barras = $("#qBars"); barras.innerHTML = ""; barras.hidden = !r.suficiente;
      if (r.suficiente) r.dimensoes.forEach(function (d, n) {
        var li = doc.createElement("li"); if (n === r.foco) li.className = "fraca";
        li.innerHTML = "<span></span><strong></strong><span class=\"q-bar\"><i></i></span>";
        li.children[0].textContent = d.nome; li.children[1].textContent = d.nota === null ? "Poucas respostas" : d.nota + "/100";
        var fio = $("i", li); fio.style.transitionDelay = (reduz ? 0 : .9 + n * .18) + "s";
        barras.appendChild(li);
        requestAnimationFrame(function () { requestAnimationFrame(function () { fio.style.width = (d.nota === null ? 0 : d.nota) + "%"; }); });
      });

      $("#qFoco").hidden = !foco;
      if (foco) {
        $("#qAtt").textContent = (r.nota === 100 ? "Para continuar praticando · " : "Por onde começar · ") + foco.nome;
        $("#qCons").textContent = r.nota < 100 ? foco.insight : ""; $("#qCons").hidden = r.nota === 100;
        $("#qEx").textContent = foco.pratica; $("#qCap").textContent = "No livro · " + foco.capitulo;
      }
      var frase = $("#buyFrase");
      frase.textContent = foco ? "O programa começa exatamente onde você mais precisa: " + foco.nome + "." : ""; frase.hidden = !foco;

      /* a nota sobe, as barras crescem em sequência e o cartão de compra entra por último */
      res.classList.remove("mostra"); void res.offsetWidth; res.classList.add("mostra");
      if (r.suficiente) conta($("#qScore"), r.nota);

      estado = r.suficiente ? { d: r.foco, f: r.faixa } : null;
      if (estado) gravar("li_quiz", JSON.stringify(estado)); else { try { localStorage.removeItem("li_quiz"); } catch (e) {} }
      destacarItem(estado ? estado.d : -1);
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();

      painel("quiz_fim", { n: r.nota, f: r.faixa, d: foco ? foco.nome : "", q: r.respondidas });
      evento("QuizConcluido", "quiz_concluido", { faixa: r.faixa, dimensao: foco ? foco.nome : "" }, true);
      $("#qTitle").focus({ preventScroll: true }); topo();
    }

    function comecar() { intro.hidden = true; res.hidden = true; form.hidden = false; pergunta(); }
    $("#qStart").addEventListener("click", function () { comecar(); $("#qPrompt").focus({ preventScroll: true }); });
    var hs = $("#heroStart");
    if (hs) hs.addEventListener("click", function (e) {
      e.preventDefault();
      if (res.hidden && form.hidden) comecar();
      topo();
      setTimeout(function () { (res.hidden ? $("#qPrompt") : $("#qTitle")).focus({ preventScroll: true }); }, reduz ? 0 : 500);
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    $("#qSkip").addEventListener("click", function () { respostas[i] = null; avancar(); });
    $("#qBack").addEventListener("click", function () { if (i > 0) { i--; pergunta(); $("#qPrompt").focus({ preventScroll: true }); } });
    $("#qReview").addEventListener("click", function () { i = 0; comecar(); topo(); });
    $("#qRestart").addEventListener("click", function () { respostas = []; i = 0; comecar(); topo(); });
    $$('.buy-mais a').forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); $("#ferramentas").scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" }); }); });
  }

  /* destaque guardado de uma visita anterior */
  try { var g = JSON.parse(ler("li_quiz") || "null"); if (g && typeof g.d === "number") { estado = g; destacarItem(g.d); } } catch (e) {}

  /* =========================================================
     Demais interações
     ========================================================= */
  function interacoes() {
    /* link "Conhecer o Programa" do topo */
    $$('a[href="#oferta"]').forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); $("#oferta").scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" }); }); });

    /* FAQ: uma aberta por vez */
    var itens = $$("#faqList .acc-item");
    itens.forEach(function (it, n) {
      var b = $("button", it), p = $(".acc-p", it);
      b.id = "faq-b" + n; p.id = "faq-p" + n; b.setAttribute("aria-controls", p.id); p.setAttribute("role", "region"); p.setAttribute("aria-labelledby", b.id);
      b.addEventListener("click", function () {
        var abrir = !it.classList.contains("aberto");
        itens.forEach(function (o) { o.classList.remove("aberto"); $("button", o).setAttribute("aria-expanded", "false"); });
        if (abrir) { it.classList.add("aberto"); b.setAttribute("aria-expanded", "true"); }
      });
    });

    /* depoimentos: o vídeo só carrega no toque; tocar um pausa os outros */
    var deps = $$(".dep-video");
    deps.forEach(function (d, n) {
      var v = $("video", d), b = $(".dep-play", d);
      b.addEventListener("click", function () {
        v.controls = true; d.classList.add("tocando"); v.play().catch(function () {});
        evento("ViewContent", "video_start", { content_category: "depoimento-" + (n + 1) });
      });
      v.addEventListener("play", function () { deps.forEach(function (o) { if (o !== d) $("video", o).pause(); }); });
    });
    var trilho = $("#deps"), dots = $("#depsDots");
    if (trilho && dots) {
      var cards = $$(".dep", trilho);
      cards.forEach(function () { dots.appendChild(doc.createElement("i")); });
      var pontos = $$("i", dots), marcado = -1, tick = false;
      var marca = function () {
        tick = false;
        var meio = trilho.scrollLeft + trilho.clientWidth / 2, melhor = 0, dist = Infinity;
        cards.forEach(function (it, n) { var x = Math.abs(it.offsetLeft + it.offsetWidth / 2 - meio); if (x < dist) { dist = x; melhor = n; } });
        if (melhor === marcado) return; marcado = melhor;
        pontos.forEach(function (p, n) { p.classList.toggle("on", n === melhor); });
      };
      trilho.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(marca); } }, { passive: true });
      marca();
    }

    /* botão fixo no celular: aparece depois do hero, some com a oferta na tela */
    var barra = $("#cta-mobile"), heroV = true, ofertaV = false, cartaoV = false;
    function barraOn() {
      var on = !heroV && !ofertaV && !cartaoV; /* também some com o cartão de compra do resultado na tela, para não duplicar */
      barra.classList.toggle("on", on); barra.setAttribute("aria-hidden", on ? "false" : "true"); $("a", barra).tabIndex = on ? 0 : -1;
    }
    if (barra && "IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { heroV = es[0].isIntersecting; barraOn(); }).observe($("#inicio"));
      new IntersectionObserver(function (es) { ofertaV = es[0].isIntersecting; barraOn(); }, { threshold: .08 }).observe($("#oferta"));
      new IntersectionObserver(function (es) { cartaoV = es[0].isIntersecting; barraOn(); }, { threshold: .25 }).observe($("#buyCard"));
    }

    /* ViewContent ao chegar no Programa */
    if ("IntersectionObserver" in window) {
      var visto = false, of = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting || visto) return; visto = true; of.disconnect();
        evento("ViewContent", "view_item", { content_name: "Programa Liderança Inteligente", value: PRECO, currency: "BRL", content_category: "ferramentas" });
      }, { threshold: .05 });
      of.observe($("#ferramentas"));
    }

    /* painel próprio: visita, rolagem e saída */
    painel("view");
    var marcos = [25, 50, 75, 100], esperando = false;
    function rolou() { esperando = false; var h = html.scrollHeight - innerHeight, p = h > 0 ? scrollY / h * 100 : 100; while (marcos.length && p >= marcos[0] - 1) painel("scroll", { n: marcos.shift() }); }
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
    $$(".passo").forEach(function (el) { el.classList.add("on"); });
  }
  function animacoes() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (reduz || !gsap || !ST) { estadoFinal(); return; }
    gsap.registerPlugin(ST);

    gsap.set("[data-reveal]", { opacity: 0, y: 24 });
    ST.batch("[data-reveal]", { start: "top 90%", once: true, onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: .6, stagger: .08, ease: "power2.out", overwrite: true }); } });

    /* quiz: a caixa entra quando aparece */
    gsap.from("#quizBox", { opacity: 0, y: 30, duration: .7, ease: "power2.out", scrollTrigger: { trigger: "#quizBox", start: "top 88%", once: true } });

    /* números de autoridade */
    gsap.set($$(".autoridade .num-x"), { opacity: 0 });
    $$("[data-count]").forEach(function (el) {
      var alvo = +el.getAttribute("data-count"), o = { v: 0 };
      el.textContent = "0";
      gsap.to(o, { v: alvo, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: ".nums", start: "top 85%", once: true },
        onUpdate: function () { el.textContent = Math.round(o.v); },
        onComplete: function () { gsap.to($$(".num-x", el.parentNode), { opacity: 1, duration: .4 }); } });
    });

    /* Programa e oferta: os itens entram um a um, a soma sobe até R$ 1.032 e o preço entra por último. Uma vez só. */
    var itens = $$("#itens .item"), total = $("#totalNum"), fill = $("#somaFill"), tv = { v: 0 };
    var label = $(".rv-label"), precoEl = $(".rv-preco strong"), brilho = $(".rv-preco .glow"), finais = $$(".rv-dia, .rv-parc");
    gsap.set(itens, { opacity: 0, y: 16 });
    gsap.set([label, precoEl].concat(finais), { opacity: 0 });
    total.textContent = "0"; fill.style.setProperty("--p", 0);
    gsap.timeline({ scrollTrigger: { trigger: "#itens", start: "top 72%", once: true } })
      .to(itens, { opacity: 1, y: 0, duration: .35, stagger: .13, ease: "power2.out" })
      .to(tv, { v: 1032, duration: 1.3, ease: "power1.out", onUpdate: function () { total.textContent = br(tv.v); fill.style.setProperty("--p", tv.v / 1032); } }, .15)
      .to(label, { opacity: 1, duration: .35 }, "+=.25")
      .fromTo(precoEl, { scale: .6 }, { opacity: 1, scale: 1, duration: .7, ease: "back.out(1.8)" }, "-=.05")
      .fromTo(brilho, { opacity: .95, scale: .3 }, { opacity: 0, scale: 2.6, duration: 1.1, ease: "power2.out" }, "<")
      .fromTo(finais, { y: 10 }, { opacity: 1, y: 0, duration: .4, stagger: .14 }, "-=.6");

    /* linha do tempo pós-compra */
    var passos = $$(".passo"), fio = $("#passosFill");
    gsap.fromTo(fio, { "--p": 0 }, { "--p": 1, ease: "none",
      scrollTrigger: { trigger: "#passos", start: "top 70%", end: "bottom 60%", scrub: .5,
        onUpdate: function (s) { passos.forEach(function (p, n) { p.classList.toggle("on", s.progress > .001 && s.progress >= n / (passos.length - 1) - .02); }); } } });

    addEventListener("load", function () { ST.refresh(); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { ST.refresh(); });
  }

  /* =========================================================
     Partida
     ========================================================= */
  quiz();
  interacoes();
  animacoes();

  var escolha = ler(CHAVE);
  if (escolha === "aceito") carregarTags();
  else if (escolha !== "recusado") mostrarAviso();
})();
