import { env } from './ambiente.ts';

// Qual página de vendas este deploy serve (variável PAGINA). Mesmo código para as duas;
// `pasta` sobrepõe public/ (index.html, llms.txt e imagens próprias).
export const PAGINAS = {
  mulheres: {
    nome: 'Campanha mulheres', pasta: null,
    slogan: 'Chegou a vez das mulheres <em>liderarem.</em>', foto: '/img/cinco-mulheres-profissionais-em-um-ambiente-corpor.jpg',
  },
  geral: {
    nome: 'Página geral', pasta: 'paginas/geral',
    slogan: 'Saber fazer não significa <em>saber liderar.</em>', foto: '/img/valmer-albuquerque.webp',
  },
} as const;

export type NomePagina = keyof typeof PAGINAS;

export function lerPagina(valor = 'mulheres'): (typeof PAGINAS)[NomePagina] {
  if (!(valor in PAGINAS)) throw new Error(`PAGINA deve ser ${Object.keys(PAGINAS).map((p) => `"${p}"`).join(' ou ')}`);
  return PAGINAS[valor as NomePagina];
}

// Marca gravada em cada visita: é assim que o painel único separa as duas páginas.
export const NOME_PAGINA = env('PAGINA', 'mulheres').toLowerCase() as NomePagina;
export const PAGINA = lerPagina(NOME_PAGINA);
