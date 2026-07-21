import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { InnerNav } from '@/components/layout/inner-nav';
import { Topbar } from '@/components/layout/topbar';

const settingsNav = [
  { label: 'General', href: '/admin/settings' },
  { label: 'Branding', href: '/admin/settings/branding' },
  { label: 'Security & SSO', href: '/admin/settings/security' },
  { label: 'API Keys', href: '/admin/settings/api-keys' },
  { label: 'Compliance', href: '/admin/settings/compliance' },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div>
      <Topbar
        title="Settings"
        subtitle="Workspace configuration, branding, and security"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />
      <div
        className="border-b"
        style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
      >
        <InnerNav items={settingsNav} />
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
