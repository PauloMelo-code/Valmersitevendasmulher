# Programa Liderança Inteligente · página de vendas com quiz

Página estática: HTML, CSS e JavaScript puros, com GSAP e ScrollTrigger via CDN. Sem build.
A porta de entrada é o quiz "Descubra seu nível de inteligência emocional". O que se vende é o **Programa Liderança Inteligente** por R$ 147, sem prazo na tela.

## Estrutura

```
index.html
css/style.css
js/quiz-logica.js   <- nota, faixas, dimensão mais fraca e cor de teste (sem DOM, testada)
js/config.js        <- PRECO, link do checkout, pixel; sorteia a cor de teste
js/main.js          <- quiz, rastreio, botão fixo, animações
assets/img/         <- imagens .webp
assets/video/       <- depoimento-1.mp4 a depoimento-8.mp4 (hero.mp4 é da versão anterior e não é usado)
tests/quiz.test.mjs <- node --test tests/quiz.test.mjs
referencias/        <- o quiz original, fonte das 15 situações
versao-black-friday/ <- cópia da versão anterior (com prazo e contador), para consulta
```

Testar local: `python3 -m http.server 4173` e abrir `http://localhost:4173/`.

## Ordem da página (estrutura enxuta)

`#inicio` (hero) → `#diagnostico` (quiz e resultado com cartão de compra) → `#ponte` → `#depoimentos` → `#ferramentas` (Programa e oferta num bloco só; o preço e o botão ficam em `#oferta`, dentro dele) → `#garantia` → `#como-funciona` → `#autor` (autor e autoridade juntos) → `#faq` (7 perguntas) → `#fechamento`, mais o botão fixo no celular.

- A soma de R$ 1.032 é montada uma vez só na página (além da linha do cartão do resultado).
- O item com "Indicado no seu resultado" é uma linha da lista `#itens` (`.item[data-dim]`).
- `versao-antes-do-enxugamento/` guarda o HTML, o CSS e o JS da estrutura longa anterior.

## Preço

- `PRECO = 147` em `js/config.js` alimenta todo `[data-price]` e o `value` do `InitiateCheckout`.
- Não existe mais troca automática por data. Quando o preço mudar, altere a constante e o checkout juntos.
- Dois textos dependem do preço e estão escritos no HTML: "Menos de R$ 3,30 por dia" e "12x de R$ 14,70".

## Quiz

- As 15 situações estão no HTML, em `#situacoes` (copiadas de `referencias/`, sem alteração; um teste confere isso). Com JavaScript viram o quiz; sem JavaScript aparecem como lista, com o botão de compra visível.
- Tocar numa resposta avança sozinho após 220 ms. "Voltar" e "Pular situação" continuam.
- Nota de 0 a 100. Faixas: abaixo de 45, de 45 a 74, 75 ou mais. Mínimo de 8 respostas para mostrar a nota.
- A dimensão mais fraca define a frase do cartão de compra e o item com "Indicado no seu resultado":
  Gestão emocional → Jornada Metanoia · Identidade → Livro · Comunicação → Feedback que Transforma · Relacionamentos → Lidere Cada Perfil.
- Dimensão e faixa ficam em `localStorage` (`li_quiz`), para manter o destaque ao recarregar.

## Cor do botão de compra e teste A/B

- A cor sai só de `--cta`, `--cta-hover` e `--cta-texto` (em `css/style.css`). Verde `#16A34A` com texto branco; laranja `#F26B1D` com texto preto.
- Texto do botão em negrito, nunca abaixo de 19 px.
- A variante é sorteada 50/50 na primeira visita e guardada em `localStorage` (`li_cor`). `?cor=verde` ou `?cor=laranja` força.
- A métrica do teste é o clique de compra por visitante, não a venda.
- O verde só aparece em elementos de compra. "Descobrir meu nível" e os botões do quiz são dourados.

## Rastreio

- Botões `.js-buy` vão direto ao checkout e repassam `utm_*`, `fbclid` e `gclid`.
- `content_category` por botão: `hero`, `resultado_quiz`, `ponte`, `depoimentos`, `oferta`, `fechamento`, `sticky`.
- Pixel (só com consentimento): `PageView`; `InitiateCheckout` com `value`, `currency`, `content_category` e `variante_cor`; `trackCustom("QuizConcluido", {faixa, dimensao})`; `trackCustom("QuizInicio")`; `ViewContent` ao chegar em `#ferramentas`.
- Painel próprio (`POST /api/evento`, só no domínio de produção). Todo evento leva `cor`. Tipos novos:
  - `quiz_inicio` (na primeira resposta);
  - `quiz_fim` com `n` (nota), `f` (faixa), `d` (dimensão) e `q` (respondidas);
  - `quiz_cta` (clique no botão de compra do resultado);
  - `click` agora leva `b` (bloco) e `variante_cor`.

## O que falta fazer no servidor (não está neste pacote)

Este pacote é só o front-end. No projeto do servidor ainda é preciso:

1. Aceitar os tipos `quiz_inicio`, `quiz_fim` e `quiz_cta` em `src/evento.ts` e lê-los em `src/consultas.ts`.
2. Criar no painel o funil: visitas, iniciaram o quiz, concluíram, clicaram em comprar, pagaram; e a compra por faixa e por dimensão.
3. Conferir as `trocas` de `src/pagina.ts` da página de Maringá contra o HTML novo e rodar os testes existentes. Os ids e textos mudaram.
4. Levar `tests/quiz.test.mjs` para a suíte do projeto e acrescentar o teste de "novos eventos aceitos".

## Para confirmar com o Valmer antes de publicar

- Parcelamento "12x de R$ 14,70": conferir com o checkout. Se não bater, trocar a linha por "Pix ou cartão".
- `PIXEL_ID` (o mesmo da página anterior).
- Regra de reembolso quando o livro já foi enviado (comentário `{{REGRA_REEMBOLSO_LIVRO}}` na garantia).
- Grafia dos nomes e empresas dos depoimentos; cargo da Dra. Rafaela.
- História do burnout no bloco do autor: texto e ano (2019) vieram do quiz de referência.
- Texto do fechamento ("A próxima reação já está a caminho..."): é novo, escrito para manter o tom do quiz. Precisa de aprovação.
- Frase de destaque do autor: trocada por "O primeiro passo para influenciar melhor quem está perto é aprender a conduzir a si mesmo.", que é dele e veio do quiz.
- `og:image`: hoje é a capa do livro; o ideal é uma imagem 1200x630.

## Cuidados

- Não usar `scroll-behavior: smooth` no CSS: quebra os gatilhos do ScrollTrigger.
- Todas as animações respeitam `prefers-reduced-motion`. Sem GSAP, o conteúdo e o preço continuam visíveis.
- Regras de texto: nunca "de R$ 1.032 por R$ 147" (usar "Valor somado dos itens: R$ 1.032" e depois o preço); a palavra "bônus" não aparece; a pessoa "acessa o Programa", não "compra um kit"; nada de promessa de salário ou promoção.
