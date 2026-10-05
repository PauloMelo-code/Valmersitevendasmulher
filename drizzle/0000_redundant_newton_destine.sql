CREATE TABLE "pagina_vendas_eventos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"visitante" text NOT NULL,
	"valor" integer,
	"detalhe" text,
	"origem" text NOT NULL,
	"campanha" text,
	"midia" text,
	"dispositivo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" text DEFAULT 'visitante' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pagina_vendas_eventos_created_at_idx" ON "pagina_vendas_eventos" USING btree ("created_at");