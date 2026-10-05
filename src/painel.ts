import type { Estatisticas, Grupo } from './db.ts';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const num = (n: number) => n.toLocaleString('pt-BR');
const tempo = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}min ${s % 60}s` : `${s}s`);
const barra = (v: number, max: number) => `<span class="bar"><i style="width:${max ? (v / max) * 100 : 0}%"></i></span>`;

function card(rotulo: string, valor: string, dica: string) {
  return `<div class="card"><div class="lbl">${rotulo}</div><div class="val">${valor}</div><div class="hint">${dica}</div></div>`;
}

function tabelaGrupo(titulo: string, linhas: Grupo[]) {
  const max = Math.max(1, ...linhas.map((l) => l.visitantes));
  const corpo = linhas.length
    ? linhas.map((l) => `<tr><td>${esc(l.nome)}</td><td>${num(l.visitantes)} ${barra(l.visitantes, max)}</td>
        <td>${num(l.clicaram)}</td><td><b>${pct(l.clicaram, l.visitantes)}%</b></td></tr>`).join('')
    : '<tr><td colspan="4" class="vazio">Sem dados no período</td></tr>';
  return `<section><h2>${titulo}</h2><table><thead><tr><th></th><th>Visitantes</th><th>Clicaram em comprar</th><th>Taxa</th></tr></thead>
    <tbody>${corpo}</tbody></table></section>`;
}

export function renderPainel(e: Estatisticas, dias: number): string {
  const r = e.resumo;
  const maxDia = Math.max(1, ...e.dias.map((d) => d.visitantes));
  const maxBotao = Math.max(1, ...e.botoes.map((b) => b.cliques));
  const periodos = [1, 7, 30, 90].map((d) => `<a href="?dias=${d}" class="${d === dias ? 'on' : ''}">${d === 1 ? 'Hoje' : `${d} dias`}</a>`).join('');
  const funil = ([['Começaram a rolar (25%)', r.s25], ['Metade da página (50%)', r.s50], ['Chegaram na oferta (75%)', r.s75], ['Leram até o fim (100%)', r.s100]] as const)
    .map(([rot, v]) => `<tr><td>${rot}</td><td>${num(v)} ${barra(v, r.visitantes)}</td><td><b>${pct(v, r.visitantes)}%</b></td></tr>`).join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Painel · Página de vendas</title>
<style>
:root{--bg:#08132B;--card:#0F1E3F;--line:#1A2B52;--gold:#D4A855;--txt:#F4F1EA;--mut:#93A0BD}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}
header{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:24px}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:0 0 12px;color:var(--gold);text-transform:uppercase;letter-spacing:1px}
nav a{color:var(--mut);text-decoration:none;padding:6px 12px;border:1px solid var(--line);border-radius:999px;margin-left:6px;font-size:13px}
nav a.on{background:var(--gold);color:var(--bg);border-color:var(--gold);font-weight:600}
nav{display:flex;flex-wrap:wrap;align-items:center;gap:6px 0}nav form{margin:0 0 0 14px}
nav button{background:transparent;color:var(--gold);border:1px solid var(--gold);border-radius:999px;padding:6px 14px;font:600 13px system-ui,sans-serif;cursor:pointer}
nav button:hover{background:var(--gold);color:var(--bg)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:28px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}
.lbl{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.5px}.val{font-size:28px;font-weight:700;margin:4px 0}.hint{color:var(--mut);font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));gap:20px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;overflow-x:auto}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:7px 6px;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--mut);font-weight:500;font-size:12px}td:first-child{white-space:normal;max-width:260px}
.bar{display:inline-block;vertical-align:middle;width:90px;height:6px;background:var(--line);border-radius:3px;margin-left:6px}
.bar i{display:block;height:100%;background:var(--gold);border-radius:3px}
.vazio{color:var(--mut);text-align:center}.nota{color:var(--mut);font-size:13px;margin-top:24px}
</style></head><body><main>
<header><h1>Página de vendas · Liderança Inteligente</h1><nav>${periodos}
<form method="post" action="/painel/sair"><button>Sair</button></form></nav></header>
<div class="cards">
${card('Visitas', num(r.visitas), 'carregamentos da página')}
${card('Visitantes únicos', num(r.visitantes), 'pessoas diferentes')}
${card('Cliques em comprar', num(r.cliques), `${num(r.clicaram)} pessoas clicaram`)}
${card('Taxa de clique', `${pct(r.clicaram, r.visitantes)}%`, 'visitantes que foram ao checkout')}
${card('Tempo médio', tempo(r.tempo_medio), 'por visita')}
${card('Leram até o fim', `${pct(r.s100, r.visitantes)}%`, 'dos visitantes')}
</div>
<div class="grid">
<section><h2>Por dia</h2><table><thead><tr><th>Dia</th><th>Visitantes</th><th>Visitas</th><th>Cliques</th></tr></thead><tbody>
${e.dias.length ? e.dias.map((d) => `<tr><td>${esc(d.dia)}</td><td>${num(d.visitantes)} ${barra(d.visitantes, maxDia)}</td><td>${num(d.visitas)}</td><td>${num(d.cliques)}</td></tr>`).join('') : '<tr><td colspan="4" class="vazio">Sem dados no período</td></tr>'}
</tbody></table></section>
<section><h2>Até onde leram</h2><table><tbody>${funil}</tbody></table></section>
${tabelaGrupo('Origem do tráfego', e.origens)}
${tabelaGrupo('Campanha (utm_campaign)', e.campanhas)}
${tabelaGrupo('Dispositivo', e.dispositivos)}
<section><h2>Botões mais clicados</h2><table><tbody>
${e.botoes.length ? e.botoes.map((b) => `<tr><td>${esc(b.nome)}</td><td>${num(b.cliques)} ${barra(b.cliques, maxBotao)}</td></tr>`).join('') : '<tr><td colspan="2" class="vazio">Sem cliques no período</td></tr>'}
</tbody></table></section>
</div>
<p class="nota">“Clicaram em comprar” = foram para o checkout. Vendas aprovadas aparecem no painel da plataforma de pagamento e no Gerenciador de Eventos da Meta (evento Purchase).</p>
</main></body></html>`;
}
