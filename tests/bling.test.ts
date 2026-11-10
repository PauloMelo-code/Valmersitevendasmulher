import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assinarEstado, BLING, cifrar, corpoContato, corpoPedido, decifrar, estadoValido, idCriado, idNotaGerada, legivel, lerNota, notaDoPedido, primeiroId, situacaoNfe,
} from '../src/bling.ts';

const SEGREDO = 'segredo-do-app-no-bling-1234567890';
const cfg = { ...BLING, clientId: 'cliente123', clientSecret: SEGREDO, sku: 'LIVRO-LI', formaPagamentoId: '777', lojaId: '', naturezaId: '' };
const pedido = {
  orderNsu: 'LI-ABCDEFGH23', valorCentavos: 9700, nome: 'Maria da Silva', email: 'maria@email.com', telefone: '44999998888', cpf: '52998224725',
  metodo: 'pix', pagoEm: new Date('2026-11-02T02:30:00Z'), // 01/11 no horário de Brasília
  cep: '01310100', rua: 'Av. Paulista', numero: '1000', complemento: 'Apto 12', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP',
};
const produto = { id: 555, nome: 'Livro Liderança Inteligente', preco: 97 };

test('contato: pessoa física não contribuinte com endereço completo', () => {
  assert.deepEqual(corpoContato(pedido), {
    nome: 'Maria da Silva', tipo: 'F', situacao: 'A', numeroDocumento: '52998224725', email: 'maria@email.com', celular: '44999998888', indicadorIe: 9,
    endereco: { geral: { endereco: 'Av. Paulista', numero: '1000', complemento: 'Apto 12', bairro: 'Bela Vista', cep: '01310-100', municipio: 'São Paulo', uf: 'SP' } },
  });
});

test('pedido de venda: datas de hoje em SP, numeroLoja, item pelo produto.id, parcela na data do pagamento, frete CIF', () => {
  const agora = new Date('2026-11-10T01:00:00Z'); // ainda 09/11 em São Paulo
  const c = corpoPedido(cfg, pedido, '9001', produto, agora);
  assert.deepEqual(c.contato, { id: 9001, nome: 'Maria da Silva' });
  assert.equal(c.data, '2026-11-09');
  assert.equal(c.dataSaida, '2026-11-09');
  assert.equal(c.dataPrevista, '2026-11-09');
  assert.equal(c.numeroLoja, 'LI-ABCDEFGH23');
  assert.ok(!('loja' in c));
  assert.deepEqual(c.itens, [{ produto: { id: 555 }, codigo: 'LIVRO-LI', descricao: 'Livro Liderança Inteligente', quantidade: 1, valor: 97 }]);
  assert.deepEqual(c.parcelas, [{ dataVencimento: '2026-11-01', valor: 97, formaPagamento: { id: 777 } }]);
  assert.equal(c.transporte.fretePorConta, 0);
  assert.equal(c.transporte.frete, 0);
  assert.deepEqual(c.transporte.etiqueta, { nome: 'Maria da Silva', endereco: 'Av. Paulista', numero: '1000', complemento: 'Apto 12', municipio: 'São Paulo', uf: 'SP', cep: '01310-100', bairro: 'Bela Vista', nomePais: 'Brasil' });
  assert.equal(c.observacoes, 'Pedido LI-ABCDEFGH23 da página de vendas · pago via InfinitePay (pix)');

  const com = corpoPedido({ ...cfg, lojaId: '123', naturezaId: '456' }, pedido, '9001', produto, agora);
  assert.deepEqual(com.loja, { id: 123 });
  assert.deepEqual(com.itens[0].naturezaOperacao, { id: 456 });
});

test('leitura das respostas: idNotaFiscal com e sem envelope data, ids e nota', () => {
  assert.equal(idNotaGerada({ idNotaFiscal: 123 }), '123');
  assert.equal(idNotaGerada({ data: { idNotaFiscal: 456 } }), '456');
  assert.equal(idNotaGerada({ data: {} }), null);
  assert.equal(idCriado({ data: { id: 99 } }), '99');
  assert.equal(primeiroId({ data: [{ id: 7 }, { id: 8 }] }), '7');
  assert.equal(primeiroId({ data: [] }), null);
  assert.equal(notaDoPedido({ data: { id: 1, notaFiscal: { id: 31 } } }), '31');
  assert.equal(notaDoPedido({ data: { id: 1, notaFiscal: { id: 0 } } }), null);
  assert.deepEqual(lerNota({ data: { situacao: 5, numero: '000123', chaveAcesso: '4125', linkDanfe: 'https://www.bling.com.br/danfe?accessKey=x' } }),
    { situacao: 5, numero: '000123', chave: '4125', danfe: 'https://www.bling.com.br/danfe?accessKey=x' });
  assert.equal(lerNota({ data: { situacao: 1, linkDanfe: 'javascript:alert(1)' } }).danfe, null);
});

test('situação da NF-e 1–11 (tabela de /nfe)', () => {
  const esperado = ['pendente', 'cancelada', 'pendente', 'recusada', 'autorizada', 'autorizada', 'autorizada', 'pendente', 'recusada', 'pendente', 'recusada'];
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => situacaoNfe(n)[1]), esperado);
  assert.equal(situacaoNfe(4)[0], 'Rejeitada');
  assert.equal(situacaoNfe(9)[0], 'Denegada');
  assert.equal(situacaoNfe(11)[0], 'Bloqueada');
  assert.equal(situacaoNfe(42)[1], 'pendente', 'situação desconhecida: espera (e cai no limite de 2 h)');
});

test('cifra dos tokens: ida e volta; AAD, segredo ou cifra errados falham', () => {
  const jwt = 'eyJ' + 'a'.repeat(2997); // JWT do Bling: 1.500–3.000 caracteres
  const c = cifrar(SEGREDO, 'bling', jwt);
  assert.ok(!c.includes(jwt.slice(0, 40)));
  assert.equal(decifrar(SEGREDO, 'bling', c), jwt);
  assert.notEqual(cifrar(SEGREDO, 'bling', jwt), c, 'IV aleatório');
  assert.throws(() => decifrar(SEGREDO, 'outra', c));
  assert.throws(() => decifrar('outro-segredo-qualquer-123456', 'bling', c));
  const partes = c.split('.');
  partes[3] = Buffer.from('x' + Buffer.from(partes[3], 'base64url').toString('latin1').slice(1), 'latin1').toString('base64url');
  assert.throws(() => decifrar(SEGREDO, 'bling', partes.join('.')));
  // Tag truncada (o Node aceitaria até 4 bytes): tem de falhar.
  const curta = c.split('.');
  curta[2] = Buffer.from(curta[2], 'base64url').subarray(0, 4).toString('base64url');
  assert.throws(() => decifrar(SEGREDO, 'bling', curta.join('.')), /formato/);
});

test('state do OAuth: vale 10 min, preso à sessão do painel, não aceita adulteração', () => {
  const agora = 1_800_000_000_000, sessao = '1800000000000.abc';
  const st = assinarEstado(SEGREDO, sessao, agora);
  assert.ok(estadoValido(SEGREDO, st, sessao, agora + 60_000));
  assert.equal(estadoValido(SEGREDO, st, sessao, agora + 11 * 60_000), false, 'expirado');
  assert.equal(estadoValido(SEGREDO, st, 'outra-sessao', agora), false, 'outra sessão');
  assert.equal(estadoValido('outro-segredo-qualquer-123456', st, sessao, agora), false);
  const [exp, nonce, mac] = st.split('.');
  assert.equal(estadoValido(SEGREDO, `${Number(exp) + 3_600_000}.${nonce}.${mac}`, sessao, agora), false, 'prazo adulterado');
  assert.equal(estadoValido(SEGREDO, `${exp}.${nonce}.${mac.slice(0, -1)}${mac.endsWith('A') ? 'B' : 'A'}`, sessao, agora), false, 'mac adulterado');
  assert.equal(estadoValido(SEGREDO, '', sessao, agora), false);
});

test('erro do Bling legível e sem dado pessoal', () => {
  const msg = legivel(400, { error: { type: 'VALIDATION_ERROR', message: 'x', description: 'Não foi possível salvar', fields: [{ code: 1, msg: 'CPF 529.982.247-25 inválido' }, { code: 2, msg: 'E-mail maria@email.com inválido' }] } });
  assert.match(msg, /^Bling respondeu 400: Não foi possível salvar · CPF … inválido · E-mail … inválido$/);
  assert.match(legivel(403, { error: { type: 'insufficient_scope', description: 'escopo' } }), /Falta escopo/);
  const m403 = legivel(403, { error: { type: 'insufficient_scope', description: `CPF 529.982.247-25 de maria@email.com ${'x'.repeat(600)}` } });
  assert.ok(m403.length <= 400 && !m403.includes('529.982') && !m403.includes('@'), '403 passa pelo mesmo filtro');
});
