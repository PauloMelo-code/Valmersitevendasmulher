// Lê variável de ambiente sem as sobras de colar no painel do Easypanel: espaço, quebra de linha e aspas nas pontas.
export const env = (nome: string, padrao = '') =>
  (process.env[nome] ?? padrao).trim().replace(/^(["'])(.*)\1$/s, '$2').trim();

// Opcionais: valor inválido não derruba o site; avisa no log (com o que chegou) e desliga só aquele item.
// `secreto` esconde o valor no aviso (token, segredo).
export function opcional(nome: string, formato: RegExp, comoDeveSer: string, secreto = false): string {
  const v = env(nome);
  if (!v || formato.test(v)) return v;
  console.warn(`${nome} ignorada: recebi ${secreto ? `${v.length} caracteres` : JSON.stringify(v)}, mas ${comoDeveSer}. O site sobe sem ela.`);
  return '';
}

// Base de API sobreposta só em teste local: https ou http em 127.0.0.1/localhost.
export const URL_API = /^(https:\/\/[^\s/]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)(\/\S*)?$/;

export const PORT = Number(env('PORT', '3000'));
const SITE_BRUTO = env('SITE_URL', `http://localhost:${PORT}`);
export const SITE_URL = (/^https?:\/\//i.test(SITE_BRUTO) ? SITE_BRUTO : `https://${SITE_BRUTO}`).replace(/\/+$/, '');
if (!/^https?:\/\/[^/\s]+$/.test(SITE_URL)) {
  throw new Error(`SITE_URL inválida: recebi ${JSON.stringify(SITE_BRUTO)}. Use só o endereço, ex.: https://lider.lideresdeimpacto.com.br`);
}

// Dados do vendedor (rodapé, /privacidade e /comprar). Padrão = Editora Signature Ltda; o ambiente sobrepõe se mudar.
const EMPRESA_PADRAO = {
  RAZAO: 'Editora Signature Ltda',
  CNPJ: '66.911.358/0001-84',
  ENDERECO: 'Rua Néo Alves Martins, 2789, Sala 103/104, Zona 01, Maringá/PR, CEP 87013-060',
  CONTATO: 'editorasignature@gmail.com',
};
export const EMPRESA = {
  RAZAO: opcional('EMPRESA_RAZAO', /^[^<>]+$/, 'deve ser o nome da empresa (sem o texto de exemplo entre < >)') || EMPRESA_PADRAO.RAZAO,
  CNPJ: opcional('EMPRESA_CNPJ', /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, 'deve ser um CNPJ (ex.: 12.345.678/0001-90)') || EMPRESA_PADRAO.CNPJ,
  ENDERECO: opcional('EMPRESA_ENDERECO', /^[^<>]+$/, 'deve ser o endereço (sem o texto de exemplo entre < >)') || EMPRESA_PADRAO.ENDERECO,
  CONTATO: opcional('CONTATO_EMAIL', /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/, 'deve ser um e-mail') || EMPRESA_PADRAO.CONTATO,
};

// LGPD: o Pixel não carrega aqui. O consentimento.js só o liga depois do "Aceitar" (e sem <noscript>,
// que dispararia sem escolha). Sem PIXEL, não há banner.
const PIXEL = opcional('META_PIXEL_ID', /^\d{5,20}$/, 'deve ter só os números do pixel (ex.: 1234567890123456)');
export const PIXEL_TAG = PIXEL ? `<script>window.LV_PIXEL='${PIXEL}'</script>` : '';
