import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fichasHtml, type PedidoFicha } from '../src/painel-fichas.ts';

const base: PedidoFicha = {
  orderNsu: 'LI-ABCDEFGH23', status: 'PAGO', nome: 'Maria <b>da</b> Silva', cpf: '52998224725', email: 'maria@email.com', telefone: '44999998888',
  cep: '01310100', rua: 'Av. Paulista', numero: '1000', complemento: null, bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP',
  valorCentavos: 9700, valorPagoCentavos: 11312, metodo: 'credit_card', parcelas: 9, pagoEm: new Date('2026-11-14T15:00:00Z'), notaChave: null, notaNumero: null,
};

test('uma folha por pedido, mais a capa; nome escapado e CPF/CEP com máscara', () => {
  const h = fichasHtml([base, { ...base, orderNsu: 'LI-ZZZZZZZZ22', metodo: 'pix', valorPagoCentavos: 9700, parcelas: 1 }]);
  assert.equal(h.match(/<section class="folha">/g)?.length, 3);
  assert.ok(!h.includes('<b>da</b>') && h.includes('Maria &#60;b&#62;da&#60;/b&#62; Silva'));
  assert.ok(h.includes('529.982.247-25') && h.includes('01310-100') && h.includes('66.911.358/0001-84'));
});

test('nota leva o valor do livro, não o pago com juros; sem chave fica a linha para escrever', () => {
  const h = fichasHtml([base]);
  assert.match(h, /1 parcela de R\$\s97,00/);
  assert.match(h, /pago R\$\s113,12 em 9x/);
  assert.ok(h.includes('<dt>Chave da NF-e</dt><dd><span class="escrever"></span>'));
  const com = fichasHtml([{ ...base, notaChave: '41251166911358000184550010000001231000001238', notaNumero: '123' }]);
  assert.ok(com.includes('4125 1166 9113 5800 0184 5500 1000 0001 2310 0000 1238</code> · nota 123'));
});

test('lista vazia avisa em vez de gerar folha em branco', () => {
  const h = fichasHtml([]);
  assert.ok(h.includes('Nenhum pedido pago esperando envio.'));
  assert.equal(h.match(/<section class="folha">/g)?.length, 1);
});
