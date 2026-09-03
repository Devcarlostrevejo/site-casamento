import { getD1 } from '@/db/queries';
import { requireAdminApi } from '@/lib/admin-auth';
import { giftInputSchema, slugify } from '@/lib/domain';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const parsed = giftInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: 'Confira os campos.', details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  const { id } = await context.params;
  const data = parsed.data;
  const now = new Date().toISOString();
  const result = await getD1()
    .prepare(`UPDATE gifts SET title = ?, slug = ?, description = ?,
    image_url = ?, category_id = ?, price_in_cents = ?, featured = ?, active = ?, sort_order = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL`)
    .bind(
      data.title,
      `${slugify(data.title)}-${id.slice(0, 8)}`,
      data.description,
      data.imageUrl || null,
      data.categoryId || null,
      data.priceInCents,
      data.featured ? 1 : 0,
      data.active ? 1 : 0,
      data.sortOrder,
      now,
      id,
    )
    .run();
  if ((result.meta.changes ?? 0) === 0)
    return Response.json(
      { error: 'Presente não localizado.' },
      { status: 404 },
    );
  await getD1()
    .prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    VALUES (?, ?, 'UPDATE', 'gift', ?, NULL, ?)`)
    .bind(crypto.randomUUID(), auth.user.userId, id, now)
    .run();
  return Response.json({ ok: true });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const now = new Date().toISOString();
  const result = await getD1()
    .prepare(`UPDATE gifts SET active = 0, deleted_at = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL`)
    .bind(now, now, id)
    .run();
  if ((result.meta.changes ?? 0) === 0)
    return Response.json(
      { error: 'Presente não localizado.' },
      { status: 404 },
    );
  await getD1()
    .prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
    VALUES (?, ?, 'DELETE', 'gift', ?, NULL, ?)`)
    .bind(crypto.randomUUID(), auth.user.userId, id, now)
    .run();
  return Response.json({ ok: true });
}
