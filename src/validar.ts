// Validação na borda do que o comprador digita em /comprar e do que o painel recebe. Tudo vem de fora: desconfiar.

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

export const digitos = (s: string) => s.replace(/\D/g, '');
// Tira caracteres de controle e junta espaços repetidos.
export const limpar = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function cpfValido(cpf: string): boolean {
  const d = digitos(cpf);
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}

// Aceita "+55 (44) 99999-8888": devolve só DDD + número (10 ou 11 dígitos), ou '' se inválido.
export function celular(s: string): string {
  let d = digitos(s);
  if (/^55\d{10,11}$/.test(d)) d = d.slice(2);
  if (!/^[1-9][1-9]\d{8,9}$/.test(d)) return '';
  if (d.length === 11 && d[2] !== '9') return '';
  return d;
}

export const cepValido = (s: string) => /^\d{8}$/.test(digitos(s)) && digitos(s).length === s.replace(/[\s.-]/g, '').length;
export const ufValida = (s: string) => (UFS as readonly string[]).includes(s);
export const emailValido = (s: string) => s.length <= 120 && /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i.test(s);

// Chave de acesso da NF-e: 44 dígitos, o último é o DV em módulo 11 (pesos 2..9 da direita para a esquerda).
export function chaveNfe(s: string): string {
  const d = digitos(s);
  if (d.length !== 44 || s.replace(/[\s.\-/]/g, '').length !== 44) return '';
  let soma = 0, peso = 2;
  for (let i = 42; i >= 0; i--) { soma += Number(d[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const resto = soma % 11, dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(d[43]) ? d : '';
}

export type DadosCompra = {
  nome: string; email: string; telefone: string; cpf: string;
  cep: string; rua: string; numero: string; complemento: string | null; bairro: string; cidade: string; uf: string;
  visitante: string | null; origem: string | null; campanha: string | null; midia: string | null; conjunto: string | null; conteudo: string | null;
};
export type Campo = 'nome' | 'email' | 'celular' | 'cpf' | 'cep' | 'rua' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf';

const NOME = /^\p{L}[\p{L}'´`.-]*(\s\p{L}[\p{L}'´`.-]*)+$/u;
const TEXTO = /^[\p{L}\p{N}\s'´`.,ºª°/()#&-]+$/u;
const opt = (v: string | null, max = 120) => (v ? limpar(v, max) || null : null);

// Devolve os dados normalizados ou os erros por campo (mensagem pronta para a tela).
export function validarCompra(f: URLSearchParams): { dados?: DadosCompra; erros: Partial<Record<Campo, string>> } {
  const v = (k: string, max: number) => limpar(f.get(k) ?? '', max);
  const erros: Partial<Record<Campo, string>> = {};
  const nome = v('nome', 100), email = v('email', 120).toLowerCase(), tel = celular(f.get('celular') ?? '');
  const cpf = digitos(f.get('cpf') ?? '').slice(0, 11), cep = digitos(v('cep', 12));
  const rua = v('rua', 120), numero = v('numero', 10), complemento = v('complemento', 60), bairro = v('bairro', 80), cidade = v('cidade', 80), uf = v('uf', 2).toUpperCase();

  if (!NOME.test(nome) || nome.length < 5) erros.nome = 'Digite seu nome completo (nome e sobrenome).';
  if (!emailValido(email)) erros.email = 'Digite um e-mail válido, ex.: voce@email.com.';
  if (!tel) erros.celular = 'Digite o celular com DDD, ex.: (44) 99999-8888.';
  if (!cpfValido(f.get('cpf') ?? '')) erros.cpf = 'CPF inválido. Confira os 11 números.';
  if (!cepValido(v('cep', 12))) erros.cep = 'Digite o CEP com 8 números.';
  if (!rua || !TEXTO.test(rua)) erros.rua = 'Digite a rua (só letras, números e pontuação comum).';
  if (!/^[\p{L}\p{N}\s/.-]{1,10}$/u.test(numero)) erros.numero = 'Digite o número (ou S/N).';
  if (complemento && !TEXTO.test(complemento)) erros.complemento = 'Use só letras, números e pontuação comum.';
  if (!bairro || !TEXTO.test(bairro)) erros.bairro = 'Digite o bairro.';
  if (!cidade || !TEXTO.test(cidade)) erros.cidade = 'Digite a cidade.';
  if (!ufValida(uf)) erros.uf = 'Escolha o estado.';
  if (Object.keys(erros).length) return { erros };

  const visitante = /^[a-z0-9]{6,40}$/.test(f.get('visitante') ?? '') ? f.get('visitante') : null;
  return {
    erros,
    dados: {
      nome, email, telefone: tel, cpf, cep, rua, numero, complemento: complemento || null, bairro, cidade, uf, visitante,
      origem: opt(f.get('utm_source'))?.toLowerCase() ?? null, campanha: opt(f.get('utm_campaign')),
      midia: opt(f.get('utm_medium')), conjunto: opt(f.get('utm_term')), conteudo: opt(f.get('utm_content')),
    },
  };
}
