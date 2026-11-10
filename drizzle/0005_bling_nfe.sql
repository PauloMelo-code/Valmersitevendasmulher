CREATE TABLE "pagina_vendas_integracoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"access_token_cifrado" text,
	"refresh_token_cifrado" text,
	"expira_em" timestamp with time zone,
	"refresh_expira_em" timestamp with time zone,
	"situacao" text NOT NULL,
	"erro" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" text DEFAULT 'sistema' NOT NULL,
	CONSTRAINT "pagina_vendas_integracoes_nome_unique" UNIQUE("nome"),
	CONSTRAINT "pagina_vendas_integracoes_situacao_ck" CHECK ("pagina_vendas_integracoes"."situacao" in ('AUTORIZADA', 'REAUTORIZAR'))
);
--> statement-breakpoint
ALTER TABLE "pagina_vendas_pedidos" DROP CONSTRAINT "pagina_vendas_pedidos_status_ck";--> statement-breakpoint
ALTER TABLE "pagina_vendas_pedidos" ADD COLUMN "bling_contato_id" text;--> statement-breakpoint
ALTER TABLE "pagina_vendas_pedidos" ADD COLUMN "bling_pedido_id" text;--> statement-breakpoint
ALTER TABLE "pagina_vendas_pedidos" ADD COLUMN "bling_nfe_id" text;--> statement-breakpoint
ALTER TABLE "pagina_vendas_pedidos" ADD COLUMN "nota_numero" text;--> statement-breakpoint
ALTER TABLE "pagina_vendas_pedidos" ADD COLUMN "nota_danfe_url" text;--> statement-breakpoint
ALTER TABLE "pagina_vendas_pedidos" ADD COLUMN "nota_erro" text;--> statement-breakpoint
ALTER TABLE "pagina_vendas_pedidos" ADD COLUMN "nota_iniciada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pagina_vendas_pedidos" ADD CONSTRAINT "pagina_vendas_pedidos_status_ck" CHECK ("pagina_vendas_pedidos"."status" in ('AGUARDANDO_PAGAMENTO', 'PAGO', 'EMITINDO_NOTA', 'AGUARDANDO_NOTA', 'COMPRANDO_ETIQUETA', 'ETIQUETA_COMPRADA', 'POSTADO', 'ENTREGUE', 'ERRO_ENVIO', 'CANCELADO'));