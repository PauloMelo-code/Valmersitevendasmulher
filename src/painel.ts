import type { Grupo, Painel } from './consultas.ts';
import { DIMENSOES, NOMES_PRESET, ROTULOS, hojeSP, periodoAnterior, urlCom, type Dimensao, type Filtro } from './filtros.ts';
import { SEMANA, ddmm, esc, fmtPct, funil, graficoBarras, graficoLinha, mapaCalor, miniBarras, num, pct, rotuloValor, tempo } from './graficos.ts';
import { icone, type NomeIcone } from './icones.ts';
import { ESTILO } from './painel-estilo.ts';
import type { Tema } from './tema.ts';

type Tom = 'azul' | 'violeta' | 'ambar' | 'verde' | 'rosa' | 'ceu' | 'neutro';
const chip = (i: NomeIcone, tom: Tom, tam = '') => `<span class="chip ${tam} t-${tom}">${icone(i, 'duotone')}</span>`;
const dataBr = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;
const intervalo = (de: string, ate: string) => (de === ate ? dataBr(de) : `${ddmm(de)} a ${dataBr(ate)}`);
const barrinha = (v: number, max: number) => `<span class="barrinha"><i style="width:${max ? (v / max) * 100 : 0}%"></i></span>`;

const ICONE_DIM: Record<Dimensao, NomeIcone> = {
  origem: 'origem', midia: 'midia', campanha: 'campanha', conteudo: 'anuncio', dispositivo: 'celular', sistema: 'sistema',
};

// Tendência contra o período anterior, sempre com ícone e texto (nunca só cor).
function tendencia(atual: number, antes: number, modo: 'pct' | 'pp', inverso = false): string {
  if (modo === 'pct' && !antes) return `<span class="tend neutro">${icone('igual')}sem base anterior</span>`;
  const v = modo === 'pct' ? pct(atual - antes, antes) : atual - antes;
  if (Math.abs(v) < 0.05) return `<span class="tend neutro">${icone('igual')}igual ao anterior</span>`;
  const txt = modo === 'pct' ? fmtPct(Math.abs(v)) : `${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`;
  return `<span class="tend ${v > 0 !== inverso ? 'bom' : 'ruim'}" title="Comparado com o período anterior de mesmo tamanho">${icone(v > 0 ? 'subiu' : 'desceu')}${v > 0 ? '+' : '−'}${txt}</span>`;
}

function cartao(o: { icone: NomeIcone; tom: Tom; titulo: string; descricao?: string; acoes?: string; corpo: string; semPadding?: boolean; classe?: string }) {
  return `<section class="cartao ${o.classe ?? ''}"><header class="cartao-cab"><div class="tit">${chip(o.icone, o.tom)}<div><h2>${o.titulo}</h2>${o.descricao ? `<p>${o.descricao}</p>` : ''}</div></div>${o.acoes ?? ''}</header>
    ${o.semPadding ? o.corpo : `<div class="corpo">${o.corpo}</div>`}</section>`;
}

function filtros(f: Filtro, p: Painel): string {
  const presets = Object.keys(NOMES_PRESET)
    .map((k) => `<a href="${esc(urlCom(f, { p: k }))}" class="${f.preset === k ? 'on' : ''}"${f.preset === k ? ' aria-current="true"' : ''}>${NOMES_PRESET[k]}</a>`).join('');
  const qtd = DIMENSOES.filter((d) => f.dims[d]).length;
  const selects = DIMENSOES.map((d) => {
    const ops = !f.dims[d] || p.opcoes[d].includes(f.dims[d]!) ? p.opcoes[d] : [f.dims[d]!, ...p.opcoes[d]];
    return `<label><span>${icone(ICONE_DIM[d])}${ROTULOS[d]}</span><select name="${d}"><option value="">Todos</option>${ops
      .map((v) => `<option value="${esc(v)}"${v === f.dims[d] ? ' selected' : ''}>${esc(rotuloValor(v))}</option>`).join('')}</select></label>`;
  }).join('');
  const ativos = DIMENSOES.filter((d) => f.dims[d])
    .map((d) => `<a class="ativo" href="${esc(urlCom(f, { [d]: null }))}" aria-label="Remover filtro ${ROTULOS[d]}">${ROTULOS[d]}: <b>${esc(rotuloValor(f.dims[d]!))}</b>${icone('fechar')}</a>`).join('');
  const limpar = `/painel${esc(urlCom({ ...f, dims: {} }))}`;
  return `<form class="filtros" id="filtros" method="get" action="/painel">
  <nav class="segmentos" aria-label="Período">${presets}</nav>
  <label class="datas" title="Período personalizado">${icone('calendario')}<span class="sr">De</span><input type="date" name="de" value="${f.de}" max="${hojeSP()}">
    <span>–</span><span class="sr">Até</span><input type="date" name="ate" value="${f.ate}" max="${hojeSP()}"></label>
  <input type="hidden" name="p" value="${f.preset}">
  <details class="mais"><summary class="bt bt-contorno">${icone('filtro')}Filtros${qtd ? ` <span class="contador">${qtd}</span>` : ''}</summary>
    <div class="painel-filtros">${selects}
      <div class="rodape-f"><a class="bt bt-neutro" href="${limpar}">Limpar</a><button class="bt bt-primario" type="submit">Aplicar filtros</button></div></div></details>
  ${ativos ? `<div class="ativos">${ativos}</div><a class="limpar" href="${limpar}">Limpar filtros</a>` : ''}
</form>`;
}

function tabelaGrupo(f: Filtro, d: Dimensao, linhas: Grupo[], total: number): string {
  if (!linhas.length) return '<div class="vazio-mini">Sem dados no período.</div>';
  const max = Math.max(1, ...linhas.map((l) => l.visitantes));
  return `<div class="rolar"><table class="tabela"><thead><tr><th>${ROTULOS[d]}</th><th>Visitantes</th><th>Clicaram em comprar</th><th>Taxa de clique</th><th>Tempo médio</th><th>Leram 75%</th></tr></thead><tbody>
  ${linhas.map((l) => `<tr><td class="nome"><a href="${esc(urlCom(f, { [d]: l.nome }))}" title="Filtrar o painel por ${esc(rotuloValor(l.nome))}">${esc(rotuloValor(l.nome))}</a><small>${fmtPct(pct(l.visitantes, total))} dos visitantes</small></td>
    <td>${num(l.visitantes)}${barrinha(l.visitantes, max)}</td><td>${num(l.clicaram)}</td><td><b>${fmtPct(pct(l.clicaram, l.visitantes))}</b></td>
    <td>${tempo(l.tempo_medio)}</td><td>${fmtPct(pct(l.leram75, l.visitantes))}</td></tr>`).join('')}</tbody></table></div>`;
}

export function renderPainel(p: Painel, f: Filtro, ctx: { usuario: string; tema: Tema }): string {
  const r = p.resumo, a = p.anterior, ant = periodoAnterior(f);
  const taxa = pct(r.clicaram, r.visitantes), taxaAnt = pct(a.clicaram, a.visitantes);
  const mini = miniBarras(p.dias, p.diasAnteriores);
  const calor = mapaCalor(p.horas);
  const vazio = r.visitantes === 0;
  const agora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date());
  const dica = (d: { dia: string; dow: number }) => `${ddmm(d.dia)} (${SEMANA[d.dow]})`;

  const kpis = `<div class="g-kpi">
  <section class="cartao kpi"><div class="kpi-cab">${chip('visitantes', 'azul')}Visitantes únicos</div><div class="kpi-num num">${num(r.visitantes)}</div>
    ${mini.html}<div class="kpi-pe"><span>${mini.legenda}</span>${tendencia(r.visitantes, a.visitantes, 'pct')}</div></section>
  <section class="cartao kpi"><div class="kpi-cab">${chip('carrinho', 'ambar')}Clicaram em comprar</div><div class="kpi-num num">${num(r.clicaram)}</div>
    <div class="kpi-pe"><span>foram ao checkout · ${num(r.cliques)} cliques</span>${tendencia(r.clicaram, a.clicaram, 'pct')}</div></section>
  <section class="cartao kpi"><div class="kpi-cab">${chip('alvo', 'violeta')}Taxa de clique</div><div class="kpi-num num">${fmtPct(taxa)}</div>
    <div class="kpi-pe"><span>dos visitantes clicaram em comprar</span>${tendencia(taxa, taxaAnt, 'pp')}</div></section>
  <section class="cartao kpi"><div class="kpi-cab">${chip('relogio', 'ceu')}Tempo médio na página</div><div class="kpi-num num">${tempo(r.tempo_medio)}</div>
    <div class="kpi-pe"><span>por visita</span>${tendencia(r.tempo_medio, a.tempo_medio, 'pct')}</div></section>
</div>`;

  const item = (i: NomeIcone, tom: Tom, valor: string, rot: string, tend: string) =>
    `<div>${chip(i, tom, 'sm')}<div><b class="num">${valor}</b><span>${rot}</span><small>${tend}</small></div></div>`;
  const faixa = `<section class="cartao faixa">
  ${item('olho', 'neutro', num(r.visitas), 'visitas no total', tendencia(r.visitas, a.visitas, 'pct'))}
  ${item('novos', 'azul', fmtPct(pct(r.novos, r.visitantes)), `novos visitantes (${num(r.novos)})`, tendencia(pct(r.novos, r.visitantes), pct(a.novos, a.visitantes), 'pp'))}
  ${item('livro', 'ceu', fmtPct(pct(r.s100, r.visitantes)), `leram até o fim (${num(r.s100)})`, tendencia(pct(r.s100, r.visitantes), pct(a.s100, a.visitantes), 'pp'))}
  ${item('saiu', 'rosa', fmtPct(pct(r.rejeicao, r.visitantes)), 'saíram sem rolar nem clicar', tendencia(pct(r.rejeicao, r.visitantes), pct(a.rejeicao, a.visitantes), 'pp', true))}
</section>`;

  const series = [
    ['vis', 'Visitantes', graficoBarras(p.dias, { valor: (d) => d.visitantes, formato: (v) => num(Math.round(v)), minimo: 4, dica: (d) => `${dica(d)} · ${num(d.visitantes)} visitantes · ${num(d.visitas)} visitas` }, 'Visitantes por dia')],
    ['cli', 'Cliques em comprar', graficoBarras(p.dias, { valor: (d) => d.clicaram, formato: (v) => num(Math.round(v)), minimo: 4, dica: (d) => `${dica(d)} · ${num(d.clicaram)} pessoas clicaram em comprar` }, 'Pessoas que clicaram em comprar por dia')],
    ['tax', 'Taxa de clique', graficoLinha(p.dias, { valor: (d) => pct(d.clicaram, d.visitantes), formato: (v) => fmtPct(v), minimo: 5, dica: (d) => `${dica(d)} · taxa de clique ${fmtPct(pct(d.clicaram, d.visitantes))}` }, 'Taxa de clique por dia')],
  ] as const;
  const evolucao = cartao({
    icone: 'barras', tom: 'azul', titulo: 'Evolução diária', descricao: 'Passe o mouse sobre o gráfico para ver cada dia',
    acoes: `<div class="seg-graf" role="radiogroup" aria-label="Métrica do gráfico">${series.map(([id, rot], i) =>
      `<input type="radio" class="sr" name="graf" id="g-${id}"${i ? '' : ' checked'}><label for="g-${id}">${rot}</label>`).join('')}</div>`,
    corpo: series.map(([id, rot, svg]) => `<div class="graf graf-${id}">${svg}<div class="legenda"><span><i></i>${rot} por dia</span></div></div>`).join(''),
  });

  const linhasDia = [...p.dias].reverse();
  const maxDia = Math.max(1, ...linhasDia.map((d) => d.visitantes));
  const diaADia = cartao({
    icone: 'tabela', tom: 'neutro', titulo: 'Dia a dia', descricao: 'Clique em um dia para analisar só ele', semPadding: true,
    corpo: `<div class="rolar alto"><table class="tabela"><thead><tr><th>Dia</th><th>Visitantes</th><th>Visitas</th><th>Clicaram</th><th>Taxa</th><th>Tempo médio</th><th>Leram até o fim</th></tr></thead><tbody>
    ${linhasDia.map((d) => `<tr${d.visitantes ? '' : ' class="zero"'}><td class="nome"><a href="${esc(urlCom(f, { p: 'custom', de: d.dia, ate: d.dia }))}">${ddmm(d.dia)}</a><small>${SEMANA[d.dow]}</small></td>
      <td>${num(d.visitantes)}${barrinha(d.visitantes, maxDia)}</td><td>${num(d.visitas)}</td><td>${num(d.clicaram)}</td><td><b>${fmtPct(pct(d.clicaram, d.visitantes))}</b></td>
      <td>${tempo(d.tempo_medio)}</td><td>${fmtPct(pct(d.leram_fim, d.visitantes))}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Período</td><td>${num(r.visitantes)}</td><td>${num(r.visitas)}</td><td>${num(r.clicaram)}</td><td>${fmtPct(taxa)}</td><td>${tempo(r.tempo_medio)}</td><td>${fmtPct(pct(r.s100, r.visitantes))}</td></tr></tfoot></table></div>`,
  });

  const abas = cartao({
    icone: 'origem', tom: 'azul', titulo: 'De onde vêm os resultados', descricao: 'Clique em um item para filtrar o painel inteiro', semPadding: true, classe: 'abas',
    corpo: `<div class="abas-nav" role="radiogroup" aria-label="Agrupar por">${DIMENSOES.map((d, i) => `<input type="radio" class="sr" name="aba" id="aba-${d}"${i ? '' : ' checked'}>
      <label for="aba-${d}">${icone(ICONE_DIM[d])}${ROTULOS[d]}<span class="qt num">${p.grupos[d].length}</span></label>`).join('')}</div>
      ${DIMENSOES.map((d) => `<div class="aba aba-${d}">${tabelaGrupo(f, d, p.grupos[d], r.visitantes)}</div>`).join('')}`,
  });

  const totalCliques = p.botoes.reduce((s, b) => s + b.cliques, 0);
  const botoes = cartao({
    icone: 'clique', tom: 'ambar', titulo: 'Botões de compra', descricao: 'Quais chamadas levam mais gente ao checkout', semPadding: true,
    corpo: p.botoes.length ? `<ul class="lista">${p.botoes.map((b) => `<li>${chip('carrinho', 'ambar', 'sm')}<div class="txt">${esc(b.nome)}<small>${fmtPct(pct(b.cliques, totalCliques))} dos cliques</small></div><b>${num(b.cliques)}</b></li>`).join('')}</ul>`
      : '<div class="vazio-mini">Nenhum clique em comprar neste período.</div>',
  });

  const utm = 'utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}';
  const ajuda = `<section class="cartao ajuda">${chip('info', 'neutro')}<div>
    <p><b>Como ler:</b> “clicaram em comprar” são as pessoas que foram para o checkout. As vendas aprovadas ficam na plataforma de pagamento e no Gerenciador de Eventos da Meta. As setas comparam com o período anterior de mesmo tamanho.</p>
    <p><b>Para saber qual anúncio vende</b>, cole nos Parâmetros de URL dos anúncios da Meta:</p>
    <div class="codigo"><code>${esc(utm)}</code><button type="button" class="bt-icone" data-copiar="${esc(utm)}" aria-label="Copiar parâmetros" title="Copiar">${icone('copiar')}</button></div></div></section>`;

  const conteudo = vazio
    ? `<div class="vazio">${chip('barras', 'azul', 'lg')}<p class="t">Nenhuma visita neste período</p>
        <p class="s">Quando alguém abrir a página de vendas${DIMENSOES.some((d) => f.dims[d]) ? ' com esses filtros' : ''}, os números aparecem aqui. Tente um período maior ou limpe os filtros.</p>
        <a class="bt bt-contorno" href="/painel${esc(urlCom({ ...f, dims: {} }, { p: '30d' }))}">Ver últimos 30 dias</a></div>`
    : `<div class="g-2">${evolucao}${cartao({ icone: 'filtro', tom: 'violeta', titulo: 'Funil da página', descricao: 'Até onde as pessoas leem e quantas clicam em comprar', corpo: funil(r) })}</div>
       <div class="g-2">${diaADia}${cartao({ icone: 'horario', tom: 'ceu', titulo: 'Melhores horários', descricao: 'Visitas por dia da semana e hora (Brasília)', corpo: `${calor.html}${calor.pico ? `<div class="pico">${icone('vivo')}<span>${calor.pico}</span></div>` : ''}` })}</div>
       <div class="g-2">${abas}<div class="col-dir">${botoes}${ajuda}</div></div>`;

  return `<!doctype html><html lang="pt-BR" data-theme="${ctx.tema}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>Painel · Liderança Inteligente</title><link rel="icon" href="/img/livro-lideranca-inteligente.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${ESTILO}
${series.map(([id]) => `.cartao:has(#g-${id}:checked) .graf-${id}{display:block}.seg-graf:has(#g-${id}:checked) label[for=g-${id}]{background:var(--superficie);color:var(--texto);font-weight:600;box-shadow:var(--sombra-cartao)}`).join('')}
${DIMENSOES.map((d) => `.abas:has(#aba-${d}:checked) .aba-${d}{display:block}.abas-nav:has(#aba-${d}:checked) label[for=aba-${d}]{background:var(--superficie-2);color:var(--texto);font-weight:600;box-shadow:inset 0 -2px 0 var(--destaque)}`).join('')}
.seg-graf:has(:focus-visible),.abas-nav:has(:focus-visible){outline:2px solid var(--destaque);outline-offset:2px}
</style></head><body>
<header class="barra"><div class="cont barra-in">
  <a class="logo" href="/painel"><span class="logo-marca">${icone('painel', 'fill')}</span>Liderança Inteligente<small>Painel</small></a>
  <div class="dir">
    <span class="vivo num" title="Pessoas com a página aberta nos últimos 5 minutos"><i></i>${num(p.aoVivo)}<span> agora no site</span></span>
    <button type="button" class="bt-icone" id="tema" aria-label="Alternar tema claro/escuro" title="Alternar tema">${icone('lua', 'regular', 'tema-lua')}${icone('sol', 'regular', 'tema-sol')}</button>
    <div class="conta"><span class="avatar">${esc(ctx.usuario.slice(0, 1).toUpperCase())}</span><span class="conta-nome">${esc(ctx.usuario)}<small>Administrador</small></span>
      <form method="post" action="/painel/sair"><button class="bt-icone" aria-label="Sair" title="Sair">${icone('saiu')}</button></form></div>
  </div></div></header>
<main class="cont">
  <div class="cabecalho"><div class="cab-esq">${chip('painel', 'azul', 'lg')}<div>
    <h1>Desempenho da página de vendas <span class="etiqueta t-neutro">${f.preset === 'custom' ? `${f.dias} dia${f.dias > 1 ? 's' : ''}` : NOMES_PRESET[f.preset]}</span></h1>
    <p>${intervalo(f.de, f.ate)} · comparado com ${intervalo(ant.de, ant.ate)} · atualizado às ${agora}</p></div></div>
    <div class="acoes"><a class="bt bt-contorno" href="/painel/exportar.csv${esc(urlCom(f))}">${icone('baixar')}Exportar CSV</a>
      <a class="bt bt-neutro" href="/" target="_blank" rel="noopener">${icone('abrir')}Ver página</a></div></div>
  ${filtros(f, p)}
  <div class="pilha">${kpis}${faixa}${conteudo}${vazio ? ajuda : ''}</div>
</main>
<footer class="rodape">Liderança Inteligente · Valmer Albuquerque · horários de Brasília</footer>
<script>
(function(){
  var fm=document.getElementById('filtros'),p=fm.querySelector('[name=p]');
  fm.querySelectorAll('input[type=date]').forEach(function(i){i.addEventListener('change',function(){if(i.value){p.value='custom';fm.requestSubmit()}})});
  fm.addEventListener('submit',function(){fm.querySelectorAll('select,input[type=date]').forEach(function(el){if(!el.value||(el.type==='date'&&p.value!=='custom'))el.disabled=true})});
  document.addEventListener('click',function(e){var d=document.querySelector('details.mais[open]');if(d&&!d.contains(e.target))d.removeAttribute('open')});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){var d=document.querySelector('details.mais[open]');if(d){d.removeAttribute('open');d.querySelector('summary').focus()}}});
  document.getElementById('tema').addEventListener('click',function(){
    var h=document.documentElement,t=h.dataset.theme,escuro=t==='escuro'||(t==='sistema'&&matchMedia('(prefers-color-scheme: dark)').matches),n=escuro?'claro':'escuro';
    h.dataset.theme=n;document.cookie='tema='+n+'; path=/painel; max-age=31536000; samesite=lax'+(location.protocol==='https:'?'; secure':'');
  });
  document.querySelectorAll('[data-copiar]').forEach(function(b){b.addEventListener('click',function(){
    if(!navigator.clipboard)return;navigator.clipboard.writeText(b.dataset.copiar).then(function(){var o=b.innerHTML;b.innerHTML=${JSON.stringify(icone('ok'))};b.title='Copiado';setTimeout(function(){b.innerHTML=o;b.title='Copiar'},1600)});
  })});
})();
</script>
</body></html>`;
}
