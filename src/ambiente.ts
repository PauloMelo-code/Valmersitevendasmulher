// Lê variável de ambiente sem as sobras de colar no painel do Easypanel: espaço, quebra de linha e aspas nas pontas.
export const env = (nome: string, padrao = '') =>
  (process.env[nome] ?? padrao).trim().replace(/^(["'])(.*)\1$/s, '$2').trim();
