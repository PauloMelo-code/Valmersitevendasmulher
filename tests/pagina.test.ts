import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { precoAgora } from '../src/infinitepay.ts';
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
    assert.ok(!html.includes('R$ 197'), `${pasta}/index.html com o valor antigo`);
    // Nenhum campo "{{...}}" a preencher pode aparecer para o visitante (fora de comentário e dos que o servidor troca).
    const visivel = html.replace(/<!--[\s\S]*?-->/g, '').match(/\{\{(?!CHECKOUT_URL\}\}|EMPRESA_|CONTATO_EMAIL|SITE_URL)[A-Z0-9_]+\}\}/g);
    assert.equal(visivel, null, `${pasta}/index.html com campo a preencher à mostra`);
  }
});

test('página geral: sem prazo, o preço do config.js é o que o /comprar cobra e os botões vão ao /comprar', () => {
  const cfg = fs.readFileSync('paginas/geral/js/config.js', 'utf8');
  const html = fs.readFileSync('paginas/geral/index.html', 'utf8');
  assert.equal(PAGINAS.geral.prazo, null);
  assert.equal(Number(/var PRECO = (\d+);/.exec(cfg)?.[1]) * 100, precoAgora(null));
  assert.match(cfg, /CHECKOUT_URL: "\/comprar"/);
  assert.ok(!/lider\.lideresdeimpacto\.com\.br/.test(html + cfg), 'endereço fixo quebra a página de Maringá: usar /comprar e {{SITE_URL}}');
  assert.ok(!fs.existsSync('paginas/geral/referencias'), 'referencias/ seria servida ao público');
});

test('Maringá: todas as trocas acham o texto da página geral e não sobra frete nem envio', () => {
  const geral = fs.readFileSync('paginas/geral/index.html', 'utf8');
  const { html, faltando } = aplicarTrocas(geral, PAGINAS.maringa.trocas);
  assert.deepEqual(faltando, [], 'o texto da página geral mudou: ajustar PAGINAS.maringa.trocas');
  // Só o texto visível: a página nova usa "frete" em nomes de classe (item--frete).
  assert.equal(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').match(/frete|enviad|correio|rastreio|sua casa/gi), null);
  assert.ok(html.includes('entregue em mãos pelo Valmer em Maringá'));
  assert.ok(emMaos({ pagina: 'maringa' }) && !emMaos({ pagina: 'geral' }) && !emMaos({ pagina: 'mulheres' }));
});
