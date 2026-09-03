import { LockKeyhole } from 'lucide-react';
import { requireChatGPTUser, chatGPTSignOutPath } from '@/app/chatgpt-auth';
import { isAdminUser } from '@/lib/admin-auth';
import { getAdminContent } from '@/db/queries';
import { AdminDashboard } from '@/components/admin-dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await requireChatGPTUser('/admin');
  if (!isAdminUser(user)) {
    return (
      <main className="access-page">
        <div className="access-card">
          <span className="access-icon">
            <LockKeyhole aria-hidden="true" />
          </span>
          <p className="eyebrow">Área reservada</p>
          <h1>Este usuário não administra o site.</h1>
          <p>Entre com o e-mail autorizado pelo casal para continuar.</p>
          <a className="admin-link-button" href={chatGPTSignOutPath('/admin')}>
            Trocar de conta
          </a>
        </div>
      </main>
    );
  }

  let content: Awaited<ReturnType<typeof getAdminContent>> | null = null;
  let databaseReady = true;
  try {
    content = await getAdminContent();
  } catch {
    databaseReady = false;
  }

  return (
    <AdminDashboard
      content={content}
      databaseReady={databaseReady}
      user={{ name: user.displayName, email: user.email }}
      signOutPath={chatGPTSignOutPath('/')}
    />
  );
}
