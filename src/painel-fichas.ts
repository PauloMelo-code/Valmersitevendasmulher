import { esc } from './graficos.ts';
import { LIVRO, REMETENTE } from './melhorenvio.ts';
import type { Pedido } from './pedidos.ts';
import type { StatusPedido } from './schema.ts';

// /painel/pedidos/fichas: uma folha A4 por pedido pago com tudo que o envio à mão pede (nota no Bling, depois etiqueta no
// Melhor Envio) e um checklist. É HTML de impressão: o navegador salva em PDF, sem biblioteca. Nada aqui toca o banco.

export const STATUS_FICHA: StatusPedido[] = ['PAGO', 'AGUARDANDO_NOTA'];
export type PedidoFicha = Pick<Pedido, 'orderNsu' | 'status' | 'nome' | 'cpf' | 'email' | 'telefone' | 'cep' | 'rua' | 'numero' | 'complemento'
  | 'bairro' | 'cidade' | 'uf' | 'valorCentavos' | 'valorPagoCentavos' | 'metodo' | 'parcelas' | 'pagoEm' | 'notaChave' | 'notaNumero'>;

const mascara = (s: string, m: RegExp, f: string) => s.replace(m, f);
export const cpf = (s: string) => mascara(s, /^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
export const tel = (s: string) => mascara(s, /^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
export const cep = (s: string) => mascara(s, /^(\d{5})(\d{3})$/, '$1-$2');
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (d: Date | null) => (d ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(d) : '—');
const forma = (m: string | null) => (m === 'pix' ? 'Pix' : m === 'credit_card' ? 'Cartão de crédito' : m ? esc(m) : '—');
const kg = String(LIVRO.weight).replace('.', ',');
const R = REMETENTE;

const linhas = (l: [string, string][]) => `<dl>${l.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`;
const caixa = (t: string) => `<li><span class="cx"></span>${t}</li>`;

function folha(p: PedidoFicha): string {
  const end = `${esc(p.rua)}, ${esc(p.numero)}${p.complemento ? `, ${esc(p.complemento)}` : ''} · ${esc(p.bairro)} · ${esc(p.cidade)}/${esc(p.uf)}`;
  const juros = p.valorPagoCentavos != null && p.valorPagoCentavos !== p.valorCentavos
    ? ` <small>(pago ${brl(p.valorPagoCentavos)}${p.parcelas && p.parcelas > 1 ? ` em ${p.parcelas}x` : ''}: os juros ficam com a InfinitePay)</small>` : '';
  const chave = p.notaChave
    ? `<code>${esc(p.notaChave.replace(/(\d{4})(?=\d)/g, '$1 '))}</code>${p.notaNumero ? ` · nota ${esc(p.notaNumero)}` : ''}`
    : '<span class="escrever"></span>';
  return `<section class="folha">
  <header class="topo"><div><h2>${esc(p.orderNsu)}</h2><p>${esc(p.nome)} · pago em ${dia(p.pagoEm)} · ${forma(p.metodo)}</p></div><span class="selo">Envio manual</span></header>
  <div class="bloco"><h3><b>1</b> Bling · nota fiscal</h3>${linhas([
    ['Cliente', `${esc(p.nome)} · Pessoa física · Contribuinte 9 (não contribuinte)`],
    ['CPF', esc(cpf(p.cpf))], ['E-mail', esc(p.email)], ['Celular', esc(tel(p.telefone))],
    ['Endereço', `${end} · CEP ${esc(cep(p.cep))}`],
    ['Pedido na loja', esc(p.orderNsu)],
    ['Item', `Livro Liderança Inteligente · quantidade 1 · <b>${brl(p.valorCentavos)}</b>${juros}`],
    ['Pagamento', `${forma(p.metodo)} · 1 parcela de ${brl(p.valorCentavos)}`],
    ['Transporte', `Frete por conta do remetente (CIF) · R$ 0,00 · 1 volume · ${kg} kg`],
    ['Chave da NF-e', chave],
  ])}</div>
  <div class="bloco"><h3><b>2</b> Melhor Envio · etiqueta</h3>${linhas([
    ['CEP', `de ${cep(R.postal_code)} para <b>${esc(cep(p.cep))}</b>`],
    ['Pacote', `${LIVRO.width} × ${LIVRO.length} × ${LIVRO.height} cm · ${kg} kg (use a medida real se a embalagem for maior)`],
    ['Valor segurado', brl(p.valorCentavos)],
    ['Documento', 'Nota fiscal: a chave acima (não usar declaração de conteúdo)'],
    ['Serviço', 'Correios PAC ou SEDEX, o mais barato'],
    ['Destinatário', `${esc(p.nome)} · CPF ${esc(cpf(p.cpf))} · ${esc(tel(p.telefone))}`],
    ['Rastreio', '<span class="escrever"></span>'],
  ])}</div>
  <div class="bloco"><h3><b>3</b> Checklist</h3><ul class="check">
    ${caixa('NF-e autorizada no Bling e DANFE impresso')}${caixa('Etiqueta paga e impressa no Melhor Envio')}
    ${caixa('Etiqueta e DANFE presos no pacote')}${caixa('Postado nos Correios em ____/____/______')}
    ${caixa('Rastreio enviado ao comprador')}${caixa('Treinamento liberado no Líder de Impacto')}</ul>
  <p class="alerta">Não cole esta chave no painel: o sistema compraria uma segunda etiqueta para o mesmo livro.</p></div>
</section>`;
}

export function fichasHtml(ps: PedidoFicha[], agora = new Date()): string {
  const resumo = ps.length ? `<table><thead><tr><th>Pedido</th><th>Comprador</th><th>Cidade/UF</th><th>Valor da nota</th><th>NF-e</th><th>Etiqueta</th><th>Postado</th><th>Treinamento</th></tr></thead><tbody>
    ${ps.map((p) => `<tr><td>${esc(p.orderNsu)}</td><td>${esc(p.nome)}</td><td>${esc(p.cidade)}/${esc(p.uf)}</td><td>${brl(p.valorCentavos)}</td>${'<td><span class="cx"></span></td>'.repeat(4)}</tr>`).join('')}
    </tbody></table>` : '<p class="vazio">Nenhum pedido pago esperando envio.</p>';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Fichas de envio · ${dia(agora).replace(/\//g, '-')}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef0f3;color:#1d2330;font:13px/1.45 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.barra{position:sticky;top:0;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px 16px;background:#1d2330;color:#fff}
.barra a,.barra button{font:inherit;font-weight:600;border-radius:10px;padding:8px 14px;text-decoration:none;cursor:pointer}
.barra a{color:#fff;border:1px solid #ffffff40}.barra button{background:#fff;color:#1d2330;border:0}
.folha{background:#fff;width:min(210mm,100% - 32px);margin:16px auto;padding:14mm;border-radius:8px;box-shadow:0 2px 12px #0000001a}
h1{margin:0 0 4px;font-size:20px}h2{margin:0;font-size:18px;letter-spacing:.02em}h3{display:flex;gap:8px;align-items:center;margin:0 0 8px;font-size:14px}
h3 b{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#1d2330;color:#fff;font-size:12px}
.sub,.topo p{margin:0;color:#5b6475}.topo{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:10px;margin-bottom:12px;border-bottom:2px solid #1d2330}
.selo{border:1px solid #c98a00;color:#8a5d00;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;white-space:nowrap}
.bloco{border:1px solid #d6dae1;border-radius:8px;padding:10px 12px;margin-bottom:10px;break-inside:avoid}
dl{display:grid;grid-template-columns:110px 1fr;gap:4px 12px;margin:0}dt{color:#5b6475}dd{margin:0;overflow-wrap:anywhere}small{color:#5b6475}
code{font:12px ui-monospace,Consolas,monospace}.escrever{display:inline-block;width:100%;min-height:18px;border-bottom:1px solid #8a93a3}
.cx{display:inline-block;width:13px;height:13px;border:1.5px solid #1d2330;border-radius:3px;vertical-align:-2px}
.check{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}.check li{display:flex;gap:8px;align-items:center}
.alerta{margin:10px 0 0;padding:6px 10px;border-radius:6px;background:#fdf0e6;color:#8a3b00;font-size:12px}
ol{margin:8px 0 0;padding-left:18px}ol li{margin-bottom:3px}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th,td{border:1px solid #d6dae1;padding:5px 6px;text-align:left}th{background:#f3f4f7}
td:nth-child(n+5),th:nth-child(n+5){text-align:center}.vazio{color:#5b6475}
@page{size:A4;margin:12mm}
@media print{body{background:#fff}.barra{display:none}.folha{width:auto;margin:0;padding:0;box-shadow:none;border-radius:0;break-after:page}.folha:last-child{break-after:auto}}
@media (max-width:600px){.folha{padding:16px}dl{grid-template-columns:1fr}dt{margin-top:4px}.check{grid-template-columns:1fr}table{display:block;overflow-x:auto}}
</style></head><body>
<div class="barra"><a href="/painel/pedidos">Voltar para os pedidos</a><button type="button" onclick="print()">Salvar em PDF / imprimir</button></div>
<section class="folha"><h1>Fichas de envio manual</h1><p class="sub">${ps.length} pedido${ps.length === 1 ? '' : 's'} · gerado em ${dia(agora)} · uma folha por pedido</p>
  <div class="bloco" style="margin-top:12px"><h3>Ordem de cada envio</h3><ol>
    <li><b>Bling:</b> incluir o pedido de venda, gerar a NF-e, enviar à SEFAZ, copiar a chave e imprimir o DANFE.</li>
    <li><b>Melhor Envio:</b> calcular o frete, preencher remetente e destinatário, informar a chave da nota, pagar e imprimir a etiqueta.</li>
    <li><b>Correios:</b> postar com a etiqueta e o DANFE, mandar o rastreio ao comprador e liberar o treinamento.</li></ol>
  <p class="alerta">Pedido enviado à mão: não cole a chave da nota no painel (o sistema compraria outra etiqueta) e não conecte o Bling enquanto ele estiver como "Pago" (sairia uma segunda nota).</p></div>
  <div class="bloco"><h3>Remetente (igual em todas)</h3>${linhas([
    ['Empresa', `${esc(R.name)} · CNPJ ${mascara(R.company_document, /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')} · IE ${esc(R.state_register)}`],
    ['Endereço', `${esc(R.address)}, ${esc(R.number)}, ${esc(R.complement)} · ${esc(R.district)} · ${esc(R.city)}/${esc(R.state_abbr)} · CEP ${cep(R.postal_code)}`],
    ['Contato', `${tel(R.phone)} · ${esc(R.email)}`],
  ])}</div>
  ${resumo}</section>
${ps.map(folha).join('\n')}
</body></html>`;
}
