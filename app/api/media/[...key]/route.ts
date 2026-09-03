import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const objectKey = key.join('/');
  if (
    !/^weddings\/[a-zA-Z0-9_-]+\/[a-f0-9-]+\.(?:png|webp|jpg)$/.test(objectKey)
  ) {
    return new Response('Not found', { status: 404 });
  }
  const object = await env.FILES.get(objectKey);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
}
