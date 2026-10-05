import type { Grupo, Painel } from './consultas.ts';
import { DIMENSOES, NOMES_PRESET, ROTULOS, hojeSP, periodoAnterior, urlCom, type Dimensao, type Filtro } from './filtros.ts';
import { SEMANA, ddmm, esc, rotuloValor, fmtPct, funil, graficoDias, mapaCalor, num, pct } from './graficos.ts';

const tempo = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}min ${s % 60}s` : `${s}s`);
const dataBr = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;
const barra = (v: number, max: number) => `<span class="bar"><i style="width:${max ? (v / max) * 100 : 0}%"></i></span>`;

// Variação contra o período anterior: contagens em %, taxas em pontos percentuais.
function variacao(atual: number, antes: number, modo: 'pct' | 'pp', inverso = false): string {
  if (modo === 'pct' && !antes) return `<span class="d neutro">${atual ? 'novo' : '—'}</span>`;
  const v = modo === 'pct' ? pct(atual - antes, antes) : atual - antes;
  if (Math.abs(v) < 0.05) return '<span class="d neutro">= anterior</span>';
  const cls = v > 0 !== inverso ? 'bom' : 'ruim';
  const txt = modo === 'pct' ? fmtPct(Math.abs(v)) : `${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`;
  return `<span class="d ${cls}">${v > 0 ? '▲' : '▼'} ${txt}</span>`;
}

const card = (rotulo: string, valor: string, sub: string, delta: string, dica: string) =>
  `<div class="card" title="${esc(dica)}"><div class="lbl">${rotulo}</div><div class="val">${valor}</div><div class="sub">${sub}</div>${delta}</div>`;

function tabelaGrupo(f: Filtro, d: Dimensao, linhas: Grupo[]): string {
  const max = Math.max(1, ...linhas.map((l) => l.visitantes));
  const corpo = linhas.length
    ? linhas.map((l) => `<tr><td><a href="${esc(urlCom(f, { [d]: l.nome }))}" title="Filtrar por ${esc(rotuloValor(l.nome))}">${esc(rotuloValor(l.nome))}</a></td>
        <td>${num(l.visitantes)} ${barra(l.visitantes, max)}</td><td>${num(l.visitas)}</td><td>${num(l.clicaram)}</td>
        <td><b>${fmtPct(pct(l.clicaram, l.visitantes))}</b></td><td>${tempo(l.tempo_medio)}</td><td>${fmtPct(pct(l.leram75, l.visitantes))}</td></tr>`).join('')
    : '<tr><td colspan="7" class="vazio">Sem dados no período</td></tr>';
  return `<section><h2>${ROTULOS[d]}${d === 'conteudo' ? ' <small>(utm_content)</small>' : d === 'campanha' ? ' <small>(utm_campaign)</small>' : ''}</h2>
    <div class="rolar"><table><thead><tr><th></th><th>Visitantes</th><th>Visitas</th><th>Clicaram</th><th>Taxa</th><th>Tempo</th><th>Leram 75%</th></tr></thead>
    <tbody>${corpo}</tbody></table></div></section>`;
}

function barraFiltros(f: Filtro, p: Painel): string {
  const presets = Object.keys(NOMES_PRESET)
    .map((k) => `<a href="${esc(urlCom(f, { p: k }))}" class="chip${f.preset === k ? ' on' : ''}">${NOMES_PRESET[k]}</a>`).join('');
  const selects = DIMENSOES.map((d) => {
    const ops = p.opcoes[d].includes(f.dims[d] ?? '') || !f.dims[d] ? p.opcoes[d] : [f.dims[d]!, ...p.opcoes[d]];
    return `<label><span>${ROTULOS[d]}</span><select name="${d}"><option value="">Todos</option>${ops
      .map((v) => `<option value="${esc(v)}"${v === f.dims[d] ? ' selected' : ''}>${esc(rotuloValor(v))}</option>`).join('')}</select></label>`;
  }).join('');
  const ativos = DIMENSOES.filter((d) => f.dims[d])
    .map((d) => `<a class="ativo" href="${esc(urlCom(f, { [d]: null }))}" title="Remover filtro">${ROTULOS[d]}: <b>${esc(rotuloValor(f.dims[d]!))}</b> ✕</a>`).join('');
  const ant = periodoAnterior(f);
  return `<form class="filtros" method="get" action="/painel">
  <div class="linha">${presets}<span class="sep"></span>
    <label class="data"><span>De</span><input type="date" name="de" value="${f.de}" max="${hojeSP()}"></label>
    <label class="data"><span>Até</span><input type="date" name="ate" value="${f.ate}" max="${hojeSP()}"></label>
    <input type="hidden" name="p" value="${f.preset}"></div>
  <div class="linha selects">${selects}</div>
  <div class="linha acoes"><button type="submit">Aplicar filtros</button>
    <a href="/painel${esc(urlCom({ ...f, dims: {} }))}">Limpar filtros</a>
    <a href="/painel/exportar.csv${esc(urlCom(f))}" class="exportar">⬇ Exportar eventos (CSV)</a></div>
  <div class="periodo">${dataBr(f.de)}${f.de === f.ate ? '' : ` a ${dataBr(f.ate)}`} · ${f.dias} dia${f.dias > 1 ? 's' : ''}
    · comparando com ${dataBr(ant.de)}${ant.de === ant.ate ? '' : ` a ${dataBr(ant.ate)}`}${ativos ? ` <span class="ativos">${ativos}</span>` : ''}</div>
</form>`;
}

export function renderPainel(p: Painel, f: Filtro): string {
  const r = p.resumo, a = p.anterior;
  const taxa = pct(r.clicaram, r.visitantes), taxaAnt = pct(a.clicaram, a.visitantes);
  const fim = pct(r.s100, r.visitantes), fimAnt = pct(a.s100, a.visitantes);
  const rej = pct(r.rejeicao, r.visitantes), rejAnt = pct(a.rejeicao, a.visitantes);
  const maxBotao = Math.max(1, ...p.botoes.map((b) => b.cliques));
  const maxDia = Math.max(1, ...p.dias.map((d) => d.visitantes));
  const agora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date());

  const cards = [
    card('Visitantes únicos', num(r.visitantes), `${num(r.visitas)} visitas no total`, variacao(r.visitantes, a.visitantes, 'pct'), 'Pessoas diferentes que abriram a página'),
    card('Novos visitantes', fmtPct(pct(r.novos, r.visitantes)), `${num(r.novos)} vieram pela 1ª vez`, variacao(r.novos, a.novos, 'pct'), 'Nunca tinham visitado antes deste período'),
    card('Cliques em comprar', num(r.clicaram), `${num(r.cliques)} cliques no total`, variacao(r.clicaram, a.clicaram, 'pct'), 'Pessoas que clicaram em algum botão de compra (foram ao checkout)'),
    card('Taxa de clique', fmtPct(taxa), 'visitantes que foram ao checkout', variacao(taxa, taxaAnt, 'pp'), 'Clicaram em comprar ÷ visitantes'),
    card('Tempo médio', tempo(r.tempo_medio), 'por visita', variacao(r.tempo_medio, a.tempo_medio, 'pct'), 'Média do tempo na página (limite de 30 min por visita)'),
    card('Leram até o fim', fmtPct(fim), `${num(r.s100)} pessoas`, variacao(fim, fimAnt, 'pp'), 'Rolaram 100% da página'),
    card('Rejeição', fmtPct(rej), 'saíram sem rolar nem clicar', variacao(rej, rejAnt, 'pp', true), 'Abriram e saíram antes de rolar 25% da página, sem clicar'),
    card('Ao vivo', num(p.aoVivo), 'pessoas nos últimos 5 min', '<span class="d neutro">agora</span>', 'Visitantes ativos nos últimos 5 minutos (ignora filtros)'),
  ].join('');

  const linhasDia = [...p.dias].reverse().map((d) => `<tr><td><a href="${esc(urlCom(f, { p: 'custom', de: d.dia, ate: d.dia }))}">${ddmm(d.dia)}</a> <span class="dow">${SEMANA[d.dow]}</span></td>
    <td>${num(d.visitantes)} ${barra(d.visitantes, maxDia)}</td><td>${num(d.visitas)}</td><td>${num(d.clicaram)}</td><td>${num(d.cliques)}</td>
    <td><b>${fmtPct(pct(d.clicaram, d.visitantes))}</b></td><td>${tempo(d.tempo_medio)}</td><td>${fmtPct(pct(d.leram_fim, d.visitantes))}</td></tr>`).join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Painel · Liderança Inteligente</title><link rel="icon" href="/img/livro-lideranca-inteligente.jpg">
<style>
:root{--bg:#08132B;--card:#0F1E3F;--card2:#132650;--line:#1F3263;--gold:#D4A855;--gold-hi:#F0D798;--txt:#F4F1EA;--mut:#93A0BD;--bom:#6FD3A0;--ruim:#F2A38F}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1280px;margin:0 auto;padding:20px 16px 64px}a{color:var(--gold)}
header{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:16px}
h1{font-size:20px;margin:0}h1 small{color:var(--mut);font-weight:400;font-size:13px;margin-left:8px}
h2{font-size:13px;margin:0 0 12px;color:var(--gold);text-transform:uppercase;letter-spacing:1px}h2 small{color:var(--mut);text-transform:none;letter-spacing:0}
.topo{display:flex;align-items:center;gap:12px}.vivo{display:inline-flex;align-items:center;gap:6px;color:var(--bom);font-size:13px}
.vivo::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--bom);box-shadow:0 0 0 0 rgba(111,211,160,.6);animation:pulsa 2s infinite}
@keyframes pulsa{70%{box-shadow:0 0 0 8px rgba(111,211,160,0)}100%{box-shadow:0 0 0 0 rgba(111,211,160,0)}}
.sair button{background:transparent;color:var(--gold);border:1px solid var(--gold);border-radius:999px;padding:6px 14px;font:600 13px system-ui;cursor:pointer}
.sair button:hover{background:var(--gold);color:var(--bg)}
.filtros{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:18px;display:grid;gap:12px}
.linha{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}.sep{flex:1}
.chip{color:var(--mut);text-decoration:none;padding:7px 14px;border:1px solid var(--line);border-radius:999px;font-size:13px}
.chip.on{background:var(--gold);color:var(--bg);border-color:var(--gold);font-weight:600}.chip:hover{border-color:var(--gold)}
label{display:grid;gap:4px;font-size:12px;color:var(--mut)}
select,input[type=date]{height:36px;border-radius:8px;border:1px solid var(--line);background:var(--card2);color:var(--txt);padding:0 10px;font:13px system-ui;color-scheme:dark}
.selects label{flex:1 1 150px}.selects select{width:100%}
.acoes{align-items:center;gap:16px}.acoes button{height:38px;padding:0 18px;border:0;border-radius:999px;background:var(--gold);color:var(--bg);font:700 13px system-ui;cursor:pointer}
.acoes a{font-size:13px}.exportar{margin-left:auto}
.periodo{color:var(--mut);font-size:13px}.ativos{display:inline-flex;flex-wrap:wrap;gap:6px;margin-left:6px}
.ativo{background:var(--card2);border:1px solid var(--gold);border-radius:999px;padding:2px 10px;text-decoration:none;color:var(--txt);font-size:12px}
.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.lbl{color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.6px}.val{font-size:28px;font-weight:700;margin:2px 0}.sub{color:var(--mut);font-size:12px}
.d{display:inline-block;margin-top:6px;font-size:12px;font-weight:600}.bom{color:var(--bom)}.ruim{color:var(--ruim)}.neutro{color:var(--mut);font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:18px}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;min-width:0}.largo{grid-column:1/-1}
.rolar{overflow-x:auto}table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap}th{color:var(--mut);font-weight:500;font-size:12px}
td:first-child{white-space:normal;max-width:260px;word-break:break-word}td a{text-decoration:none}td a:hover{text-decoration:underline}
tfoot td{border-bottom:0;font-weight:700;color:var(--gold)}.dow{color:var(--mut);font-size:12px}
.bar{display:inline-block;vertical-align:middle;width:70px;height:6px;background:var(--line);border-radius:3px;margin-left:6px}.bar i{display:block;height:100%;background:var(--gold);border-radius:3px}
.vazio{color:var(--mut);text-align:center;padding:20px}
.grafico{width:100%;height:auto;display:block}.grade{stroke:var(--line)}.eixo{fill:var(--mut);font-size:12px}.eixo-t{fill:var(--gold-hi)}
.barra{fill:var(--gold);opacity:.85}.alvo{fill:transparent}.alvo:hover{fill:rgba(255,255,255,.05)}
.tendencia{fill:none;stroke:var(--gold-hi);stroke-width:2.5;stroke-dasharray:6 4}.ponto{fill:var(--bg);stroke:var(--gold-hi);stroke-width:2}
.legenda{display:flex;gap:18px;color:var(--mut);font-size:12px;margin-top:6px}.legenda i{display:inline-block;width:12px;height:10px;border-radius:2px;background:var(--gold);margin-right:6px}
.legenda .l i{height:0;border-top:2px dashed var(--gold-hi);background:none}
.funil{display:grid;gap:10px}.etapa{display:grid;grid-template-columns:170px 1fr 120px;gap:10px;align-items:center}
.et-rot{font-size:13px}.et-bar{height:22px;background:var(--line);border-radius:6px;overflow:hidden}.et-bar i{display:block;height:100%;background:linear-gradient(90deg,#B8892F,var(--gold),var(--gold-hi))}
.et-num{font-size:13px;color:var(--mut)}.et-num b{color:var(--txt)}.et-num small{display:block;color:var(--ruim);font-size:11px}
.calor{display:grid;grid-template-columns:36px repeat(24,1fr);gap:3px;font-size:10px;color:var(--mut)}
.calor i{aspect-ratio:1;border-radius:3px;background:rgba(212,168,85,var(--a));outline:1px solid var(--line)}.calor .hh{text-align:left}.calor .dd{align-self:center}
.nota{color:var(--mut);font-size:13px;margin-top:24px;line-height:1.7}.nota code{background:var(--card2);padding:2px 6px;border-radius:4px;color:var(--gold-hi);word-break:break-all}
@media (max-width:900px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.etapa{grid-template-columns:1fr 90px}.et-bar{grid-column:1/-1;grid-row:2}.exportar{margin-left:0}.val{font-size:24px}}
</style></head><body><main>
<header><h1>Página de vendas · Liderança Inteligente<small>atualizado às ${agora}</small></h1>
<div class="topo"><span class="vivo">${num(p.aoVivo)} agora</span><form class="sair" method="post" action="/painel/sair"><button>Sair</button></form></div></header>
${barraFiltros(f, p)}
<div class="cards">${cards}</div>
${r.visitantes ? '' : '<p class="vazio">Nenhuma visita nesse período com esses filtros.</p>'}
<div class="grid">
<section class="largo"><h2>Visitantes e taxa de clique por dia</h2>${graficoDias(p.dias)}
  <div class="legenda"><span><i></i>Visitantes</span><span class="l"><i></i>Taxa de clique (eixo da direita)</span></div></section>
<section><h2>Funil da página</h2>${funil(r)}</section>
<section><h2>Melhores horários <small>(visitas por dia da semana e hora)</small></h2>${mapaCalor(p.horas)}</section>
<section class="largo"><h2>Dia a dia <small>(clique no dia para ver só ele)</small></h2><div class="rolar"><table>
  <thead><tr><th>Dia</th><th>Visitantes</th><th>Visitas</th><th>Clicaram</th><th>Cliques</th><th>Taxa</th><th>Tempo médio</th><th>Leram até o fim</th></tr></thead>
  <tbody>${linhasDia}</tbody>
  <tfoot><tr><td>Período</td><td>${num(r.visitantes)}</td><td>${num(r.visitas)}</td><td>${num(r.clicaram)}</td><td>${num(r.cliques)}</td>
  <td>${fmtPct(taxa)}</td><td>${tempo(r.tempo_medio)}</td><td>${fmtPct(fim)}</td></tr></tfoot></table></div></section>
${DIMENSOES.map((d) => tabelaGrupo(f, d, p.grupos[d])).join('\n')}
<section><h2>Botões mais clicados</h2><table><tbody>
${p.botoes.length ? p.botoes.map((b) => `<tr><td>${esc(b.nome)}</td><td>${num(b.cliques)} ${barra(b.cliques, maxBotao)}</td></tr>`).join('') : '<tr><td colspan="2" class="vazio">Sem cliques no período</td></tr>'}
</tbody></table></section>
</div>
<p class="nota"><b>Como ler:</b> “Clicaram” = foram para o checkout. Vendas aprovadas ficam no painel da plataforma de pagamento e no Gerenciador de Eventos da Meta (evento Purchase).
Visitantes únicos do período não são a soma dos dias (a mesma pessoa pode voltar em dias diferentes). Variações comparam com o período anterior de mesmo tamanho.<br>
<b>Para saber qual anúncio vende:</b> nos anúncios da Meta, em Parâmetros de URL, use
<code>utm_source=facebook&amp;utm_medium=cpc&amp;utm_campaign={{campaign.name}}&amp;utm_content={{ad.name}}</code></p>
</main>
<script>
var fm=document.querySelector('.filtros'),p=fm.querySelector('[name=p]');
fm.querySelectorAll('input[type=date]').forEach(function(i){i.addEventListener('change',function(){p.value='custom'})});
fm.querySelectorAll('select').forEach(function(s){s.addEventListener('change',function(){fm.requestSubmit()})});
fm.addEventListener('submit',function(){fm.querySelectorAll('select,input[type=date]').forEach(function(el){if(!el.value||(el.type==='date'&&p.value!=='custom'))el.disabled=true})});
</script>
</body></html>`;
}
