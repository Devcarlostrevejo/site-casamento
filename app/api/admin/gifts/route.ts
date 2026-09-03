import { getD1 } from '@/db/queries';
import { requireAdminApi } from '@/lib/admin-auth';
import { giftInputSchema, slugify } from '@/lib/domain';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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
  const wedding = await getD1()
    .prepare(`SELECT id FROM weddings ORDER BY created_at LIMIT 1`)
    .first<{ id: string }>();
  if (!wedding)
    return Response.json(
      { error: 'Carregue o conteúdo inicial antes de criar presentes.' },
      { status: 404 },
    );
  const data = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = `${slugify(data.title)}-${id.slice(0, 8)}`;
  await getD1().batch([
    getD1()
      .prepare(`INSERT INTO gifts
      (id, wedding_id, category_id, title, slug, description, image_url, price_in_cents,
       featured, active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        wedding.id,
        data.categoryId || null,
        data.title,
        slug,
        data.description,
        data.imageUrl || null,
        data.priceInCents,
        data.featured ? 1 : 0,
        data.active ? 1 : 0,
        data.sortOrder,
        now,
        now,
      ),
    getD1()
      .prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, 'CREATE', 'gift', ?, NULL, ?)`)
      .bind(crypto.randomUUID(), auth.user.userId, id, now),
  ]);
  return Response.json({ id }, { status: 201 });
}
