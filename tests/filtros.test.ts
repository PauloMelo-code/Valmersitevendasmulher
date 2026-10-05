import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lerFiltro, periodoAnterior, urlCom } from '../src/filtros.ts';

// 05/10/2026 15h UTC = 12h em Brasília
const AGORA = new Date('2026-10-05T15:00:00Z');
const ler = (q: string) => lerFiltro(new URLSearchParams(q), AGORA);

test('presets usam o dia de Brasília', () => {
  assert.deepEqual([ler('').de, ler('').ate, ler('').dias], ['2026-09-29', '2026-10-05', 7]);
  assert.deepEqual([ler('p=ontem').de, ler('p=ontem').ate], ['2026-10-04', '2026-10-04']);
  // 01h UTC do dia 06 ainda é dia 05 em Brasília
  assert.equal(lerFiltro(new URLSearchParams('p=hoje'), new Date('2026-10-06T01:00:00Z')).de, '2026-10-05');
  assert.equal(ler('p=xyz').preset, '7d');
});

test('período personalizado: inverte, corta futuro e limita a 1 ano', () => {
  const f = ler('p=custom&de=2026-10-03&ate=2026-09-20');
  assert.deepEqual([f.de, f.ate, f.dias], ['2026-09-20', '2026-10-03', 14]);
  assert.equal(ler('p=custom&de=2026-10-01&ate=2027-01-01').ate, '2026-10-05');
  assert.equal(ler('p=custom&de=2020-01-01&ate=2026-10-05').dias, 366);
  assert.equal(ler('p=custom&de=lixo&ate=2026-10-01').preset, '7d');
});

test('período anterior e montagem de URL', () => {
  const f = ler('p=7d&origem=facebook&campanha=x');
  assert.deepEqual([periodoAnterior(f).de, periodoAnterior(f).ate], ['2026-09-22', '2026-09-28']);
  assert.equal(urlCom(f, { origem: null }), '?p=7d&campanha=x');
  const dia = Object.fromEntries(new URLSearchParams(urlCom(f, { p: 'custom', de: '2026-10-01', ate: '2026-10-01' })));
  assert.deepEqual(dia, { p: 'custom', de: '2026-10-01', ate: '2026-10-01', origem: 'facebook', campanha: 'x' });
  assert.equal(ler('origem=' + 'a'.repeat(300)).dims.origem?.length, 120);
});
