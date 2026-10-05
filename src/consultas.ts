import { sql, type SQL } from 'drizzle-orm';
import { db } from './db.ts';
import { DIMENSOES, periodoAnterior, type Dimensao, type Filtro } from './filtros.ts';

// Agregações do painel. Dias contados no fuso de Brasília.
const TZ = 'America/Sao_Paulo';
// Nomes de coluna vêm só da lista fixa DIMENSOES, nunca do usuário.
const COL = Object.fromEntries(DIMENSOES.map((d) => [d, sql.raw(`coalesce(nullif(${d}, ''), '(sem)')`)])) as Record<Dimensao, SQL>;
const inicio = (d: string) => sql`((${d}::date)::timestamp at time zone ${TZ})`;
const fimExclusivo = (d: string) => sql`((${d}::date + 1)::timestamp at time zone ${TZ})`;

function onde(f: Filtro, comDimensoes = true): SQL {
  const c: SQL[] = [sql`is_deleted = false`, sql`created_at >= ${inicio(f.de)}`, sql`created_at < ${fimExclusivo(f.ate)}`];
  if (comDimensoes) for (const d of DIMENSOES) if (f.dims[d]) c.push(sql`${COL[d]} = ${f.dims[d]}`);
  return sql.join(c, sql` and `);
}

export type Resumo = {
  visitas: number; visitantes: number; novos: number; cliques: number; clicaram: number; tempo_medio: number;
  s25: number; s50: number; s75: number; s100: number; rejeicao: number;
};
export type Dia = { dia: string; dow: number; visitas: number; visitantes: number; cliques: number; clicaram: number; tempo_medio: number; leram_fim: number };
export type Grupo = { nome: string; visitas: number; visitantes: number; clicaram: number; tempo_medio: number; leram75: number };
export type Celula = { dow: number; hora: number; visitas: number };
export type Painel = {
  resumo: Resumo; anterior: Resumo; dias: Dia[]; diasAnteriores: Dia[]; horas: Celula[]; botoes: { nome: string; cliques: number }[];
  grupos: Record<Dimensao, Grupo[]>; opcoes: Record<Dimensao, string[]>; aoVivo: number;
};

async function resumo(f: Filtro): Promise<Resumo> {
  const r = await db.execute(sql`
    with ev as (select visitante, tipo, valor from pagina_vendas_eventos where ${onde(f)}),
    pv as (
      select visitante, bool_or(tipo = 'view') as viu, bool_or(tipo = 'click') as cl,
        coalesce(max(valor) filter (where tipo = 'scroll'), 0) as sc
      from ev group by visitante)
    select
      (select count(*) from ev where tipo = 'view')::int as visitas,
      (select count(*) from pv where viu)::int as visitantes,
      (select count(*) from pv where viu and not exists (
        select 1 from pagina_vendas_eventos o
        where o.visitante = pv.visitante and o.is_deleted = false and o.created_at < ${inicio(f.de)}))::int as novos,
      (select count(*) from ev where tipo = 'click')::int as cliques,
      (select count(*) from pv where cl)::int as clicaram,
      (select coalesce(round(avg(least(valor, 1800))), 0) from ev where tipo = 'sair')::int as tempo_medio,
      (select count(*) from pv where sc >= 25)::int as s25,
      (select count(*) from pv where sc >= 50)::int as s50,
      (select count(*) from pv where sc >= 75)::int as s75,
      (select count(*) from pv where sc >= 100)::int as s100,
      (select count(*) from pv where viu and sc < 25 and not cl)::int as rejeicao`);
  return r.rows[0] as Resumo;
}

const metricas = sql`
  count(*) filter (where tipo = 'view')::int as visitas,
  count(distinct visitante) filter (where tipo = 'view')::int as visitantes,
  count(distinct visitante) filter (where tipo = 'click')::int as clicaram,
  coalesce(round(avg(least(valor, 1800)) filter (where tipo = 'sair')), 0)::int as tempo_medio`;

async function porDia(f: Filtro): Promise<Dia[]> {
  const r = await db.execute(sql`
    with dias as (select generate_series(${f.de}::date, ${f.ate}::date, interval '1 day')::date as dia),
    ev as (select (created_at at time zone ${TZ})::date as dia, visitante, tipo, valor from pagina_vendas_eventos where ${onde(f)})
    select to_char(d.dia, 'YYYY-MM-DD') as dia, extract(isodow from d.dia)::int as dow, ${metricas},
      count(*) filter (where tipo = 'click')::int as cliques,
      count(distinct visitante) filter (where tipo = 'scroll' and valor >= 100)::int as leram_fim
    from dias d left join ev on ev.dia = d.dia group by d.dia order by d.dia`);
  return r.rows as Dia[];
}

async function porHora(f: Filtro): Promise<Celula[]> {
  const r = await db.execute(sql`
    select extract(isodow from created_at at time zone ${TZ})::int as dow,
      extract(hour from created_at at time zone ${TZ})::int as hora, count(*)::int as visitas
    from pagina_vendas_eventos where ${onde(f)} and tipo = 'view' group by 1, 2`);
  return r.rows as Celula[];
}

async function agrupar(f: Filtro, d: Dimensao): Promise<Grupo[]> {
  const r = await db.execute(sql`
    select ${COL[d]} as nome, ${metricas},
      count(distinct visitante) filter (where tipo = 'scroll' and valor >= 75)::int as leram75
    from pagina_vendas_eventos where ${onde(f)}
    group by 1 order by visitantes desc, clicaram desc limit 25`);
  return r.rows as Grupo[];
}

async function botoes(f: Filtro) {
  const r = await db.execute(sql`
    select coalesce(detalhe, '(sem texto)') as nome, count(*)::int as cliques
    from pagina_vendas_eventos where ${onde(f)} and tipo = 'click' group by 1 order by 2 desc limit 15`);
  return r.rows as { nome: string; cliques: number }[];
}

// Valores possíveis de cada filtro no período (sem aplicar os outros filtros, para não sumir opção).
async function opcoes(f: Filtro): Promise<Record<Dimensao, string[]>> {
  const partes = DIMENSOES.map((d) => sql`
    (select ${d} as d, ${COL[d]} as v, count(*) as n from pagina_vendas_eventos
     where ${onde(f, false)} and tipo = 'view' group by 2 order by 3 desc limit 50)`);
  const r = await db.execute(sql`${sql.join(partes, sql` union all `)}`);
  const saida = Object.fromEntries(DIMENSOES.map((d) => [d, [] as string[]])) as Record<Dimensao, string[]>;
  for (const l of r.rows as { d: Dimensao; v: string }[]) saida[l.d].push(l.v);
  return saida;
}

async function aoVivo(): Promise<number> {
  const r = await db.execute(sql`
    select count(distinct visitante)::int as n from pagina_vendas_eventos
    where is_deleted = false and created_at > now() - interval '5 minutes'`);
  return (r.rows[0] as { n: number }).n;
}

export async function carregarPainel(f: Filtro): Promise<Painel> {
  const [r, ant, dias, diasAnt, horas, bts, ops, vivo, ...gs] = await Promise.all([
    resumo(f), resumo(periodoAnterior(f)), porDia(f), porDia(periodoAnterior(f)), porHora(f), botoes(f), opcoes(f), aoVivo(),
    ...DIMENSOES.map((d) => agrupar(f, d)),
  ]);
  const grupos = Object.fromEntries(DIMENSOES.map((d, i) => [d, gs[i]])) as Record<Dimensao, Grupo[]>;
  return { resumo: r, anterior: ant, dias, diasAnteriores: diasAnt, horas, botoes: bts, opcoes: ops, aoVivo: vivo, grupos };
}

const COLUNAS_CSV = ['data_hora', 'tipo', 'valor', 'detalhe', 'origem', 'midia', 'campanha', 'conteudo', 'dispositivo', 'sistema', 'visitante'];

// CSV para Excel pt-BR (";" + BOM). Prefixa ' em células que começam com = + - @ (injeção de fórmula).
export async function exportarCsv(f: Filtro): Promise<string> {
  const r = await db.execute(sql`
    select to_char(created_at at time zone ${TZ}, 'YYYY-MM-DD HH24:MI:SS') as data_hora, tipo, valor, detalhe,
      origem, midia, campanha, conteudo, dispositivo, sistema, visitante
    from pagina_vendas_eventos where ${onde(f)} order by created_at limit 50000`);
  const cel = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const linhas = (r.rows as Record<string, unknown>[]).map((l) => COLUNAS_CSV.map((c) => cel(l[c])).join(';'));
  return '﻿' + [COLUNAS_CSV.join(';'), ...linhas].join('\r\n') + '\r\n';
}
