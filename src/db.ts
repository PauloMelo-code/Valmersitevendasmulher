import path from 'node:path';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { paginaVendasEventos } from './schema.ts';
import type { Evento } from './evento.ts';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const db = drizzle(pool);

export const migrar = () => migrate(db, { migrationsFolder: path.join(import.meta.dirname, '..', 'drizzle') });

export async function salvarEvento(e: Evento): Promise<void> {
  await db.insert(paginaVendasEventos).values(e);
}

export type Resumo = {
  visitas: number; visitantes: number; cliques: number; clicaram: number; tempo_medio: number;
  s25: number; s50: number; s75: number; s100: number;
};
export type PorDia = { dia: string; visitas: number; visitantes: number; cliques: number };
export type Grupo = { nome: string; visitas: number; visitantes: number; clicaram: number };
export type Botao = { nome: string; cliques: number };
export type Estatisticas = {
  resumo: Resumo; dias: PorDia[]; origens: Grupo[]; campanhas: Grupo[]; dispositivos: Grupo[]; botoes: Botao[];
};

const COLUNAS = { origem: sql.raw('origem'), campanha: sql.raw('campanha'), dispositivo: sql.raw('dispositivo') };

export async function estatisticas(dias: number): Promise<Estatisticas> {
  const filtro = sql`is_deleted = false and created_at >= now() - (${dias}::int * interval '1 day')`;
  const agrupar = (col: keyof typeof COLUNAS) => db.execute(sql`
    select coalesce(nullif(${COLUNAS[col]}, ''), '(sem)') as nome,
      count(*) filter (where tipo = 'view')::int as visitas,
      count(distinct visitante) filter (where tipo = 'view')::int as visitantes,
      count(distinct visitante) filter (where tipo = 'click')::int as clicaram
    from pagina_vendas_eventos where ${filtro}
    group by 1 order by visitantes desc, clicaram desc limit 15`);

  const [resumo, porDia, origens, campanhas, dispositivos, botoes] = await Promise.all([
    db.execute(sql`
      select count(*) filter (where tipo = 'view')::int as visitas,
        count(distinct visitante) filter (where tipo = 'view')::int as visitantes,
        count(*) filter (where tipo = 'click')::int as cliques,
        count(distinct visitante) filter (where tipo = 'click')::int as clicaram,
        coalesce(round(avg(least(valor, 1800)) filter (where tipo = 'sair')), 0)::int as tempo_medio,
        count(distinct visitante) filter (where tipo = 'scroll' and valor >= 25)::int as s25,
        count(distinct visitante) filter (where tipo = 'scroll' and valor >= 50)::int as s50,
        count(distinct visitante) filter (where tipo = 'scroll' and valor >= 75)::int as s75,
        count(distinct visitante) filter (where tipo = 'scroll' and valor >= 100)::int as s100
      from pagina_vendas_eventos where ${filtro}`),
    db.execute(sql`
      select to_char((created_at at time zone 'America/Sao_Paulo')::date, 'DD/MM') as dia,
        count(*) filter (where tipo = 'view')::int as visitas,
        count(distinct visitante) filter (where tipo = 'view')::int as visitantes,
        count(*) filter (where tipo = 'click')::int as cliques
      from pagina_vendas_eventos where ${filtro}
      group by (created_at at time zone 'America/Sao_Paulo')::date order by min(created_at)`),
    agrupar('origem'),
    agrupar('campanha'),
    agrupar('dispositivo'),
    db.execute(sql`
      select coalesce(detalhe, '(sem texto)') as nome, count(*)::int as cliques
      from pagina_vendas_eventos where ${filtro} and tipo = 'click'
      group by 1 order by 2 desc limit 15`),
  ]);

  return {
    resumo: resumo.rows[0] as Resumo,
    dias: porDia.rows as PorDia[],
    origens: origens.rows as Grupo[],
    campanhas: campanhas.rows as Grupo[],
    dispositivos: dispositivos.rows as Grupo[],
    botoes: botoes.rows as Botao[],
  };
}
