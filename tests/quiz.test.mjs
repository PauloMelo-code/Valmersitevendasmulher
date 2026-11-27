// Testes da lógica do quiz e da cor de teste.  Rodar: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
// O repo é "type": "module": o arquivo do navegador é avaliado como script, com um `module` de mentira.
const caixa = { module: { exports: {} } };
vm.runInNewContext(readFileSync(new URL("../paginas/geral/js/quiz-logica.js", import.meta.url), "utf8"), caixa);
const L = caixa.module.exports;

// monta N perguntas de um grupo, cada uma com pontos [0,1,2,3]
const perguntas = (grupos) => grupos.map((g) => ({ grupo: g, pontos: [0, 1, 2, 3] }));

test("faixas da nota: 44, 45, 74 e 75", () => {
  assert.equal(L.faixa(44), 1);
  assert.equal(L.faixa(45), 2);
  assert.equal(L.faixa(74), 2);
  assert.equal(L.faixa(75), 3);
  assert.equal(L.faixa(0), 1);
  assert.equal(L.faixa(100), 3);
});

test("cada faixa tem o título definido para ela", () => {
  assert.equal(L.FAIXAS[1].titulo, "Hoje, a emoção está decidindo antes de você");
  assert.equal(L.FAIXAS[2].titulo, "Você já percebe, mas ainda percebe tarde");
  assert.equal(L.FAIXAS[3].titulo, "Você já tem recursos. Agora é transformar em hábito");
});

test("nota de 0 a 100 a partir dos pontos", () => {
  const p = perguntas([0, 0, 0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(L.calcular(p, p.map(() => 3)).nota, 100);
  assert.equal(L.calcular(p, p.map(() => 0)).nota, 0);
  assert.equal(L.calcular(p, p.map(() => 2)).nota, 67);
});

test("escolhe a dimensão mais fraca", () => {
  const p = perguntas([0, 0, 1, 1, 2, 2, 3, 3]);
  // grupo 0 = 3, grupo 1 = 2, grupo 2 = 0 (mais fraca), grupo 3 = 1
  const r = L.calcular(p, [3, 3, 2, 2, 0, 0, 1, 1]);
  assert.equal(r.foco, 2);
  assert.equal(L.DIMENSOES[r.foco].nome, "Comunicação");
  assert.equal(L.DIMENSOES[r.foco].item, "Feedback que Transforma");
});

test("dimensão com menos de 2 respostas não entra na escolha", () => {
  const p = perguntas([0, 0, 0, 0, 1, 1, 1, 1, 2]);
  const r = L.calcular(p, [3, 3, 3, 3, 2, 2, 2, 2, 0]); // grupo 2 tem só 1 resposta, e é a pior
  assert.equal(r.foco, 1);
  assert.equal(r.dimensoes[2].nota, null);
});

test("mínimo de 8 respostas para mostrar a nota", () => {
  const p = perguntas([0, 0, 0, 0, 1, 1, 2, 2, 3, 3]);
  const sete = L.calcular(p, [1, 1, 1, 1, 1, 1, 1, null, null, undefined]);
  assert.equal(sete.respondidas, 7);
  assert.equal(sete.suficiente, false);
  assert.equal(sete.faixa, 0);
  assert.equal(sete.foco, -1);
  const oito = L.calcular(p, [1, 1, 1, 1, 1, 1, 1, 1, null, null]);
  assert.equal(oito.suficiente, true);
  assert.notEqual(oito.faixa, 0);
});

test("mapa dimensão -> item indicado no Programa", () => {
  assert.deepEqual(Array.from(L.DIMENSOES, (d) => d.item), ["Jornada Metanoia", "Livro", "Feedback que Transforma", "Lidere Cada Perfil"]);
});

test("parâmetro ?cor força a variante", () => {
  assert.equal(L.variante("?cor=laranja", "verde", 0.1), "laranja");
  assert.equal(L.variante("?utm_source=x&cor=verde", "laranja", 0.9), "verde");
  assert.equal(L.variante("?cor=roxo", null, 0.1), "verde"); // valor inválido é ignorado
});

test("sem parâmetro, vale a variante guardada; sem guardada, sorteio 50/50", () => {
  assert.equal(L.variante("", "laranja", 0.1), "laranja");
  assert.equal(L.variante("", null, 0.49), "verde");
  assert.equal(L.variante("", null, 0.5), "laranja");
});

test("o HTML traz as 15 situações da referência, com 4 respostas e pontos 0 a 3", () => {
  const html = readFileSync(new URL("../paginas/geral/index.html", import.meta.url), "utf8");
  const ref = readFileSync(new URL("./fixtures/quiz-inteligencia-emocional.html", import.meta.url), "utf8");
  const Q = JSON.parse(/const questions = (\[[\s\S]*?\n\]);/.exec(ref)[1]);
  const itens = [...html.matchAll(/<li data-g="(\d)"><p class="sit-p">([\s\S]*?)<\/p><ul>([\s\S]*?)<\/ul><\/li>/g)];
  assert.equal(itens.length, 15);
  itens.forEach((m, i) => {
    assert.equal(+m[1], Q[i].group);
    assert.equal(m[2], Q[i].prompt);
    const ops = [...m[3].matchAll(/<li data-p="(\d)">([\s\S]*?)<\/li>/g)];
    assert.deepEqual(ops.map((o) => +o[1]), Q[i].points);
    assert.deepEqual(ops.map((o) => o[2]), Q[i].answers);
  });
});

test("a página não tem data, Black Friday nem 'de/por'", () => {
  const html = readFileSync(new URL("../paginas/geral/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /Black Friday|10\/12|11\/12|R\$ 497|de R\$ 1\.032 por/i);
  assert.doesNotMatch(html.replace(/<[^>]+>/g, " "), /\bkit\b/i);
});
