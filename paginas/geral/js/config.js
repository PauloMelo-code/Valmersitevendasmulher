/* Liderança Inteligente · configuração da página. */

/* Preço único da página. Alimenta todo elemento com data-price e o valor do InitiateCheckout.
   Quando o preço mudar, altere aqui E no checkout, juntos. (O "R$ 3,30 por dia" e o "12x de R$ 14,70" são texto no HTML.) */
var PRECO = 147;

var LI_CONFIG = {
  PRECO: PRECO,
  CHECKOUT_URL: "/comprar",

  /* Pixel que já estava na página anterior. Confirmar. */
  PIXEL_ID: "1181979381174003",
  GTAG_ID: "{{GTAG_ID}}"
};

(function () {
  var html = document.documentElement;
  html.classList.add("js");

  /* Teste A/B da cor do botão de compra: sorteado na primeira visita e guardado; ?cor=verde ou ?cor=laranja força. */
  var guardada = null;
  try { guardada = localStorage.getItem("li_cor"); } catch (e) {}
  var cor = window.LIQuiz ? window.LIQuiz.variante(location.search, guardada) : "verde";
  try { localStorage.setItem("li_cor", cor); } catch (e) {}
  html.setAttribute("data-cor", cor);
  LI_CONFIG.VARIANTE_COR = cor;
})();
