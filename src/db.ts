import path from 'node:path';
import pg from 'pg';
import { DrizzleQueryError } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env } from './ambiente.ts';
import { paginaVendasEventos } from './schema.ts';
import type { Evento } from './evento.ts';

const URL_BANCO = env('DATABASE_URL');
if (!URL_BANCO) throw new Error('DATABASE_URL não definida');

export const pool = new pg.Pool({ connectionString: URL_BANCO, max: 8 });
// Conexão ociosa que cai (restart do Postgres, proxy) emite 'error': sem listener o Node derruba o processo.
pool.on('error', (e) => console.error('banco (conexão ociosa):', e.message));
export const db = drizzle(pool);

// Mensagem segura para log: o DrizzleQueryError traz "params: <valores>" (nome, CPF, endereço...), aqui só a causa.
export const erroSemDados = (e: unknown): string =>
  e instanceof DrizzleQueryError ? `falha no banco: ${e.cause?.message ?? 'sem detalhe'}` : e instanceof Error ? e.message : String(e);

export const migrar = () => migrate(db, { migrationsFolder: path.join(import.meta.dirname, '..', 'drizzle') });

export async function salvarEvento(e: Evento & { pagina: string }): Promise<void> {
  await db.insert(paginaVendasEventos).values(e);
}
