import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bloqueado, chaveDe, credenciaisOk, criarSessao, lerCookie, registrarFalha, sessaoValida } from '../src/sessao.ts';

const chave = chaveDe('admin', 'senha-forte-123');

test('sessão assinada vale até expirar e só com a mesma chave', () => {
  const agora = Date.now(), s = criarSessao(chave, agora);
  assert.ok(sessaoValida(s, chave, agora));
  assert.ok(!sessaoValida(s, chave, agora + 8 * 86400000), 'expirada');
  assert.ok(!sessaoValida(s, chaveDe('admin', 'outra-senha-123'), agora), 'senha trocada derruba sessão');
  assert.ok(!sessaoValida(s.replace(/^\d/, '9'), chave, agora), 'validade adulterada');
  assert.ok(!sessaoValida(undefined, chave, agora));
});

test('credenciais e cookie', () => {
  assert.ok(credenciaisOk('admin', 'senha-forte-123', 'admin', 'senha-forte-123'));
  assert.ok(!credenciaisOk('admin', 'errada', 'admin', 'senha-forte-123'));
  assert.ok(!credenciaisOk('admin', 'curta', 'admin', 'curta'), 'senha curta nunca entra');
  assert.equal(lerCookie('a=1; painel_sessao=x.y=z; b=2', 'painel_sessao'), 'x.y=z');
});

test('bloqueia após 10 falhas em 15 minutos', () => {
  const t = Date.now();
  for (let i = 0; i < 10; i++) registrarFalha(t);
  assert.ok(bloqueado(t + 1000));
  assert.ok(!bloqueado(t + 16 * 60000));
});
