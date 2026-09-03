import { env } from 'cloudflare:workers';
import { getD1 } from '@/db/queries';
import { requireAdminApi } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/png')
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  if (type === 'image/jpeg')
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/webp')
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    );
  return false;
}

export async function POST(request: Request) {
  const auth = await requireAdminApi(request);
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 11 * 1024 * 1024)
    return Response.json({ error: 'Envio muito grande.' }, { status: 413 });
  if (auth.response) return auth.response;
  const form = await request.formData();
  const file = form.get('file');
  const rawAltText = form.get('altText');
  const altText =
    typeof rawAltText === 'string' ? rawAltText.trim().slice(0, 200) : '';
  if (!(file instanceof File))
    return Response.json({ error: 'Selecione uma imagem.' }, { status: 400 });
  if (
    !allowedTypes.has(file.type) ||
    file.size <= 0 ||
    file.size > 10 * 1024 * 1024
  ) {
    return Response.json(
      { error: 'Use uma imagem JPEG, PNG ou WebP de até 10 MB.' },
      { status: 400 },
    );
  }
  const content = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(content, file.type))
    return Response.json(
      { error: 'O conteúdo do arquivo não corresponde ao formato informado.' },
      { status: 400 },
    );
  const db = getD1();
  const wedding = await db
    .prepare(`SELECT id FROM weddings ORDER BY created_at LIMIT 1`)
    .first<{ id: string }>();
  if (!wedding)
    return Response.json(
      { error: 'Carregue o conteúdo inicial antes de enviar fotos.' },
      { status: 404 },
    );
  const extension =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
        ? 'webp'
        : 'jpg';
  const key = `weddings/main/${crypto.randomUUID()}.${extension}`;
  await env.FILES.put(key, content, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(`INSERT INTO media (id, wedding_id, storage_key, alt_text, mime_type, size_bytes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        wedding.id,
        key,
        altText,
        file.type,
        file.size,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    await env.FILES.delete(key).catch(() => undefined);
    throw error;
  }
  return Response.json(
    { id, url: `/api/media/${encodeURIComponent(key)}` },
    { status: 201 },
  );
}
