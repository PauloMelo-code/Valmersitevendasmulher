import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { lerPagina, PAGINAS } from '../src/pagina.ts';

test('PAGINA aceita só as páginas que existem; padrão é a das mulheres', () => {
  assert.equal(lerPagina(), PAGINAS.mulheres);
  assert.equal(lerPagina('geral'), PAGINAS.geral);
  assert.throws(() => lerPagina('homens'), /PAGINA deve ser/);
});

test('cada página tem os arquivos que o servidor e o login usam', () => {
  for (const p of Object.values(PAGINAS)) {
    const pasta = p.pasta ?? 'public';
    for (const arq of ['index.html', 'llms.txt']) assert.ok(fs.existsSync(`${pasta}/${arq}`), `${pasta}/${arq}`);
    assert.ok(fs.existsSync(`${pasta}${p.foto}`) || fs.existsSync(`public${p.foto}`), `foto do login ${p.foto}`);
    const html = fs.readFileSync(`${pasta}/index.html`, 'utf8');
    for (const marca of ['{{CHECKOUT_URL}}', '<!--PIXEL-->', '/t.js', '/consentimento.js', '{{EMPRESA_CNPJ}}', '/privacidade'])
      assert.ok(html.includes(marca), `${pasta}/index.html sem ${marca}`);
    assert.ok(!/livro digital|f[ií]sico \+ digital|aut[óo]graf/i.test(html), `${pasta}/index.html ainda promete digital ou autógrafo`);
  }
});
