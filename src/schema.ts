import { bigserial, boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Log de eventos da página (append-only). Não tem FK porque não existe tabela-pai:
// o visitante é anônimo (id gerado no navegador).
export const paginaVendasEventos = pgTable(
  'pagina_vendas_eventos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tipo: text('tipo').notNull(), // view | scroll | click | sair
    visitante: text('visitante').notNull(),
    valor: integer('valor'), // scroll: % lido · sair: segundos na página
    detalhe: text('detalhe'), // click: texto do botão
    origem: text('origem').notNull(), // utm_source, domínio de quem indicou ou "direto"
    campanha: text('campanha'),
    midia: text('midia'),
    dispositivo: text('dispositivo').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    isDeleted: boolean('is_deleted').notNull().default(false),
    modifiedBy: text('modified_by').notNull().default('visitante'),
  },
  (t) => [index('pagina_vendas_eventos_created_at_idx').on(t.createdAt)],
);
