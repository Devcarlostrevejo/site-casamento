import { requireAdminApi } from '@/lib/admin-auth';
import { seedDemoData } from '@/db/queries';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  await seedDemoData(auth.user.userId);
  return Response.json({ ok: true });
}
