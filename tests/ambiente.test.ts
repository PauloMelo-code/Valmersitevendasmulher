import assert from 'node:assert/strict';
import { test } from 'node:test';
import { env } from '../src/ambiente.ts';

test('variável colada com espaço, quebra de linha ou aspas é limpa', () => {
  for (const bruto of ['geral', ' geral ', 'geral\n', '"geral"', "'geral'", ' "geral" ']) {
    process.env.TESTE_AMBIENTE = bruto;
    assert.equal(env('TESTE_AMBIENTE'), 'geral', JSON.stringify(bruto));
  }
  process.env.TESTE_AMBIENTE = 'senha"com"aspas';
  assert.equal(env('TESTE_AMBIENTE'), 'senha"com"aspas', 'aspas no meio ficam');
  delete process.env.TESTE_AMBIENTE;
  assert.equal(env('TESTE_AMBIENTE', 'padrao'), 'padrao');
});
