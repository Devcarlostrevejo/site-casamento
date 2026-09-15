import { getD1 } from '@/db/queries';
import { requireAdminApi } from '@/lib/admin-auth';
import { weddingInputSchema } from '@/lib/domain';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const parsed = weddingInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: 'Confira os campos.', details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  const existing = await getD1()
    .prepare(`SELECT id FROM weddings ORDER BY created_at LIMIT 1`)
    .first<{ id: string }>();
  if (!existing)
    return Response.json(
      { error: 'Carregue o conteúdo inicial antes de editar.' },
      { status: 404 },
    );
  const data = parsed.data;
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(`UPDATE weddings SET partner_one_name = ?, partner_two_name = ?, event_at = ?,
      headline = ?, welcome_text = ?, story_title = ?, story = ?, ceremony_name = ?,
      ceremony_address = ?, ceremony_instructions = ?, ceremony_maps_url = ?,
      venue_name = ?, venue_address = ?, venue_instructions = ?, maps_url = ?, hero_image_url = ?, pix_key = ?,
      pix_recipient_name = ?, pix_recipient_city = ?, published = ?, updated_at = ? WHERE id = ?`)
      .bind(
        data.partnerOneName,
        data.partnerTwoName,
        data.eventAt,
        data.headline,
        data.welcomeText,
        data.storyTitle,
        data.story,
        data.ceremonyName,
        data.ceremonyAddress,
        data.ceremonyInstructions,
        data.ceremonyMapsUrl || null,
        data.venueName,
        data.venueAddress,
        data.venueInstructions,
        data.mapsUrl || null,
        data.heroImageUrl || null,
        data.pixKey,
        data.pixRecipientName,
        data.pixRecipientCity,
        data.published ? 1 : 0,
        now,
        existing.id,
      ),
    getD1()
      .prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, 'UPDATE', 'wedding', ?, NULL, ?)`)
      .bind(crypto.randomUUID(), auth.user.userId, existing.id, now),
  ]);
  return Response.json({ ok: true });
}
