import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const weddings = sqliteTable('weddings', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  partnerOneName: text('partner_one_name').notNull(),
  partnerTwoName: text('partner_two_name').notNull(),
  eventAt: text('event_at').notNull(),
  timezone: text('timezone').notNull().default('America/Sao_Paulo'),
  headline: text('headline').notNull().default('Nós vamos nos casar'),
  welcomeText: text('welcome_text').notNull().default(''),
  storyTitle: text('story_title')
    .notNull()
    .default('Foi encontro. Virou casa.'),
  story: text('story').notNull().default(''),
  venueName: text('venue_name').notNull().default(''),
  venueAddress: text('venue_address').notNull().default(''),
  venueInstructions: text('venue_instructions').notNull().default(''),
  mapsUrl: text('maps_url'),
  heroImageUrl: text('hero_image_url'),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const giftCategories = sqliteTable(
  'gift_categories',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    uniqueIndex('uidx_categories_wedding_slug').on(table.weddingId, table.slug),
    index('idx_categories_wedding_order').on(table.weddingId, table.sortOrder),
  ],
);

export const gifts = sqliteTable(
  'gifts',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    categoryId: text('category_id').references(() => giftCategories.id),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    imageUrl: text('image_url'),
    priceInCents: integer('price_in_cents').notNull(),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uidx_gifts_wedding_slug').on(table.weddingId, table.slug),
    index('idx_gifts_public_list').on(
      table.weddingId,
      table.active,
      table.sortOrder,
    ),
  ],
);

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    publicId: text('public_id').notNull().unique(),
    clientRequestId: text('client_request_id').notNull().unique(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    giftId: text('gift_id')
      .notNull()
      .references(() => gifts.id),
    guestName: text('guest_name').notNull(),
    guestEmail: text('guest_email').notNull(),
    guestMessage: text('guest_message'),
    privacyAcceptedAt: text('privacy_accepted_at').notNull(),
    amountInCents: integer('amount_in_cents').notNull(),
    currency: text('currency').notNull().default('BRL'),
    paymentMethod: text('payment_method').notNull(),
    status: text('status').notNull().default('PENDING'),
    settlementStatus: text('settlement_status').notNull().default('PENDING'),
    provider: text('provider').notNull().default('ASAAS'),
    providerCustomerId: text('provider_customer_id'),
    providerPaymentId: text('provider_payment_id').unique(),
    providerCheckoutUrl: text('provider_checkout_url'),
    paymentExpiresAt: text('payment_expires_at'),
    confirmedAt: text('confirmed_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_orders_wedding_status').on(table.weddingId, table.status),
    index('idx_orders_created_at').on(table.createdAt),
  ],
);

export const webhookEvents = sqliteTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    providerEventId: text('provider_event_id').notNull().unique(),
    eventType: text('event_type').notNull(),
    providerPaymentId: text('provider_payment_id'),
    payloadHash: text('payload_hash').notNull(),
    processingStatus: text('processing_status').notNull().default('RECEIVED'),
    lastError: text('last_error'),
    receivedAt: text('received_at').notNull(),
    processedAt: text('processed_at'),
  },
  (table) => [
    index('idx_webhook_provider_payment').on(table.providerPaymentId),
  ],
);

export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey(),
    weddingId: text('wedding_id')
      .notNull()
      .references(() => weddings.id),
    storageKey: text('storage_key').notNull().unique(),
    altText: text('alt_text').notNull().default(''),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_media_wedding').on(table.weddingId)],
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    metadata: text('metadata'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_audit_entity').on(table.entityType, table.entityId)],
);
