import { z } from 'zod';
import { getD1 } from '@/db/queries';
import { requireAdminApi } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({ action: z.enum(['CONFIRM', 'REOPEN']) });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const { publicId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId))
    return Response.json({ error: 'Pedido não localizado.' }, { status: 404 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Ação inválida.' }, { status: 400 });

  const db = getD1();
  const order = await db
    .prepare(`SELECT id, payment_method AS paymentMethod FROM orders
      WHERE public_id = ? LIMIT 1`)
    .bind(publicId)
    .first<{ id: string; paymentMethod: string }>();
  if (!order || order.paymentMethod !== 'PIX')
    return Response.json(
      {
        error:
          'Somente pagamentos Pix diretos podem ser conferidos manualmente.',
      },
      { status: 400 },
    );

  const now = new Date().toISOString();
  const confirmed = parsed.data.action === 'CONFIRM';
  await db.batch([
    db
      .prepare(`UPDATE orders SET status = ?, settlement_status = ?, confirmed_at = ?, updated_at = ?
      WHERE id = ?`)
      .bind(
        confirmed ? 'CONFIRMED' : 'AWAITING_REVIEW',
        confirmed ? 'AVAILABLE' : 'PENDING',
        confirmed ? now : null,
        now,
        order.id,
      ),
    db
      .prepare(`UPDATE admin_notifications SET read_at = COALESCE(read_at, ?)
      WHERE order_id = ? AND type = 'PIX_REPORTED'`)
      .bind(now, order.id),
    db
      .prepare(`INSERT INTO audit_logs
      (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, ?, 'order', ?, ?, ?)`)
      .bind(
        crypto.randomUUID(),
        auth.user.userId,
        confirmed ? 'CONFIRM_PIX' : 'REOPEN_PIX',
        order.id,
        JSON.stringify({ publicId }),
        now,
      ),
  ]);
  return Response.json({ status: confirmed ? 'CONFIRMED' : 'AWAITING_REVIEW' });
}
