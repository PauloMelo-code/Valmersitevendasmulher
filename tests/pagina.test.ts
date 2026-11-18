import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { aplicarTrocas, emMaos, lerPagina, PAGINAS } from '../src/pagina.ts';

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
    // A página geral (refeita pelo Valmer) traz pixel, consentimento e rastreio próprios em js/main.js.
    const marcas = p.pasta ? ['href="/comprar"', 'CNPJ', '/privacidade', 'js/config.js', 'js/main.js']
      : ['{{CHECKOUT_URL}}', '<!--PIXEL-->', '/t.js', '/consentimento.js', '{{EMPRESA_CNPJ}}', '/privacidade'];
    for (const marca of marcas) assert.ok(html.includes(marca), `${pasta}/index.html sem ${marca}`);
    assert.ok(!/livro digital|f[ií]sico \+ digital|aut[óo]graf/i.test(html), `${pasta}/index.html ainda promete digital ou autógrafo`);
    assert.ok(html.includes('BLACK FRIDAY') && !html.includes('R$ 197'), `${pasta}/index.html sem a tarja ou com o valor antigo`);
    // Nenhum campo "{{...}}" a preencher pode aparecer para o visitante (fora de comentário e dos que o servidor troca).
    const visivel = html.replace(/<!--[\s\S]*?-->/g, '').match(/\{\{(?!CHECKOUT_URL\}\}|EMPRESA_|CONTATO_EMAIL|SITE_URL)[A-Z0-9_]+\}\}/g);
    assert.equal(visivel, null, `${pasta}/index.html com campo a preencher à mostra`);
  }
});

test('página geral: prazo da Black Friday no servidor é o mesmo do config.js e os botões vão ao /comprar', () => {
  const cfg = fs.readFileSync('paginas/geral/js/config.js', 'utf8');
  assert.equal(/DEADLINE = "([^"]+)"/.exec(cfg)?.[1], PAGINAS.geral.prazo.ate);
  assert.match(cfg, /CHECKOUT_URL_147: "\/comprar"/);
  assert.match(cfg, /CHECKOUT_URL_497: "\/comprar"/);
  assert.match(cfg, new RegExp(`PRECO_CHEIO: ${PAGINAS.geral.prazo.depoisCentavos / 100}\\b`));
});

test('Maringá: todas as trocas acham o texto da página geral e não sobra frete nem envio', () => {
  const geral = fs.readFileSync('paginas/geral/index.html', 'utf8');
  const { html, faltando } = aplicarTrocas(geral, PAGINAS.maringa.trocas);
  assert.deepEqual(faltando, [], 'o texto da página geral mudou: ajustar PAGINAS.maringa.trocas');
  assert.equal(html.replace(/<!--[\s\S]*?-->/g, '').match(/frete|enviad|correio|rastreio|sua casa/gi), null);
  assert.ok(html.includes('entregue em mãos pelo Valmer em Maringá'));
  assert.ok(emMaos({ pagina: 'maringa' }) && !emMaos({ pagina: 'geral' }) && !emMaos({ pagina: 'mulheres' }));
});
