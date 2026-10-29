import path from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env } from './ambiente.ts';
import { paginaVendasEventos } from './schema.ts';
import type { Evento } from './evento.ts';

const URL_BANCO = env('DATABASE_URL');
if (!URL_BANCO) throw new Error('DATABASE_URL não definida');

const pool = new pg.Pool({ connectionString: URL_BANCO, max: 8 });
export const db = drizzle(pool);

export const migrar = () => migrate(db, { migrationsFolder: path.join(import.meta.dirname, '..', 'drizzle') });

export async function salvarEvento(e: Evento & { pagina: string }): Promise<void> {
  await db.insert(paginaVendasEventos).values(e);
}
