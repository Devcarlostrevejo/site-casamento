import { env } from 'cloudflare:workers';
import { getChatGPTUser, type ChatGPTUser } from '@/app/chatgpt-auth';
import { isSameOriginRequest } from '@/lib/security';

function configuredAdminEmails() {
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: ChatGPTUser) {
  const configured = configuredAdminEmails();
  if (configured.length === 0)
    return (
      env.ALLOW_TEST_ADMIN === 'true' &&
      user.email.toLowerCase() === 'seedy@sites.test'
    );
  return configured.includes(user.email.toLowerCase());
}

export async function getAuthorizedAdmin() {
  const user = await getChatGPTUser();
  return user && isAdminUser(user) ? user : null;
}

export async function requireAdminApi(request: Request) {
  if (!isSameOriginRequest(request)) {
    return {
      user: null,
      response: Response.json(
        { error: 'Origem da solicitação inválida.' },
        { status: 403 },
      ),
    } as const;
  }
  const user = await getAuthorizedAdmin();
  if (user) return { user, response: null } as const;
  return {
    user: null,
    response: Response.json(
      { error: 'Acesso não autorizado.' },
      { status: 401 },
    ),
  } as const;
}
