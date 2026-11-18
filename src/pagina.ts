import { env } from './ambiente.ts';

// Qual página de vendas este deploy serve (variável PAGINA). Mesmo código para todas;
// `pasta` sobrepõe public/ (index.html, llms.txt e imagens próprias).
// `envio` é a frase de entrega do /comprar e do /obrigado. `emMaos`: o livro não vai pelo Melhor Envio
// (a rotina emite a NF-e e para; o painel marca "entregue em mãos"). `trocas`: [de, para] aplicadas ao index.html da pasta.
type Pagina = {
  nome: string; pasta: string | null; slogan: string; foto: string; envio: string; emMaos: boolean;
  prazo: { ate: string; depoisCentavos: number } | null; trocas: readonly (readonly [string, string])[];
};

const GERAL = {
  nome: 'Página geral', pasta: 'paginas/geral',
  slogan: 'Saber fazer não significa <em>saber liderar.</em>', foto: '/assets/img/valmer-albuquerque.webp',
  envio: 'O livro é enviado no dia seguinte à compra, com frete grátis e código de rastreio por e-mail', emMaos: false,
  // Black Friday: igual ao DEADLINE de paginas/geral/js/config.js (o teste confere). Depois dele o /comprar cobra o preço cheio.
  prazo: { ate: '2026-12-10T23:59:59-03:00', depoisCentavos: 49700 }, trocas: [],
} as const satisfies Pagina;

const EM_MAOS = 'entregue em mãos pelo Valmer em Maringá';

export const PAGINAS = {
  mulheres: {
    nome: 'Campanha mulheres', pasta: null,
    slogan: 'Chegou a vez das mulheres <em>liderarem.</em>', foto: '/img/cinco-mulheres-profissionais-em-um-ambiente-corpor.jpg',
    envio: 'O livro é enviado após 10 dias da compra, com frete grátis e código de rastreio por e-mail', emMaos: false, prazo: null, trocas: [],
  },
  geral: GERAL,
  // A página geral em outro domínio (SITE_URL do serviço), com o livro entregue em mãos no lugar do frete.
  maringa: {
    ...GERAL, nome: 'Página Maringá', envio: `O livro é ${EM_MAOS}`, emMaos: true,
    trocas: [
      ['Frete grátis para todo o Brasil e garantia de 7 dias.', 'Livro entregue em mãos em Maringá e garantia de 7 dias.'],
      ['3 manuais. Frete grátis e garantia de 7 dias.', '3 manuais. Livro entregue em mãos em Maringá e garantia de 7 dias.'],
      ['Frete grátis · Garantia de 7 dias · Acesso imediato às aulas', 'Entrega em mãos em Maringá · Garantia de 7 dias · Acesso imediato às aulas'],
      ['o livro físico, enviado para a sua casa com frete grátis.', `o livro físico, ${EM_MAOS}.`],
      ['<span>Frete para todo o Brasil</span><i></i><b>GRÁTIS</b>', '<span>Entrega em mãos em Maringá</span><i></i><b>INCLUÍDA</b>'],
      ['Compra 100% segura · Frete grátis · Garantia de 7 dias', 'Compra 100% segura · Entrega em mãos em Maringá · Garantia de 7 dias'],
      ['<h3>No dia seguinte.</h3><p>O livro físico é enviado para a sua casa, com frete grátis.</p>', `<h3>Em mãos.</h3><p>O livro físico é ${EM_MAOS}.</p>`],
      ['Você começa antes mesmo de o livro chegar.', 'Você começa antes mesmo de receber o livro.'],
      ['Quando o livro é enviado?</button></h3><div class="acc-p"><div><p>No dia seguinte à compra, com frete grátis para todo o Brasil.</p>',
        `Como recebo o livro?</button></h3><div class="acc-p"><div><p>O livro é ${EM_MAOS}. O acesso às aulas chega no seu e-mail logo após o pagamento.</p>`],
    ],
  },
} as const satisfies Record<string, Pagina>;

export type NomePagina = keyof typeof PAGINAS;

export function lerPagina(valor = 'mulheres'): Pagina {
  if (!(valor in PAGINAS)) throw new Error(`PAGINA deve ser ${Object.keys(PAGINAS).map((p) => `"${p}"`).join(' ou ')}`);
  return PAGINAS[valor as NomePagina];
}

// Aplica as trocas de texto da página; `faltando` lista as que não acharam o trecho (texto da página mudou).
export function aplicarTrocas(html: string, trocas: Pagina['trocas']): { html: string; faltando: string[] } {
  const faltando: string[] = [];
  for (const [de, para] of trocas) {
    if (html.includes(de)) html = html.replaceAll(de, para);
    else faltando.push(de);
  }
  return { html, faltando };
}

// Pedidos de páginas com entrega em mãos (chave gravada no pedido).
export const PAGINAS_EM_MAOS = Object.entries(PAGINAS).filter(([, p]) => p.emMaos).map(([k]) => k);
export const emMaos = (p: { pagina: string }) => PAGINAS_EM_MAOS.includes(p.pagina);

// Marca gravada em cada visita: é assim que o painel único separa as páginas.
export const NOME_PAGINA = env('PAGINA', 'mulheres').toLowerCase() as NomePagina;
export const PAGINA = lerPagina(NOME_PAGINA);
