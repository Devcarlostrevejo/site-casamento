import { env } from 'cloudflare:workers';
import {
  demoGifts,
  demoWedding,
  DEMO_WEDDING_ID,
  type PublicGift,
  type WeddingData,
} from '@/lib/demo-data';

type DbWeddingRow = Omit<WeddingData, 'published'> & {
  published: number | boolean;
};
type DbGiftRow = Omit<PublicGift, 'featured' | 'active'> & {
  featured: number | boolean;
  active: number | boolean;
};
export type AdminOrderRow = {
  publicId: string;
  guestName: string;
  guestEmail: string;
  guestMessage: string | null;
  amountInCents: number;
  paymentMethod: string;
  status: string;
  settlementStatus: string;
  createdAt: string;
  giftTitle: string;
};
export type AdminNotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  orderPublicId: string;
};

function database() {
  if (!env.DB) throw new Error('D1 binding DB não está disponível.');
  return env.DB;
}

export async function getPublicContent(): Promise<{
  wedding: WeddingData;
  gifts: PublicGift[];
  usingDemo: boolean;
}> {
  try {
    const db = database();
    const weddingResult = await db
      .prepare(`
      SELECT id, slug, partner_one_name AS partnerOneName, partner_two_name AS partnerTwoName,
        event_at AS eventAt, timezone, headline, welcome_text AS welcomeText,
        story_title AS storyTitle, story, venue_name AS venueName,
        venue_address AS venueAddress, venue_instructions AS venueInstructions,
        maps_url AS mapsUrl, hero_image_url AS heroImageUrl, pix_key AS pixKey,
        pix_recipient_name AS pixRecipientName, pix_recipient_city AS pixRecipientCity, published
      FROM weddings WHERE published = 1 ORDER BY created_at LIMIT 1
    `)
      .first<DbWeddingRow>();

    if (!weddingResult)
      return { wedding: demoWedding, gifts: [...demoGifts], usingDemo: true };
    const giftResult = await db
      .prepare(`
      SELECT id, wedding_id AS weddingId, category_id AS categoryId, title, slug, description,
        image_url AS imageUrl, price_in_cents AS priceInCents, featured, active,
        sort_order AS sortOrder
      FROM gifts
      WHERE wedding_id = ? AND active = 1 AND deleted_at IS NULL
      ORDER BY featured DESC, sort_order ASC, created_at ASC
    `)
      .bind(weddingResult.id)
      .all<DbGiftRow>();

    return {
      wedding: {
        ...weddingResult,
        published: Boolean(weddingResult.published),
        mapsUrl: weddingResult.mapsUrl ?? '',
        heroImageUrl: weddingResult.heroImageUrl ?? '',
      },
      gifts: giftResult.results.map((gift) => ({
        ...gift,
        featured: Boolean(gift.featured),
        active: Boolean(gift.active),
      })),
      usingDemo: false,
    };
  } catch (error) {
    console.warn(
      'Public content fallback activated:',
      error instanceof Error ? error.message : 'unknown',
    );
    return { wedding: demoWedding, gifts: [...demoGifts], usingDemo: true };
  }
}

export async function getAdminContent() {
  const db = database();
  const wedding = await db
    .prepare(`
    SELECT id, slug, partner_one_name AS partnerOneName, partner_two_name AS partnerTwoName,
      event_at AS eventAt, timezone, headline, welcome_text AS welcomeText,
      story_title AS storyTitle, story, venue_name AS venueName,
      venue_address AS venueAddress, venue_instructions AS venueInstructions,
      maps_url AS mapsUrl, hero_image_url AS heroImageUrl, pix_key AS pixKey,
      pix_recipient_name AS pixRecipientName, pix_recipient_city AS pixRecipientCity, published
    FROM weddings ORDER BY created_at LIMIT 1
  `)
    .first<DbWeddingRow>();
  const giftsResult = await db
    .prepare(`
    SELECT id, wedding_id AS weddingId, category_id AS categoryId, title, slug, description,
      image_url AS imageUrl, price_in_cents AS priceInCents, featured, active,
      sort_order AS sortOrder
    FROM gifts WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC
  `)
    .all<DbGiftRow>();
  const ordersResult = await db
    .prepare(`
    SELECT o.public_id AS publicId, o.guest_name AS guestName, o.guest_email AS guestEmail,
      o.guest_message AS guestMessage, o.amount_in_cents AS amountInCents,
      o.payment_method AS paymentMethod, o.status, o.settlement_status AS settlementStatus,
      o.created_at AS createdAt, g.title AS giftTitle
    FROM orders o JOIN gifts g ON g.id = o.gift_id
    ORDER BY o.created_at DESC LIMIT 200
  `)
    .all<AdminOrderRow>();
  const notificationsResult = await db
    .prepare(`
    SELECT n.id, n.type, n.title, n.message, n.read_at AS readAt,
      n.created_at AS createdAt, o.public_id AS orderPublicId
    FROM admin_notifications n JOIN orders o ON o.id = n.order_id
    ORDER BY n.created_at DESC LIMIT 50
  `)
    .all<AdminNotificationRow>();
  return {
    wedding: wedding
      ? {
          ...wedding,
          published: Boolean(wedding.published),
          mapsUrl: wedding.mapsUrl ?? '',
          heroImageUrl: wedding.heroImageUrl ?? '',
        }
      : null,
    gifts: giftsResult.results.map((gift) => ({
      ...gift,
      featured: Boolean(gift.featured),
      active: Boolean(gift.active),
    })),
    orders: ordersResult.results,
    notifications: notificationsResult.results,
  };
}

export async function seedDemoData(actorUserId: string) {
  const db = database();
  const now = new Date().toISOString();
  const statements = [
    db
      .prepare(`INSERT OR IGNORE INTO weddings
      (id, slug, partner_one_name, partner_two_name, event_at, timezone, headline, welcome_text,
       story_title, story, venue_name, venue_address, venue_instructions, maps_url, hero_image_url,
       pix_key, pix_recipient_name, pix_recipient_city, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        DEMO_WEDDING_ID,
        demoWedding.slug,
        demoWedding.partnerOneName,
        demoWedding.partnerTwoName,
        demoWedding.eventAt,
        demoWedding.timezone,
        demoWedding.headline,
        demoWedding.welcomeText,
        demoWedding.storyTitle,
        demoWedding.story,
        demoWedding.venueName,
        demoWedding.venueAddress,
        demoWedding.venueInstructions,
        demoWedding.mapsUrl,
        demoWedding.heroImageUrl,
        demoWedding.pixKey,
        demoWedding.pixRecipientName,
        demoWedding.pixRecipientCity,
        1,
        now,
        now,
      ),
    ...demoGifts.map((gift) =>
      db
        .prepare(`INSERT OR IGNORE INTO gifts
      (id, wedding_id, category_id, title, slug, description, image_url, price_in_cents,
       featured, active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          gift.id,
          gift.weddingId,
          gift.categoryId,
          gift.title,
          gift.slug,
          gift.description,
          gift.imageUrl,
          gift.priceInCents,
          gift.featured ? 1 : 0,
          gift.active ? 1 : 0,
          gift.sortOrder,
          now,
          now,
        ),
    ),
    db
      .prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, 'SEED_DEMO', 'wedding', ?, NULL, ?)`)
      .bind(crypto.randomUUID(), actorUserId, DEMO_WEDDING_ID, now),
  ];
  await db.batch(statements);
}

export function getD1() {
  return database();
}
