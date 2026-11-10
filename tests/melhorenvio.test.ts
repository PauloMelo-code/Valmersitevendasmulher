import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cabecalhos, corpoCarrinho, corpoCotacao, escolherServico, MELHOR_ENVIO } from '../src/melhorenvio.ts';

const cfg = { ...MELHOR_ENVIO, token: 'tok-de-teste-com-mais-de-vinte', email: 'tec@editora.com.br', servicos: [1, 2] };
const pedido = {
  orderNsu: 'LI-ABCDEFGH23', valorCentavos: 9700, nome: 'Maria da Silva', email: 'maria@email.com', telefone: '44999998888', cpf: '52998224725',
  cep: '01310100', rua: 'Av. Paulista', numero: '1000', complemento: 'Apto 12', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP',
  notaChave: '41251166911358000184550010000001231000001238',
};

test('escolhe o serviço mais barato, ignorando erro e ids fora da lista', () => {
  const cotacao = [
    { id: 1, name: 'PAC', price: '25.10', custom_price: '22.50', custom_delivery_time: 8 },
    { id: 2, name: 'SEDEX', price: '30.00', custom_price: '28.90', custom_delivery_time: 3 },
    { id: 3, name: '.Package', custom_price: '9.90' },
    { id: 17, name: 'Mini Envios', custom_price: '7.00' },
    { id: 2, name: 'SEDEX', error: 'Serviço indisponível', custom_price: '1.00' },
  ];
  assert.deepEqual(escolherServico(cotacao, [1, 2]), { servico: 1, freteCentavos: 2250, prazo: 8 });
  assert.equal(escolherServico([{ id: 1, error: 'x' }], [1, 2]), null);
  assert.equal(escolherServico({ message: 'erro' }, [1, 2]), null);
});

test('cotação: livro 15 × 23 × 2 cm, 0,336 kg, seguro = valor do pedido', () => {
  const c = corpoCotacao(pedido);
  assert.deepEqual(c.from, { postal_code: '87013060' });
  assert.deepEqual(c.products[0], { id: 'livro', width: 15, height: 2, length: 23, weight: 0.336, insurance_value: 97, quantity: 1 });
});

test('carrinho no modo nota: chave da NF-e, IE da editora, comercial', () => {
  const c = corpoCarrinho({ ...cfg, modo: 'nota' }, pedido, 1);
  assert.equal(c.service, 1);
  assert.equal(c.from.company_document, '66911358000184');
  assert.equal(c.from.state_register, '9123226450');
  assert.equal(c.to.document, '52998224725');
  assert.equal(c.to.state_abbr, 'SP');
  assert.equal(c.options.non_commercial, false);
  assert.deepEqual(c.options.invoice, { key: pedido.notaChave });
  assert.equal(c.options.insurance_value, 97);
  assert.deepEqual(c.options.tags, [{ tag: 'LI-ABCDEFGH23', url: null }]);
  assert.deepEqual(c.volumes, [{ height: 2, width: 15, length: 23, weight: 0.336 }]);
});

test('carrinho no modo declaração: sem invoice, ISENTO, non_commercial', () => {
  const c = corpoCarrinho({ ...cfg, modo: 'declaracao' }, { ...pedido, notaChave: null }, 2);
  assert.equal(c.options.non_commercial, true);
  assert.ok(!('invoice' in c.options));
  assert.equal(c.from.state_register, 'ISENTO');
});

test('headers do Melhor Envio', () => {
  assert.deepEqual(cabecalhos(cfg), {
    Accept: 'application/json', 'Content-Type': 'application/json',
    Authorization: 'Bearer tok-de-teste-com-mais-de-vinte', 'User-Agent': 'Pagina Lideranca Inteligente (tec@editora.com.br)',
  });
});
