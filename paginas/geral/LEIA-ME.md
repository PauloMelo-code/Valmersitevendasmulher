# Liderança Inteligente · página de vendas (Black Friday até 10/12/2026)

Página estática: HTML, CSS e JavaScript puros, com GSAP e ScrollTrigger via CDN. Sem build. Basta subir a pasta inteira na raiz de `lider.lideresdeimpacto.com.br`, mantendo a estrutura.

## Estrutura

```
index.html
css/style.css
js/config.js     <- tudo o que precisa ser preenchido fica aqui
js/main.js       <- cronômetro, troca de preço, animações, pixel, UTM
assets/img/      <- imagens em WebP
assets/video/    <- hero.mp4 e depoimento-1.mp4 a depoimento-8.mp4
assets/favicon-32.png, assets/apple-touch-icon.png
```

Para testar local: `python3 -m http.server 4173` na pasta e abrir `http://localhost:4173/`.

## O que falta preencher antes de publicar

Em `js/config.js`:

| Campo | Situação |
|---|---|
| `CHECKOUT_URL_147` | **Falta.** Sem ele os botões de compra não navegam (só avisam no console). |
| `CHECKOUT_URL_497` | **Falta.** Usado automaticamente depois do prazo. |
| `PIXEL_ID` | Preenchido com o ID da página atual (`1181979381174003`). Confirmar. |
| `GTAG_ID` | Opcional. |
| `VIDEO_HERO_URL_DEPOIS` | Opcional. Vídeo do hero para depois do prazo (o atual fala em R$ 147). |

Em `index.html` (procure por `{{`):

- `{{GRADE_15_AULAS}}`: nomes das aulas 11 a 15 do Líder na Prática.
- `{{REGRA_REEMBOLSO_LIVRO}}`: bloco da garantia.
- `{{TEXTO_PARCELAMENTO_497}}` e `{{RESPOSTA_PARCELAMENTO_497}}`: parcelamento do preço cheio (hoje só existe o de R$ 147).
- Nomes e empresas dos depoimentos: conferir a grafia (foram lidos da legenda dos vídeos).
- `og:image`: hoje aponta para a capa do livro; trocar por uma imagem 1200x630 do kit.

## Como funciona o prazo

- Uma única constante: `DEADLINE = "2026-12-10T23:59:59-03:00"` em `js/config.js`.
- O cronômetro é real e fixo. Não reinicia por visitante.
- Depois do prazo, sozinha, a página: troca todo `[data-price]` para R$ 497, remove todo `[data-bf-only]` (barra de urgência, cronômetros, textos de Black Friday, parcelamento de R$ 147), mostra os `[data-after-only]`, aponta os botões para `CHECKOUT_URL_497` e tira o vídeo do hero (volta a imagem do kit).
- Para testar: mude a data para o passado e recarregue.
- A meta description e a `og:image` não mudam sozinhas; por isso não citam preço.

## Rastreio

- Todos os botões `.js-buy` vão direto ao checkout e repassam os parâmetros da URL (UTMs).
- Meta Pixel: `PageView` ao carregar, `ViewContent` ao chegar no bloco `#ferramentas`, `InitiateCheckout` em cada clique de compra com `content_category` = id do bloco. Mesmos eventos no Google Tag, se houver `GTAG_ID`.
- LGPD: o pixel só carrega depois do "Aceitar" no aviso de cookies (mesma chave `lv_consentimento` da página atual). O link "Preferências de cookies" do rodapé reabre o aviso.
- O `main.js` também envia `view`, `click`, `scroll` e `sair` para `/api/evento` (o painel próprio que já existe em `/painel`), somente no domínio `lideresdeimpacto.com.br`.

## Dependências do servidor atual que precisam continuar existindo

- `/privacidade` (política de privacidade, linkada no rodapé e no aviso de cookies).
- `/api/evento` (painel próprio).
- O checkout (`/comprar` na página atual).

## Cuidados

- Não usar `scroll-behavior: smooth` no CSS: quebra os gatilhos do ScrollTrigger.
- Todas as animações respeitam `prefers-reduced-motion`. Sem JavaScript ou sem GSAP, o conteúdo e o preço continuam visíveis.
- Os vídeos precisam ser servidos com suporte a `Range` (padrão em qualquer hospedagem comum) para tocar no iPhone.
- Regras de texto do cliente: nunca escrever "de R$ 1.032 por R$ 147"; a palavra "bônus" não aparece; livro "enviado no dia seguinte à compra" (nunca "chega em X dias").
