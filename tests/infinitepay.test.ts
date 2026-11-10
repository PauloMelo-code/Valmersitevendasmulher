import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corpoLink, INFINITEPAY, reciboOk, regraConfirmacao, urlDoLink } from '../src/infinitepay.ts';

const cfg = { ...INFINITEPAY, handle: 'editorasignature', site: 'https://lider.exemplo.com.br', descricao: 'Liderança Inteligente' };
const pedido = {
  orderNsu: 'LI-ABCDEFGH23', valorCentavos: 9700, nome: 'Maria da Silva', email: 'maria@email.com', telefone: '44999998888',
  cep: '87013060', rua: 'Rua Néo Alves Martins', numero: '2789', complemento: null, bairro: 'Zona 01', cidade: 'Maringá', uf: 'PR',
};

test('corpo do /links: centavos, handle, telefone +55 e endereço', () => {
  const c = corpoLink(cfg, pedido);
  assert.equal(c.handle, 'editorasignature');
  assert.deepEqual(c.items, [{ quantity: 1, price: 9700, description: 'Liderança Inteligente' }]);
  assert.equal(c.order_nsu, 'LI-ABCDEFGH23');
  assert.equal(c.redirect_url, 'https://lider.exemplo.com.br/obrigado');
  assert.equal(c.webhook_url, 'https://lider.exemplo.com.br/api/infinitepay/webhook');
  assert.deepEqual(c.customer, { name: 'Maria da Silva', email: 'maria@email.com', phone_number: '+5544999998888' });
  assert.deepEqual(c.address, { cep: '87013060', street: 'Rua Néo Alves Martins', number: '2789', neighborhood: 'Zona 01', city: 'Maringá', state: 'PR', complement: '' });
  assert.equal(INFINITEPAY.precoCentavos, 9700, 'preço padrão R$ 97');
});

test('link de pagamento: url, payment_url ou erro', () => {
  assert.equal(urlDoLink({ url: 'https://checkout.infinitepay.io/x/1' }), 'https://checkout.infinitepay.io/x/1');
  assert.equal(urlDoLink({ payment_url: 'https://checkout.infinitepay.io/x/2' }), 'https://checkout.infinitepay.io/x/2');
  assert.throws(() => urlDoLink({ id: 1 }), /sem url/);
  assert.throws(() => urlDoLink(null), /sem url/);
  assert.throws(() => urlDoLink({ url: 'javascript:alert(1)' }), /sem url/);
});

test('confirmação: vale amount igual ao pedido; paid_amount maior (juros) não importa', () => {
  assert.equal(regraConfirmacao({ success: true, paid: true, amount: 9700, paid_amount: 9700 }, 9700), 'pago');
  assert.equal(regraConfirmacao({ success: true, paid: true, amount: 9700, paid_amount: 10890, installments: 12 }, 9700), 'pago');
  assert.equal(regraConfirmacao({ success: true, paid: true, amount: 100, paid_amount: 9700 }, 9700), 'divergente');
  assert.equal(regraConfirmacao({ success: true, paid: true }, 9700), 'divergente', 'sem amount não marca pago');
  assert.equal(regraConfirmacao({ success: true, paid: false, amount: 9700 }, 9700), 'pendente');
  assert.equal(regraConfirmacao({ success: false, paid: true, amount: 9700 }, 9700), 'pendente');
  assert.equal(regraConfirmacao({ success: 'true', paid: 'true', amount: 9700 }, 9700), 'pendente', 'só booleano true vale');
});

test('comprovante só de domínio da InfinitePay', () => {
  assert.ok(reciboOk('https://recibo.infinitepay.io/abc'));
  assert.ok(reciboOk('https://infinitepay.io/r/1'));
  assert.ok(!reciboOk('https://infinitepay-login.evil/recibo'));
  assert.ok(!reciboOk('https://infinitepay.io.evil.com/x'));
  assert.ok(!reciboOk('http://recibo.infinitepay.io/abc'), 'só https');
  assert.ok(!reciboOk('nao é url') && !reciboOk(null));
});
