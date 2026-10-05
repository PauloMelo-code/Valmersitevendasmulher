import type { Celula, Dia, Resumo } from './consultas.ts';

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const num = (n: number) => n.toLocaleString('pt-BR');
export const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
export const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
export const SEMANA = ['', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
export const rotuloValor = (v: string) => (v === '(sem)' ? '(não informado)' : v);
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Topo do eixo em número redondo (4 divisões de 1, 2, 2,5 ou 5 × 10^n).
function escalaRedonda(max: number): number {
  const bruto = max / 4, mag = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto)!;
  return Math.max(4, Math.ceil(passo) * 4);
}

// Barras = visitantes por dia; linha = taxa de clique (eixo da direita).
export function graficoDias(dias: Dia[]): string {
  if (!dias.length) return '';
  const W = 1000, H = 300, L = 44, R = 44, T = 16, B = 34;
  const iw = W - L - R, ih = H - T - B, n = dias.length, passo = iw / n;
  const maxV = escalaRedonda(Math.max(4, ...dias.map((d) => d.visitantes)));
  const taxas = dias.map((d) => pct(d.clicaram, d.visitantes));
  const maxT = Math.max(5, Math.ceil(Math.max(...taxas) / 5) * 5);
  const y = (v: number) => T + ih - (v / maxV) * ih, yt = (t: number) => T + ih - (t / maxT) * ih;
  const larg = Math.max(2, Math.min(42, passo * 0.62));
  const cadaRotulo = Math.ceil(n / 12);

  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = (maxV / 4) * i, yy = y(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="grade"/>
      <text x="${L - 8}" y="${yy + 4}" text-anchor="end" class="eixo">${num(Math.round(v))}</text>
      <text x="${W - R + 8}" y="${yt((maxT / 4) * i) + 4}" class="eixo eixo-t">${fmtPct((maxT / 4) * i)}</text>`;
  }
  const pontos: string[] = [];
  dias.forEach((d, i) => {
    const cx = L + passo * i + passo / 2, yy = y(d.visitantes);
    pontos.push(`${cx},${yt(taxas[i])}`);
    g += `<rect x="${cx - larg / 2}" y="${yy}" width="${larg}" height="${T + ih - yy}" rx="3" class="barra"/>`;
    if (i % cadaRotulo === 0) g += `<text x="${cx}" y="${H - 12}" text-anchor="middle" class="eixo">${ddmm(d.dia)}</text>`;
    g += `<rect x="${L + passo * i}" y="${T}" width="${passo}" height="${ih}" class="alvo"><title>${ddmm(d.dia)} (${SEMANA[d.dow]})
${num(d.visitantes)} visitantes · ${num(d.visitas)} visitas
${num(d.clicaram)} clicaram em comprar · taxa ${fmtPct(taxas[i])}</title></rect>`;
  });
  const linha = n > 1 ? `<polyline points="${pontos.join(' ')}" class="tendencia"/>` : '';
  const bolas = pontos.map((p) => { const [cx, cy] = p.split(','); return `<circle cx="${cx}" cy="${cy}" r="3.5" class="ponto"/>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="grafico" role="img" aria-label="Visitantes e taxa de clique por dia">${g}${linha}${bolas}</svg>`;
}

// Mapa de calor: dia da semana x hora (visitas). Mostra o melhor horário para anunciar.
export function mapaCalor(celulas: Celula[]): string {
  const m = new Map(celulas.map((c) => [`${c.dow}-${c.hora}`, c.visitas]));
  const max = Math.max(1, ...celulas.map((c) => c.visitas));
  let h = '<div class="calor"><span></span>';
  for (let hr = 0; hr < 24; hr++) h += `<span class="hh">${hr % 3 === 0 ? `${hr}h` : ''}</span>`;
  for (let d = 1; d <= 7; d++) {
    h += `<span class="dd">${SEMANA[d]}</span>`;
    for (let hr = 0; hr < 24; hr++) {
      const v = m.get(`${d}-${hr}`) ?? 0;
      const a = v ? 0.12 + 0.88 * (v / max) : 0;
      h += `<i style="--a:${a.toFixed(2)}" title="${SEMANA[d]} ${hr}h: ${num(v)} visitas"></i>`;
    }
  }
  return h + '</div>';
}

// Funil: visitantes -> rolagem -> clique em comprar, com a perda entre etapas.
export function funil(r: Resumo): string {
  const etapas: [string, number][] = [
    ['Entraram na página', r.visitantes], ['Rolaram 25%', r.s25], ['Metade da página', r.s50],
    ['Chegaram na oferta (75%)', r.s75], ['Leram até o fim', r.s100], ['Clicaram em comprar', r.clicaram],
  ];
  return '<div class="funil">' + etapas.map(([rot, v], i) => {
    const perda = i ? pct(etapas[i - 1][1] - v, etapas[i - 1][1]) : 0;
    return `<div class="etapa"><div class="et-rot">${rot}</div>
      <div class="et-bar"><i style="width:${Math.max(pct(v, r.visitantes), v ? 1.5 : 0)}%"></i></div>
      <div class="et-num"><b>${num(v)}</b> ${fmtPct(pct(v, r.visitantes))}${i && perda > 0 ? `<small>−${fmtPct(perda)}</small>` : ''}</div></div>`;
  }).join('') + '</div>';
}
