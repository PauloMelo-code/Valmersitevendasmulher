import path from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { paginaVendasEventos } from './schema.ts';
import type { Evento } from './evento.ts';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
export const db = drizzle(pool);

export const migrar = () => migrate(db, { migrationsFolder: path.join(import.meta.dirname, '..', 'drizzle') });

export async function salvarEvento(e: Evento): Promise<void> {
  await db.insert(paginaVendasEventos).values(e);
}
