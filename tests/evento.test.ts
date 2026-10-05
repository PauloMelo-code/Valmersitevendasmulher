import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lerEvento } from '../src/evento.ts';

const UA_CEL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148';
const ler = (d: unknown, ua = UA_CEL) => lerEvento(JSON.stringify(d), ua, 'lideranca.com.br');

test('aceita view com UTM e detecta celular', () => {
  const e = ler({ t: 'view', v: 'abc123xyz', o: 'Facebook', c: 'mulheres-out' });
  assert.equal(e?.origem, 'facebook');
  assert.equal(e?.campanha, 'mulheres-out');
  assert.equal(e?.dispositivo, 'celular');
});

test('origem cai para o domínio de quem indicou, e para "direto" se for o próprio site', () => {
  assert.equal(ler({ t: 'view', v: 'abc123xyz', r: 'https://www.instagram.com/x' })?.origem, 'instagram.com');
  assert.equal(ler({ t: 'view', v: 'abc123xyz', r: 'https://lm.facebook.com/l.php' })?.origem, 'facebook.com');
  assert.equal(ler({ t: 'view', v: 'abc123xyz', r: 'https://lideranca.com.br/?a=1' })?.origem, 'direto');
  assert.equal(ler({ t: 'view', v: 'abc123xyz' })?.origem, 'direto');
});

test('rejeita lixo, bots e valores fora do esperado', () => {
  assert.equal(lerEvento('{nao json', UA_CEL, 'x'), null);
  assert.equal(ler({ t: 'delete', v: 'abc123xyz' }), null);
  assert.equal(ler({ t: 'view', v: "'; drop table--" }), null);
  assert.equal(ler({ t: 'scroll', v: 'abc123xyz', n: 33 }), null);
  assert.equal(ler({ t: 'sair', v: 'abc123xyz', n: -5 }), null);
  assert.equal(ler({ t: 'view', v: 'abc123xyz' }, 'facebookexternalhit/1.1'), null);
  assert.equal(ler({ t: 'view', v: 'abc123xyz' }, ''), null);
});

test('limita tempo e texto do botão', () => {
  assert.equal(ler({ t: 'sair', v: 'abc123xyz', n: 999999 })?.valor, 86400);
  assert.equal(ler({ t: 'click', v: 'abc123xyz', b: 'x'.repeat(500) })?.detalhe?.length, 80);
});
