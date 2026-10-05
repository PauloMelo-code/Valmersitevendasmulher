ALTER TABLE "pagina_vendas_eventos" ADD COLUMN "conteudo" text;--> statement-breakpoint
ALTER TABLE "pagina_vendas_eventos" ADD COLUMN "sistema" text DEFAULT 'Outro' NOT NULL;--> statement-breakpoint
CREATE INDEX "pagina_vendas_eventos_visitante_idx" ON "pagina_vendas_eventos" USING btree ("visitante","created_at");