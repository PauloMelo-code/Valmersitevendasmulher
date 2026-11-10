import assert from 'node:assert/strict';
import { test } from 'node:test';
import { celular, cepValido, chaveNfe, cpfValido, emailValido, ufValida, validarCompra } from '../src/validar.ts';

test('CPF: dígitos verificadores, máscara e repetidos', () => {
  for (const ok of ['529.982.247-25', '52998224725', '111.444.777-35']) assert.ok(cpfValido(ok), ok);
  for (const ruim of ['529.982.247-24', '111.111.111-11', '00000000000', '1234567890', '5299822472a', '']) assert.ok(!cpfValido(ruim), ruim);
});

test('celular com DDD: 10 ou 11 dígitos, aceita +55 e máscara', () => {
  assert.equal(celular('(44) 99999-8888'), '44999998888');
  assert.equal(celular('+55 44 99999-8888'), '44999998888');
  assert.equal(celular('4433221100'), '4433221100');
  for (const ruim of ['99999-8888', '(04) 99999-8888', '44 89999-8888', '449999988881234', '']) assert.equal(celular(ruim), '', ruim);
});

test('CEP, UF e e-mail', () => {
  assert.ok(cepValido('87013-060') && cepValido('87013060'));
  assert.ok(!cepValido('8701306') && !cepValido('87013-06a'));
  assert.ok(ufValida('PR') && !ufValida('pr') && !ufValida('XX'));
  assert.ok(emailValido('voce@email.com.br'));
  for (const ruim of ['voce@', 'voce email@x.com', 'a@b', '<x>@y.com']) assert.ok(!emailValido(ruim), ruim);
});

test('chave da NF-e: 44 dígitos com DV módulo 11, com e sem máscara', () => {
  const chave = '41251166911358000184550010000001231000001238';
  assert.equal(chaveNfe(chave), chave);
  assert.equal(chaveNfe('3525 1101 2345 6700 0198 5500 1000 0000 0110 0000 0019'), '35251101234567000198550010000000011000000019');
  assert.equal(chaveNfe('4125.1166.9113.5800.0184.5500.1000.0001.2310.0000.1238'), chave);
  assert.equal(chaveNfe(chave.slice(0, 43) + '7'), '', 'DV errado');
  assert.equal(chaveNfe(chave.slice(1)), '', '43 dígitos');
  assert.equal(chaveNfe(chave + '1'), '', '45 dígitos');
});

test('formulário de compra: normaliza e aponta erro por campo', () => {
  const base = {
    nome: '  Maria   da Silva ', email: 'Maria@Email.COM', celular: '(44) 99999-8888', cpf: '529.982.247-25', cep: '87013-060',
    rua: 'Rua Néo Alves Martins', numero: '2789', complemento: '', bairro: 'Zona 01', cidade: 'Maringá', uf: 'PR',
    visitante: 'abc123def456', utm_source: 'Facebook', utm_campaign: 'bf-mulheres',
  };
  const ok = validarCompra(new URLSearchParams(base));
  assert.deepEqual(ok.erros, {});
  assert.equal(ok.dados?.nome, 'Maria da Silva');
  assert.equal(ok.dados?.email, 'maria@email.com');
  assert.equal(ok.dados?.telefone, '44999998888');
  assert.equal(ok.dados?.cpf, '52998224725');
  assert.equal(ok.dados?.cep, '87013060');
  assert.equal(ok.dados?.complemento, null);
  assert.equal(ok.dados?.origem, 'facebook');
  assert.equal(validarCompra(new URLSearchParams({ ...base, visitante: "x'; drop" })).dados?.visitante, null);

  const ruim = validarCompra(new URLSearchParams({ ...base, nome: 'Maria', cpf: '111.111.111-11', uf: 'XX', rua: '<script>' }));
  assert.equal(ruim.dados, undefined);
  assert.deepEqual(Object.keys(ruim.erros).sort(), ['cpf', 'nome', 'rua', 'uf']);
});
