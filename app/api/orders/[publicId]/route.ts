import { getD1 } from '@/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId))
    return Response.json({ error: 'Pedido não localizado.' }, { status: 404 });
  const order = await getD1()
    .prepare(`
    SELECT o.public_id AS publicId, o.status, o.settlement_status AS settlementStatus,
      o.payment_method AS paymentMethod, o.amount_in_cents AS amountInCents,
      o.payment_expires_at AS expiresAt, o.confirmed_at AS confirmedAt, g.title AS giftTitle
    FROM orders o JOIN gifts g ON g.id = o.gift_id
    WHERE o.public_id = ? LIMIT 1
  `)
    .bind(publicId)
    .first();
  if (!order)
    return Response.json({ error: 'Pedido não localizado.' }, { status: 404 });
  return Response.json({ order }, { headers: { 'Cache-Control': 'no-store' } });
}
