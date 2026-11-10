import { sql } from 'drizzle-orm';
import { bigserial, boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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
    conteudo: text('conteudo'), // utm_content: qual anúncio/criativo trouxe a visita
    pagina: text('pagina').notNull().default('mulheres'), // página de vendas do deploy (PAGINA), gravada pelo servidor
    dispositivo: text('dispositivo').notNull(),
    sistema: text('sistema').notNull().default('Outro'), // iOS | Android | Windows | macOS | Linux | Outro
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    isDeleted: boolean('is_deleted').notNull().default(false),
    modifiedBy: text('modified_by').notNull().default('visitante'),
  },
  (t) => [
    index('pagina_vendas_eventos_created_at_idx').on(t.createdAt),
    index('pagina_vendas_eventos_visitante_idx').on(t.visitante, t.createdAt),
  ],
);

// EMITINDO_NOTA e COMPRANDO_ETIQUETA = a rotina está no meio (Bling / Melhor Envio); o painel não mexe nesses.
export const STATUS_PEDIDO = ['AGUARDANDO_PAGAMENTO', 'PAGO', 'EMITINDO_NOTA', 'AGUARDANDO_NOTA', 'COMPRANDO_ETIQUETA', 'ETIQUETA_COMPRADA', 'POSTADO', 'ENTREGUE', 'ERRO_ENVIO', 'CANCELADO'] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];
export const STATUS_ACESSO = ['PENDENTE', 'ENVIADO', 'ERRO', 'DESLIGADO'] as const;
const lista = (s: readonly string[]) => sql.raw(s.map((v) => `'${v}'`).join(', '));
const auditoria = (quemPadrao: string) => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  isDeleted: boolean('is_deleted').notNull().default(false),
  modifiedBy: text('modified_by').notNull().default(quemPadrao), // comprador | sistema | painel:<usuario>
});

// Pedidos do checkout próprio (InfinitePay + Melhor Envio). Os dois containers (mulheres e geral) gravam aqui:
// toda mudança de estado é UPDATE condicional pelo status esperado, então só um processo ganha.
export const paginaVendasPedidos = pgTable(
  'pagina_vendas_pedidos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNsu: text('order_nsu').notNull().unique(), // LI-XXXXXXXXXX: único identificador que vai em URL
    pagina: text('pagina').notNull(),
    visitante: text('visitante'), // lv_id do navegador: liga a venda à campanha
    origem: text('origem'), campanha: text('campanha'), midia: text('midia'), conteudo: text('conteudo'),
    nome: text('nome').notNull(), email: text('email').notNull(),
    telefone: text('telefone').notNull(), cpf: text('cpf').notNull(), // só dígitos
    cep: text('cep').notNull(), rua: text('rua').notNull(), numero: text('numero').notNull(), complemento: text('complemento'),
    bairro: text('bairro').notNull(), cidade: text('cidade').notNull(), uf: text('uf').notNull(),
    valorCentavos: integer('valor_centavos').notNull(),
    status: text('status').$type<StatusPedido>().notNull().default('AGUARDANDO_PAGAMENTO'),
    // InfinitePay
    checkoutUrl: text('checkout_url'), invoiceSlug: text('invoice_slug'), transactionNsu: text('transaction_nsu'),
    metodo: text('metodo'), parcelas: integer('parcelas'), valorPagoCentavos: integer('valor_pago_centavos'),
    comprovanteUrl: text('comprovante_url'), pagoEm: timestamp('pago_em', { withTimezone: true }),
    // envio (Melhor Envio)
    envioPrevistoEm: timestamp('envio_previsto_em', { withTimezone: true }), notaChave: text('nota_chave'),
    meServico: integer('me_servico'), meFreteCentavos: integer('me_frete_centavos'), meEtiquetaId: text('me_etiqueta_id'),
    meCompradaEm: timestamp('me_comprada_em', { withTimezone: true }), meImpressaoUrl: text('me_impressao_url'),
    rastreio: text('rastreio'), rastreioChecadoEm: timestamp('rastreio_checado_em', { withTimezone: true }),
    postadoEm: timestamp('postado_em', { withTimezone: true }), entregueEm: timestamp('entregue_em', { withTimezone: true }),
    envioErro: text('envio_erro'), envioTentativas: integer('envio_tentativas').notNull().default(0),
    // NF-e pelo Bling: cada id é gravado assim que o Bling devolve, para retomar sem duplicar pedido nem nota.
    blingContatoId: text('bling_contato_id'), blingPedidoId: text('bling_pedido_id'), blingNfeId: text('bling_nfe_id'),
    notaNumero: text('nota_numero'), notaDanfeUrl: text('nota_danfe_url'), notaErro: text('nota_erro'),
    notaIniciadaEm: timestamp('nota_iniciada_em', { withTimezone: true }), // entrada em EMITINDO_NOTA (limite de 2 h sem retorno)
    // aviso de acesso à plataforma Líder de Impacto
    acessoStatus: text('acesso_status').notNull().default('PENDENTE'), acessoErro: text('acesso_erro'),
    acessoEm: timestamp('acesso_em', { withTimezone: true }), acessoTentativas: integer('acesso_tentativas').notNull().default(0),
    ...auditoria('comprador'),
  },
  (t) => [
    check('pagina_vendas_pedidos_status_ck', sql`${t.status} in (${lista(STATUS_PEDIDO)})`),
    check('pagina_vendas_pedidos_acesso_ck', sql`${t.acessoStatus} in (${lista(STATUS_ACESSO)})`),
    index('pagina_vendas_pedidos_status_envio_idx').on(t.status, t.envioPrevistoEm),
    index('pagina_vendas_pedidos_created_at_idx').on(t.createdAt),
    // Um pagamento confirma um pedido só: a mesma transação/fatura não pode marcar outro pedido como pago.
    // Parcial porque o webhook (sem assinatura) grava slug/nsu ainda em AGUARDANDO_PAGAMENTO.
    uniqueIndex('pagina_vendas_pedidos_transaction_nsu_uq').on(t.transactionNsu).where(sql`${t.transactionNsu} is not null and ${t.status} <> 'AGUARDANDO_PAGAMENTO'`),
    uniqueIndex('pagina_vendas_pedidos_invoice_slug_uq').on(t.invoiceSlug).where(sql`${t.invoiceSlug} is not null and ${t.status} <> 'AGUARDANDO_PAGAMENTO'`),
  ],
);

// Trilha de auditoria dos pedidos (append-only). `detalhe` nunca leva CPF, endereço, e-mail ou token.
export const paginaVendasPedidosHistorico = pgTable(
  'pagina_vendas_pedidos_historico',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    pedidoId: uuid('pedido_id').notNull().references(() => paginaVendasPedidos.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    quem: text('quem').notNull(),
    acao: text('acao').notNull(),
    detalhe: text('detalhe'),
    ...auditoria('sistema'),
  },
  (t) => [index('pagina_vendas_pedidos_historico_pedido_idx').on(t.pedidoId, t.createdAt)],
);

// Contas OAuth de integrações (hoje só 'bling'). Sem FK: não há tabela-pai, é configuração do site.
// Tokens cifrados (AES-256-GCM); a trilha é o modified_by/updated_at + log (sem token).
export const SITUACAO_INTEGRACAO = ['AUTORIZADA', 'REAUTORIZAR'] as const;
export const paginaVendasIntegracoes = pgTable(
  'pagina_vendas_integracoes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: text('nome').notNull().unique(),
    accessTokenCifrado: text('access_token_cifrado'),
    refreshTokenCifrado: text('refresh_token_cifrado'),
    expiraEm: timestamp('expira_em', { withTimezone: true }),
    refreshExpiraEm: timestamp('refresh_expira_em', { withTimezone: true }),
    situacao: text('situacao').$type<(typeof SITUACAO_INTEGRACAO)[number]>().notNull(),
    erro: text('erro'),
    ...auditoria('sistema'),
  },
  (t) => [check('pagina_vendas_integracoes_situacao_ck', sql`${t.situacao} in (${lista(SITUACAO_INTEGRACAO)})`)],
);
