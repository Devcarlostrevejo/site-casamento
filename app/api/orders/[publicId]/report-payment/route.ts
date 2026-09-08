import { getD1 } from '@/db/queries';
import { isSameOriginRequest } from '@/lib/security';

export const dynamic = 'force-dynamic';

type PixOrder = {
  id: string;
  weddingId: string;
  guestName: string;
  amountInCents: number;
  status: string;
  paymentMethod: string;
  giftTitle: string;
};

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  if (!isSameOriginRequest(request))
    return Response.json(
      { error: 'Origem da solicitação inválida.' },
      { status: 403 },
    );
  const { publicId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId))
    return Response.json({ error: 'Pedido não localizado.' }, { status: 404 });

  const db = getD1();
  const order = await db
    .prepare(`
    SELECT o.id, o.wedding_id AS weddingId, o.guest_name AS guestName,
      o.amount_in_cents AS amountInCents, o.status, o.payment_method AS paymentMethod,
      g.title AS giftTitle
    FROM orders o JOIN gifts g ON g.id = o.gift_id
    WHERE o.public_id = ? LIMIT 1
  `)
    .bind(publicId)
    .first<PixOrder>();
  if (!order || order.paymentMethod !== 'PIX')
    return Response.json(
      { error: 'Pedido Pix não localizado.' },
      { status: 404 },
    );
  if (order.status === 'CONFIRMED')
    return Response.json({ status: 'CONFIRMED' });

  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(`UPDATE orders SET status = 'AWAITING_REVIEW', updated_at = ?
      WHERE id = ? AND status != 'CONFIRMED'`)
      .bind(now, order.id),
    db
      .prepare(`INSERT OR IGNORE INTO admin_notifications
      (id, wedding_id, order_id, dedupe_key, type, title, message, created_at)
      VALUES (?, ?, ?, ?, 'PIX_REPORTED', 'Pix aguardando conferência', ?, ?)`)
      .bind(
        crypto.randomUUID(),
        order.weddingId,
        order.id,
        `pix-reported:${order.id}`,
        `${order.guestName} informou um Pix de ${money(order.amountInCents)} para “${order.giftTitle}”. Confira o extrato antes de confirmar.`,
        now,
      ),
  ]);
  return Response.json({ status: 'AWAITING_REVIEW' });
}
