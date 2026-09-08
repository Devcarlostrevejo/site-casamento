import { z } from 'zod';
import { getD1 } from '@/db/queries';
import { getAuthorizedAdmin, requireAdminApi } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  notificationId: z.uuid().optional(),
  all: z.boolean().optional(),
});

export async function GET(_request: Request) {
  const user = await getAuthorizedAdmin();
  if (!user)
    return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
  const db = getD1();
  const result = await db
    .prepare(`SELECT n.id, n.type, n.title, n.message, n.read_at AS readAt,
      n.created_at AS createdAt, o.public_id AS orderPublicId
      FROM admin_notifications n JOIN orders o ON o.id = n.order_id
      ORDER BY n.created_at DESC LIMIT 50`)
    .all();
  const unread = await db
    .prepare(
      `SELECT COUNT(*) AS total FROM admin_notifications WHERE read_at IS NULL`,
    )
    .first<{ total: number }>();
  const orders = await db
    .prepare(`SELECT o.public_id AS publicId, o.guest_name AS guestName,
      o.guest_email AS guestEmail, o.guest_message AS guestMessage,
      o.amount_in_cents AS amountInCents, o.payment_method AS paymentMethod,
      o.status, o.settlement_status AS settlementStatus, o.created_at AS createdAt,
      g.title AS giftTitle FROM orders o JOIN gifts g ON g.id = o.gift_id
      ORDER BY o.created_at DESC LIMIT 200`)
    .all();
  return Response.json({
    notifications: result.results,
    unreadCount: Number(unread?.total ?? 0),
    orders: orders.results,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.all && !parsed.data.notificationId))
    return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
  const db = getD1();
  const now = new Date().toISOString();
  if (parsed.data.all) {
    await db
      .prepare(
        `UPDATE admin_notifications SET read_at = ? WHERE read_at IS NULL`,
      )
      .bind(now)
      .run();
  } else {
    await db
      .prepare(`UPDATE admin_notifications SET read_at = ? WHERE id = ?`)
      .bind(now, parsed.data.notificationId)
      .run();
  }
  return Response.json({ ok: true });
}
