import type { Celula, Dia, Resumo } from './consultas.ts';

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const num = (n: number) => n.toLocaleString('pt-BR');
export const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
export const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
export const SEMANA = ['', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
export const SEMANA_LONGA = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const rotuloValor = (v: string) => (v === '(sem)' ? '(não informado)' : v);
export const tempo = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s` : `${s}s`);

// Topo do eixo em número redondo (4 divisões de 1, 2, 2,5 ou 5 × 10^n).
function escala(max: number, minimo: number): number {
  const bruto = Math.max(max, minimo) / 4, mag = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto)!;
  return passo * 4;
}

export type Serie = { valor: (d: Dia) => number; formato: (v: number) => string; dica: (d: Dia) => string; minimo: number };

const W = 1000, H = 400, L = 48, R = 12, T = 14, B = 30;

function eixos(max: number, formato: (v: number) => string, dias: Dia[], passo: number): string {
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i, y = T + (H - T - B) * (1 - i / 4);
    g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grade"/><text x="${L - 10}" y="${y + 4}" text-anchor="end" class="eixo">${formato(v)}</text>`;
  }
  const cada = Math.ceil(dias.length / 10);
  dias.forEach((d, i) => {
    if (i % cada === 0) g += `<text x="${L + passo * i + passo / 2}" y="${H - 8}" text-anchor="middle" class="eixo">${ddmm(d.dia)}</text>`;
  });
  return g;
}

// Barras com cantos arredondados só na ponta (4px), uma série, um eixo.
export function graficoBarras(dias: Dia[], s: Serie, rotulo: string): string {
  if (!dias.length) return '';
  const ih = H - T - B, passo = (W - L - R) / dias.length, max = escala(Math.max(...dias.map(s.valor)), s.minimo);
  const larg = Math.max(3, Math.min(36, passo * 0.6));
  let g = eixos(max, s.formato, dias, passo);
  dias.forEach((d, i) => {
    const v = s.valor(d), h = (v / max) * ih, x = L + passo * i + (passo - larg) / 2, y = T + ih - h, r = Math.min(4, h, larg / 2);
    const barra = h > 0 ? `<path class="serie" d="M${x},${T + ih}V${y + r}Q${x},${y} ${x + r},${y}H${x + larg - r}Q${x + larg},${y} ${x + larg},${y + r}V${T + ih}Z"/>` : '';
    g += `<g class="col"><rect class="alvo" x="${L + passo * i}" y="${T}" width="${passo}" height="${ih}"/>${barra}<title>${esc(s.dica(d))}</title></g>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="svg-graf" role="img" aria-label="${esc(rotulo)}">${g}</svg>`;
}

export function graficoLinha(dias: Dia[], s: Serie, rotulo: string): string {
  if (!dias.length) return '';
  const ih = H - T - B, passo = (W - L - R) / dias.length, max = escala(Math.max(...dias.map(s.valor)), s.minimo);
  const pts = dias.map((d, i) => [L + passo * i + passo / 2, T + ih - (s.valor(d) / max) * ih] as const);
  let g = eixos(max, s.formato, dias, passo);
  if (pts.length > 1) {
    g += `<path class="serie-a" d="M${pts[0][0]},${T + ih}L${pts.map((p) => p.join(',')).join('L')}L${pts.at(-1)![0]},${T + ih}Z"/>`;
    g += `<polyline class="serie-l" points="${pts.map((p) => p.join(',')).join(' ')}"/>`;
  }
  dias.forEach((d, i) => {
    g += `<g class="col"><rect class="alvo" x="${L + passo * i}" y="${T}" width="${passo}" height="${ih}"/>
      <circle class="ponto" cx="${pts[i][0]}" cy="${pts[i][1]}" r="${dias.length > 45 ? 0 : 3.5}"/><title>${esc(s.dica(d))}</title></g>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="svg-graf" role="img" aria-label="${esc(rotulo)}">${g}</svg>`;
}

// Mini barras do indicador principal: período anterior apagado (35%) + período atual cheio.
export function miniBarras(atual: Dia[], anterior: Dia[]): { html: string; legenda: string } {
  const comAnterior = atual.length <= 14;
  const a = comAnterior ? anterior : [], c = atual.slice(-30);
  const max = Math.max(1, ...a.map((d) => d.visitantes), ...c.map((d) => d.visitantes));
  const barra = (d: Dia, ant: boolean) =>
    `<i class="${ant ? 'ant' : ''}" style="height:${Math.max(4, (d.visitantes / max) * 100)}%" title="${ddmm(d.dia)}: ${num(d.visitantes)} visitantes"></i>`;
  return {
    html: `<div class="mini" aria-hidden="true">${a.map((d) => barra(d, true)).join('')}${c.map((d) => barra(d, false)).join('')}</div>`,
    legenda: atual.length === 1 ? 'dia anterior · dia escolhido'
      : comAnterior ? `${atual.length} dias anteriores · últimos ${atual.length} dias` : `últimos ${c.length} dias`,
  };
}

// Funil da rolagem até o clique em comprar, na rampa ordinal do guia.
export function funil(r: Resumo): string {
  const etapas: [string, number][] = [
    ['Entraram na página', r.visitantes], ['Rolaram 25%', r.s25], ['Chegaram à metade', r.s50],
    ['Chegaram à oferta (75%)', r.s75], ['Leram até o fim', r.s100], ['Clicaram em comprar', r.clicaram],
  ];
  return '<div class="funil">' + etapas.map(([rot, v], i) => {
    const ant = i ? etapas[i - 1][1] : 0, perda = i && ant ? pct(ant - v, ant) : 0;
    return `<div><div class="etapa-cab"><b>${rot}</b><span class="num"><b>${num(v)}</b> · ${fmtPct(pct(v, r.visitantes))}</span></div>
      <div class="trilho"><i style="width:${v ? Math.max(pct(v, r.visitantes), 1.5) : 0}%;background:var(--funil-${i + 1})"></i></div>
      ${i && perda > 0 ? `<div class="perda num">${fmtPct(perda)} saíram nesta etapa</div>` : ''}</div>`;
  }).join('') + '</div>';
}

export function mapaCalor(celulas: Celula[]): { html: string; pico: string } {
  const m = new Map(celulas.map((c) => [`${c.dow}-${c.hora}`, c.visitas]));
  const top = celulas.reduce<Celula | null>((a, c) => (!a || c.visitas > a.visitas ? c : a), null);
  const max = Math.max(1, top?.visitas ?? 0);
  let h = '<div class="calor"><span></span>';
  for (let hr = 0; hr < 24; hr++) h += `<span>${hr % 3 === 0 ? `${hr}h` : ''}</span>`;
  for (let d = 1; d <= 7; d++) {
    h += `<span class="d">${SEMANA[d]}</span>`;
    for (let hr = 0; hr < 24; hr++) {
      const v = m.get(`${d}-${hr}`) ?? 0;
      h += `<i style="--p:${v ? Math.round(18 + 82 * (v / max)) : 0}%" title="${SEMANA_LONGA[d]}, ${hr}h às ${hr + 1}h: ${num(v)} visitas"></i>`;
    }
  }
  h += '</div><div class="escala">menos' + [0, 25, 50, 75, 100].map((p) => `<i style="background:color-mix(in oklab,var(--grafico-serie) ${p ? 18 + p * 0.82 : 0}%,var(--superficie-2))"></i>`).join('') + 'mais</div>';
  const pico = top ? `Pico de acesso: <b>${SEMANA_LONGA[top.dow]}, das ${top.hora}h às ${top.hora + 1}h</b> (${num(top.visitas)} visitas)` : '';
  return { html: h, pico };
}
