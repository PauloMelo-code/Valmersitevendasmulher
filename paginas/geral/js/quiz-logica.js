/* Liderança Inteligente · lógica pura do quiz e da cor de teste.
   Sem DOM, para poder ser testada com `node --test tests/`. No navegador vira window.LIQuiz. */
(function (root, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else root.LIQuiz = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MINIMO = 8; /* respostas necessárias para mostrar a nota */

  /* As 4 dimensões, os textos de exercício e os capítulos: copiados do quiz de referência, sem alteração.
     `item` é o data-dim do item do Programa que ganha "Indicado no seu resultado". */
  var DIMENSOES = [
    { nome: "Gestão emocional", item: "Jornada Metanoia", insight: "Observe o que acontece entre sentir a pressão subir e responder. É nesse intervalo que você pode escolher como agir.", pratica: "Hoje, perceba o primeiro sinal de que está chegando ao limite: tensão no corpo, pressa de falar ou vontade de se fechar.", capitulo: "Capítulo 7 · O Código Emocional da Liderança." },
    { nome: "Identidade e autoimagem", item: "Livro", insight: "Um erro ou a falta de reconhecimento pode pesar na forma como você se enxerga.", pratica: "Descreva o que aconteceu em uma frase, deixando de fora “sempre”, “nunca” e “eu sou”. Depois, escreva o que está ao seu alcance fazer.", capitulo: "Capítulo 4 · Identidade, o Alicerce Invisível." },
    { nome: "Comunicação", item: "Feedback que Transforma", insight: "Quando bate a mágoa ou a vontade de se defender, o outro pode perceber o tom antes de entender o que você queria dizer.", pratica: "Na próxima vez, tente nomear o que sentiu em uma frase. Depois, pergunte como a outra pessoa viu a situação.", capitulo: "Capítulo 8 · Comunicação Inteligente." },
    { nome: "Relacionamentos", item: "Lidere Cada Perfil", insight: "Silêncio e distância podem deixar uma mágoa sem resposta, mesmo depois que a rotina volta ao normal.", pratica: "Se lembrar de uma reação sua que feriu alguém, pergunte como a pessoa ficou e escute antes de explicar o que aconteceu com você.", capitulo: "Capítulo 10 · Líder Especialista em Pessoas." }
  ];

  /* Textos do resultado por faixa (0 = poucas respostas). */
  var FAIXAS = [
    { titulo: "Ainda dá para completar seu retrato", texto: "Responda a pelo menos oito situações para ver uma nota geral. Você pode voltar às perguntas." },
    { titulo: "Hoje, a emoção está decidindo antes de você", texto: "Em várias situações, a reação chega antes da escolha. E quem sente primeiro são as pessoas mais próximas: quem mora com você e quem trabalha com você. Isso não é defeito de caráter. É um padrão, e padrão se aprende a mudar." },
    { titulo: "Você já percebe, mas ainda percebe tarde", texto: "Em algumas situações você escolhe como agir. Em outras, só entende o que sentiu quando a conversa já acabou e a palavra já foi dita. O caminho é encurtar esse intervalo, e dá para começar esta semana." },
    { titulo: "Você já tem recursos. Agora é transformar em hábito", texto: "Suas respostas mostram que você costuma se conduzir bem sob pressão. Ainda existe uma área em que a reação vence a escolha, e é por ela que vale começar." }
  ];

  /* nota 0–100 -> faixa 1, 2 ou 3 (abaixo de 45, de 45 a 74, 75 ou mais) */
  function faixa(nota) { return nota < 45 ? 1 : nota < 75 ? 2 : 3; }

  /* perguntas: [{grupo, pontos:[..]}]; respostas: índice escolhido por pergunta, ou null/undefined se pulou */
  function calcular(perguntas, respostas) {
    var dims = DIMENSOES.map(function (d) { return { nome: d.nome, total: 0, respondidas: 0, nota: null }; });
    perguntas.forEach(function (p, i) {
      var r = respostas[i];
      if (typeof r !== "number" || r % 1 !== 0 || r < 0 || r >= p.pontos.length) return;
      dims[p.grupo].total += p.pontos[r]; dims[p.grupo].respondidas++;
    });
    var respondidas = 0, total = 0;
    dims.forEach(function (d) { respondidas += d.respondidas; total += d.total; if (d.respondidas >= 2) d.nota = Math.round(100 * d.total / (d.respondidas * 3)); });
    var nota = respondidas ? Math.round(100 * total / (respondidas * 3)) : 0;
    var suficiente = respondidas >= MINIMO;
    /* dimensão mais fraca: menor média entre as que têm pelo menos 2 respostas; no empate, fica a primeira */
    var foco = -1, menor = Infinity;
    dims.forEach(function (d, i) { if (d.respondidas < 2) return; var media = d.total / d.respondidas; if (media < menor) { menor = media; foco = i; } });
    if (!suficiente) foco = -1;
    return { nota: nota, respondidas: respondidas, suficiente: suficiente, faixa: suficiente ? faixa(nota) : 0, dimensoes: dims, foco: foco };
  }

  /* Cor de teste do botão de compra. ?cor=verde|laranja força; senão vale a guardada; senão sorteia 50/50. */
  function variante(busca, guardada, sorteio) {
    var m = /[?&]cor=(verde|laranja)(?:&|$)/.exec(busca || "");
    if (m) return m[1];
    if (guardada === "verde" || guardada === "laranja") return guardada;
    return (typeof sorteio === "number" ? sorteio : Math.random()) < 0.5 ? "verde" : "laranja";
  }

  return { MINIMO: MINIMO, DIMENSOES: DIMENSOES, FAIXAS: FAIXAS, faixa: faixa, calcular: calcular, variante: variante };
});
