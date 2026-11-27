/* Liderança Inteligente · configuração da página.
   Tudo o que o Valmer precisa preencher fica aqui. Um valor que ainda começa com "{{" é tratado como "não preenchido". */

/* Prazo real e fixo da Black Friday (horário de Brasília). É a ÚNICA data da página:
   cronômetros, preço, textos e link de checkout mudam sozinhos a partir dela. */
var DEADLINE = "2026-12-10T23:59:59-03:00";

var LI_CONFIG = {
  CHECKOUT_URL_147: "/comprar",
  CHECKOUT_URL_497: "/comprar",

  /* Vídeo de entrada: retirado a pedido em 27/11/2026 (o hero mostra a imagem do kit).
     Para voltar, use "assets/video/hero.mp4" (vertical 9:16, com os textos já na imagem). */
  VIDEO_HERO_URL: "{{VIDEO_HERO_URL}}",
  VIDEO_HERO_POSTER: "assets/img/hero-video-capa.webp",
  VIDEO_HERO_VERTICAL: true,
  /* O vídeo fala em R$ 147. Depois do prazo ele sai sozinho e volta a imagem do kit.
     Para manter um vídeo depois de 10/12, coloque aqui uma versão sem o preço de Black Friday. */
  VIDEO_HERO_URL_DEPOIS: "{{VIDEO_HERO_URL_DEPOIS_DO_PRAZO}}",
  VIDEO_HERO_LEGENDAS: "{{VIDEO_HERO_LEGENDAS_VTT}}",   /* arquivo .vtt, opcional */

  /* Pixel que já está na página atual (lido de lider.lideresdeimpacto.com.br). Confirmar. */
  PIXEL_ID: "1181979381174003",
  GTAG_ID: "{{GTAG_ID}}",

  PRECO_BF: 147,
  PRECO_CHEIO: 497
};

/* Marca o <html> antes da primeira pintura, para ninguém ver o preço antigo piscar. */
if (Date.now() > Date.parse(DEADLINE)) document.documentElement.classList.add("expired");
