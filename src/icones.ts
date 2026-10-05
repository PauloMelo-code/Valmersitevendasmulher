import fs from 'node:fs';
import path from 'node:path';

// Ícones Phosphor (SVG puro). Única entrada de ícones do projeto: nenhuma tela lê a biblioteca direto.
const NOMES = {
  painel: 'chart-line-up', visitantes: 'users', carrinho: 'shopping-cart-simple', alvo: 'target', relogio: 'clock',
  novos: 'user-plus', livro: 'book-open-text', saiu: 'sign-out', olho: 'eye', filtro: 'funnel', calendario: 'calendar-blank',
  baixar: 'download-simple', abrir: 'arrow-square-out', sol: 'sun', lua: 'moon', subiu: 'trend-up', desceu: 'trend-down',
  igual: 'minus', origem: 'globe-hemisphere-west', campanha: 'megaphone', anuncio: 'film-strip', celular: 'device-mobile',
  sistema: 'app-window', midia: 'share-network', clique: 'cursor-click', tabela: 'table', info: 'info', fechar: 'x',
  barras: 'chart-bar', copiar: 'copy', ok: 'check', vivo: 'broadcast', horario: 'clock-countdown',
} as const;
export type NomeIcone = keyof typeof NOMES;
type Peso = 'regular' | 'duotone' | 'fill';

const BASE = path.join(import.meta.dirname, '..', 'node_modules', '@phosphor-icons', 'core', 'assets');
const cache = new Map<string, string>();

export function icone(nome: NomeIcone, peso: Peso = 'regular', classe = ''): string {
  const chave = `${nome}:${peso}`;
  let svg = cache.get(chave);
  if (!svg) {
    const arquivo = `${NOMES[nome]}${peso === 'regular' ? '' : `-${peso}`}.svg`;
    svg = fs.readFileSync(path.join(BASE, peso, arquivo), 'utf8').replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
    cache.set(chave, svg);
  }
  return classe ? svg.replace('<svg ', `<svg class="${classe}" `) : svg;
}
