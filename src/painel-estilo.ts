// Estilo do painel (guia de UI): base neutra em camadas, dourado da marca só em ação,
// texto em 3 níveis, tons de orientação nos ícones e tudo em tokens (claro/escuro via light-dark()).
export const ESTILO = `
:root{color-scheme:dark;
  --fundo:light-dark(#f5f6f8,#0b0d12);--superficie:light-dark(#ffffff,#12151c);--superficie-2:light-dark(#f2f4f7,#181c25);--superficie-3:light-dark(#e8ebf0,#222733);
  --borda:light-dark(#e3e6eb,#232835);--borda-forte:light-dark(#d0d5dd,#323a4a);
  --texto:light-dark(#14171c,#eceef2);--suave:light-dark(#535b66,#a3a9b6);--apagado:light-dark(#6b7280,#717887);
  --destaque:light-dark(#8a6416,#d4a855);--destaque-hover:light-dark(#73530f,#e3bf74);--sobre-destaque:light-dark(#ffffff,#1a1405);
  --sucesso:light-dark(#137a52,#3ddc97);--perigo:light-dark(#c62f2f,#f27a7a);--info:light-dark(#2563c9,#6aa8ff);
  --tom-azul:light-dark(#2f5fd0,#8db4ff);--tom-violeta:light-dark(#6d3fd1,#b9a3ff);--tom-ambar:light-dark(#9a5b00,#f5c451);
  --tom-verde:light-dark(#137a52,#5fe0a8);--tom-rosa:light-dark(#c0264b,#ff8fab);--tom-ceu:light-dark(#0b6fa4,#7cd0ff);--tom-neutro:var(--suave);
  --grafico-serie:light-dark(#2a78d6,#3987e5);
  --funil-1:light-dark(#123a73,#184f95);--funil-2:light-dark(#1b4f99,#256abf);--funil-3:light-dark(#2567c0,#3987e5);
  --funil-4:light-dark(#3a80dc,#6da7ec);--funil-5:light-dark(#5d9be8,#9ec5f4);--funil-6:light-dark(#8ab8f0,#cde2fb);
  --brilho:light-dark(rgb(138 100 22/.05),rgb(212 168 85/.06));
  --sombra-cartao:inset 0 1px 0 0 light-dark(transparent,rgb(255 255 255/.035)),0 1px 2px 0 light-dark(rgb(16 24 40/.06),rgb(0 0 0/.4)),0 12px 32px -16px light-dark(rgb(16 24 40/.08),rgb(0 0 0/.55));
  --sombra-elevado:inset 0 1px 0 0 light-dark(transparent,rgb(255 255 255/.05)),0 16px 40px -12px light-dark(rgb(16 24 40/.18),rgb(0 0 0/.7));
  --sombra-campo:inset 0 1px 2px light-dark(rgb(16 24 40/.05),rgb(0 0 0/.3));
  --raio:16px}
:root[data-theme=claro]{color-scheme:light}:root[data-theme=sistema]{color-scheme:light dark}
*{box-sizing:border-box}
html{-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%}
body{margin:0;color:var(--texto);font:14px/1.5 Inter,ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;
  background:radial-gradient(1200px 380px at 50% -120px,var(--brilho),transparent 70%),var(--fundo);background-attachment:fixed;min-height:100vh}
a{color:var(--destaque)}a:hover{color:var(--destaque-hover)}
a,button,summary,label,select{touch-action:manipulation}
svg{width:1em;height:1em;flex:none}
.num{font-variant-numeric:tabular-nums}
:focus-visible{outline:2px solid var(--destaque);outline-offset:2px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cont{max-width:1440px;margin:0 auto;padding:0 24px}

/* barra superior */
.barra{position:sticky;top:0;z-index:20;background:color-mix(in oklab,var(--fundo) 85%,transparent);backdrop-filter:blur(18px);border-bottom:1px solid var(--borda)}
.barra-in{height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--texto);font-weight:600;letter-spacing:-.1px}
.logo-marca{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:17px;color:var(--sobre-destaque);
  background:linear-gradient(140deg,var(--destaque-hover),var(--destaque));box-shadow:0 6px 16px -6px color-mix(in oklab,var(--destaque) 70%,transparent)}
.logo small{font-weight:500;color:var(--apagado);margin-left:2px}
.dir{display:flex;align-items:center;gap:10px}
.vivo{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-radius:999px;font-size:12.5px;color:var(--suave);background:var(--superficie-2);box-shadow:inset 0 0 0 1px var(--borda)}
.vivo i{width:7px;height:7px;border-radius:50%;background:var(--sucesso);box-shadow:0 0 0 0 color-mix(in oklab,var(--sucesso) 60%,transparent);animation:pulsa 2s infinite}
@keyframes pulsa{70%{box-shadow:0 0 0 7px transparent}}
.bt-icone{width:36px;height:36px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--borda);background:transparent;color:var(--suave);cursor:pointer;font-size:18px}
.bt-icone:hover{color:var(--texto);background:var(--superficie-2)}
.tema-sol{display:none}:root[data-theme=escuro] .tema-sol{display:block}:root[data-theme=escuro] .tema-lua{display:none}
@media (prefers-color-scheme:dark){:root[data-theme=sistema] .tema-sol{display:block}:root[data-theme=sistema] .tema-lua{display:none}}
.conta{display:flex;align-items:center;gap:10px;padding-left:10px;border-left:1px solid var(--borda)}
.avatar{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-weight:600;font-size:13px;color:var(--texto);
  background:linear-gradient(140deg,var(--superficie-3),var(--superficie-2));box-shadow:inset 0 0 0 1px var(--borda-forte)}
.conta-nome{line-height:1.2;font-size:13px}.conta-nome small{display:block;color:var(--apagado);font-size:11.5px}
.conta form{margin:0}

/* botões */
.bt{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:36px;padding:0 14px;border-radius:10px;font-family:inherit;font-size:13px;font-weight:500;line-height:1;
  text-decoration:none;cursor:pointer;border:1px solid transparent;white-space:nowrap;transition:background .15s,border-color .15s,color .15s}
.bt svg{font-size:16px}
.bt-primario{background:var(--destaque);color:var(--sobre-destaque);font-weight:600}.bt-primario:hover{background:var(--destaque-hover);color:var(--sobre-destaque)}
.bt-contorno{border-color:var(--borda-forte);color:var(--texto);background:var(--superficie)}.bt-contorno:hover{background:var(--superficie-2);color:var(--texto)}
.bt-neutro{color:var(--suave);background:transparent}.bt-neutro:hover{background:var(--superficie-2);color:var(--texto)}

/* cabeçalho da página */
.cabecalho{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px;padding:28px 0 20px}
.cab-esq{display:flex;gap:14px;min-width:0}
.cab-esq h1{margin:0;font-size:22px;font-weight:600;letter-spacing:-.3px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cab-esq p{margin:2px 0 0;color:var(--suave)}
.acoes{display:flex;gap:8px;flex-wrap:wrap}

/* chips de ícone e etiquetas */
.chip{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:9px;font-size:19px;color:var(--tom);
  background:color-mix(in oklab,var(--tom) 12%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--tom) 24%,transparent)}
.chip.lg{width:44px;height:44px;border-radius:12px;font-size:24px}.chip.sm{width:26px;height:26px;border-radius:7px;font-size:15px}
.t-azul{--tom:var(--tom-azul)}.t-violeta{--tom:var(--tom-violeta)}.t-ambar{--tom:var(--tom-ambar)}.t-verde{--tom:var(--tom-verde)}
.t-rosa{--tom:var(--tom-rosa)}.t-ceu{--tom:var(--tom-ceu)}.t-neutro{--tom:var(--tom-neutro)}
.etiqueta{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:500;color:var(--tom);
  background:color-mix(in oklab,var(--tom) 10%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--tom) 25%,transparent)}

/* filtros */
.filtros{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:20px}
.segmentos{display:inline-flex;padding:3px;border-radius:11px;background:var(--superficie-2);box-shadow:inset 0 0 0 1px var(--borda)}
.segmentos a{padding:6px 12px;border-radius:8px;font-size:13px;color:var(--suave);text-decoration:none;white-space:nowrap}
.segmentos a:hover{color:var(--texto)}
.segmentos a.on{background:var(--superficie);color:var(--texto);font-weight:600;box-shadow:var(--sombra-cartao),inset 0 0 0 1px var(--borda-forte)}
.datas{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 6px 0 12px;border-radius:11px;background:var(--superficie);box-shadow:var(--sombra-campo),inset 0 0 0 1px var(--borda-forte);color:var(--apagado)}
.datas input{border:0;background:transparent;color:var(--texto);font-family:inherit;font-size:13px;height:34px;width:122px;color-scheme:inherit}
.datas input:focus{outline:none}.datas:focus-within{box-shadow:0 0 0 3px color-mix(in oklab,var(--destaque) 25%,transparent),inset 0 0 0 1px var(--destaque)}
details.mais{position:relative}
details.mais summary{list-style:none}details.mais summary::-webkit-details-marker{display:none}
.contador{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--destaque);color:var(--sobre-destaque);font-size:11px;font-weight:700;display:inline-grid;place-items:center}
.painel-filtros{position:absolute;z-index:15;top:calc(100% + 8px);left:0;width:min(640px,calc(100vw - 32px));padding:18px;border-radius:var(--raio);
  background:var(--superficie-2);border:1px solid var(--borda);box-shadow:var(--sombra-elevado);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.painel-filtros label{display:grid;gap:6px;font-size:12.5px;font-weight:500;color:var(--suave)}
.painel-filtros label span{display:flex;align-items:center;gap:6px}
.painel-filtros select{height:38px;border-radius:10px;border:1px solid var(--borda-forte);background:var(--fundo);color:var(--texto);padding:0 10px;font-family:inherit;font-size:13px;box-shadow:var(--sombra-campo)}
.painel-filtros .rodape-f{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px;padding-top:4px;border-top:1px solid var(--borda)}
.ativos{display:flex;flex-wrap:wrap;gap:6px}
.ativo{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 6px 0 10px;border-radius:999px;font-size:12.5px;text-decoration:none;color:var(--texto);
  background:var(--superficie);box-shadow:inset 0 0 0 1px var(--borda-forte)}
.ativo b{font-weight:600}.ativo svg{color:var(--apagado);font-size:14px}.ativo:hover svg{color:var(--perigo)}
.limpar{font-size:12.5px;color:var(--suave)}

/* cartões */
.cartao{background:var(--superficie);border:1px solid var(--borda);border-radius:var(--raio);box-shadow:var(--sombra-cartao);overflow:hidden;min-width:0}
.cartao-cab{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--borda)}
.cartao-cab .tit{display:flex;align-items:center;gap:12px;min-width:0}
.cartao-cab h2{margin:0;font-size:15px;font-weight:600;line-height:1.3}.cartao-cab p{margin:0;font-size:12px;color:var(--suave)}
.corpo{padding:20px}
.pilha{display:grid;gap:24px;padding-bottom:48px}
.g-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.g-2{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:24px}
.col-dir{display:grid;gap:24px;align-content:start;min-width:0}

/* indicadores */
.kpi{padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.kpi-cab{display:flex;align-items:center;gap:10px;color:var(--suave);font-size:13px;font-weight:500}
.kpi-num{font-size:30px;font-weight:600;letter-spacing:-.6px;line-height:1}
.kpi-pe{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--apagado)}
.tend{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:600}
.tend svg{font-size:14px}
.tend.bom{color:var(--sucesso);background:color-mix(in oklab,var(--sucesso) 12%,transparent)}
.tend.ruim{color:var(--perigo);background:color-mix(in oklab,var(--perigo) 12%,transparent)}
.tend.neutro{color:var(--apagado);background:var(--superficie-2);font-weight:500}
.mini{display:flex;align-items:flex-end;gap:2px;height:38px}
.mini i{flex:1;min-width:2px;border-radius:3px 3px 0 0;background:var(--grafico-serie)}.mini i.ant{opacity:.35}
.mini-leg{font-size:11.5px;color:var(--apagado)}
.faixa{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.faixa>div{padding:16px 20px;display:flex;gap:12px;align-items:center}
.faixa>div+div{border-left:1px solid var(--borda)}
.faixa b{display:block;font-size:20px;font-weight:600;letter-spacing:-.3px;line-height:1.2}
.faixa span{font-size:12.5px;color:var(--suave)}.faixa small{display:block;font-size:11.5px;color:var(--apagado)}

/* abas e segmentos de gráfico (CSS puro com rádios) */
.abas-nav{display:flex;gap:4px;overflow-x:auto;padding:10px 12px;border-bottom:1px solid var(--borda);scrollbar-width:none}
.abas-nav label{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:9px;font-size:13px;color:var(--suave);cursor:pointer;white-space:nowrap}
.abas-nav label:hover{background:var(--superficie-2);color:var(--texto)}
.abas-nav label svg{font-size:16px}
.abas-nav .qt{font-size:11.5px;color:var(--apagado);background:var(--superficie-2);border-radius:999px;padding:0 7px}
.aba{display:none}
.seg-graf{display:inline-flex;padding:3px;border-radius:10px;background:var(--superficie-2);box-shadow:inset 0 0 0 1px var(--borda)}
.seg-graf label{padding:5px 10px;border-radius:7px;font-size:12.5px;color:var(--suave);cursor:pointer}
.graf{display:none}

/* gráficos */
.svg-graf{width:100%;height:auto;display:block}
.grade{stroke:var(--borda)}.eixo{fill:var(--apagado);font-size:11px;font-variant-numeric:tabular-nums}
.serie{fill:var(--grafico-serie)}.serie-l{fill:none;stroke:var(--grafico-serie);stroke-width:2.25;stroke-linejoin:round}
.serie-a{fill:color-mix(in oklab,var(--grafico-serie) 14%,transparent)}.ponto{fill:var(--superficie);stroke:var(--grafico-serie);stroke-width:2}
.col:hover .serie{fill:color-mix(in oklab,var(--grafico-serie) 80%,var(--texto))}.col .alvo{fill:transparent}.col:hover .alvo{fill:color-mix(in oklab,var(--texto) 4%,transparent)}
.legenda{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:var(--suave)}
.legenda i{display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--grafico-serie);margin-right:6px;vertical-align:-1px}
.funil{display:grid;gap:14px}
.etapa-cab{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-bottom:6px}
.etapa-cab b{font-weight:600}.etapa-cab span{color:var(--suave)}
.trilho{height:10px;border-radius:999px;background:var(--superficie-3);overflow:hidden}.trilho i{display:block;height:100%;border-radius:999px}
.perda{font-size:11.5px;color:var(--apagado);margin-top:4px}
.calor{display:grid;grid-template-columns:30px repeat(24,minmax(0,1fr));gap:3px;font-size:10.5px;color:var(--apagado)}
.calor i{aspect-ratio:1;border-radius:3px;background:color-mix(in oklab,var(--grafico-serie) var(--p),var(--superficie-2))}
.calor .d{align-self:center}
.escala{display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--apagado);margin-top:14px}
.escala i{width:14px;height:10px;border-radius:2px}
.pico{margin-top:16px;padding:12px 14px;border-radius:12px;background:var(--superficie-2);font-size:13px;color:var(--suave);display:flex;gap:10px;align-items:center}
.pico b{color:var(--texto)}

/* tabelas */
.rolar{overflow:auto}.rolar.alto{max-height:440px}
.tabela{width:100%;border-collapse:collapse;font-size:13.5px}
.tabela thead th{position:sticky;top:0;z-index:1;background:var(--superficie-2);color:var(--suave);font-size:12px;font-weight:500;text-align:left;padding:9px 14px;border-bottom:1px solid var(--borda);white-space:nowrap}
.tabela tbody td{padding:11px 14px;border-bottom:1px solid var(--borda);white-space:nowrap;font-variant-numeric:tabular-nums}
.tabela tbody tr:last-child td{border-bottom:0}
.tabela tbody tr:hover td{background:color-mix(in oklab,var(--texto) 2.5%,transparent)}
.tabela td:first-child,.tabela th:first-child{padding-left:20px}.tabela td:last-child,.tabela th:last-child{padding-right:20px}
.tabela .dir-n{text-align:right}
.tabela tfoot td{padding:11px 14px;background:var(--superficie-2);font-weight:600;border-top:1px solid var(--borda);font-variant-numeric:tabular-nums}
.tabela tfoot td:first-child{padding-left:20px}
.nome a{color:var(--texto);text-decoration:none;font-weight:500}.nome a:hover{color:var(--destaque)}
.nome small{display:block;color:var(--apagado);font-size:11.5px;font-weight:400}
.zero td{color:var(--apagado)}
.barrinha{display:inline-block;vertical-align:middle;width:64px;height:6px;border-radius:999px;background:var(--superficie-3);margin-left:10px;overflow:hidden}
.barrinha i{display:block;height:100%;background:var(--grafico-serie);border-radius:999px}

/* listas, vazio, ajuda */
.lista{list-style:none;margin:0;padding:6px 0}
.lista li{display:flex;align-items:center;gap:12px;padding:10px 20px}
.lista li+li{border-top:1px solid var(--borda)}
.lista .txt{flex:1;min-width:0;font-size:13px}.lista .txt small{display:block;color:var(--apagado);font-size:11.5px}
.lista b{font-variant-numeric:tabular-nums}
.vazio{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:48px 24px;border:1px dashed var(--borda-forte);border-radius:var(--raio);background:color-mix(in oklab,var(--superficie) 50%,transparent)}
.vazio p{margin:0}.vazio .t{font-weight:600}.vazio .s{color:var(--suave);max-width:420px;font-size:13px}
.vazio-mini{padding:28px 20px;text-align:center;color:var(--apagado);font-size:13px}
.ajuda{display:flex;gap:14px;padding:18px 20px;align-items:flex-start}.ajuda>div{flex:1;min-width:0}
.ajuda p{margin:0 0 6px;color:var(--suave);font-size:13px;line-height:1.6}.ajuda p b{color:var(--texto);font-weight:600}
.codigo{display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 6px 6px 12px;border-radius:10px;background:var(--fundo);border:1px solid var(--borda)}
.codigo code{flex:1;min-width:0;overflow-x:auto;white-space:nowrap;font:12px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--texto)}
.rodape{padding:8px 0 40px;color:var(--apagado);font-size:12px;text-align:center}

@media (max-width:1100px){.g-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.g-2{grid-template-columns:minmax(0,1fr)}
  .faixa{grid-template-columns:repeat(2,minmax(0,1fr))}.faixa>div:nth-child(3){border-left:0}.faixa>div:nth-child(n+3){border-top:1px solid var(--borda)}}
@media (max-width:767px){
  .cont{padding:0 16px}body{background-attachment:scroll}
  .conta-nome,.vivo span,.logo small{display:none}.vivo{padding:0 10px}
  .cabecalho{padding:20px 0 16px}.cab-esq .chip{display:none}.cab-esq p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .acoes{width:100%}.acoes .bt{flex:1}
  .segmentos{width:100%;overflow-x:auto}.segmentos a{flex:1;text-align:center}
  .datas{flex:1}.datas input{width:100%;min-width:0}
  .painel-filtros{position:fixed;left:16px;right:16px;top:auto;bottom:16px;width:auto;grid-template-columns:minmax(0,1fr)}
  .painel-filtros select{min-height:44px;font-size:16px}
  .g-kpi{gap:12px}.kpi{padding:16px}.kpi-num{font-size:26px}
  .faixa>div{padding:14px 16px}
  .pilha{gap:16px}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
