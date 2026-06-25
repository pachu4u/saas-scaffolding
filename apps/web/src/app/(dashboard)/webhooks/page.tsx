import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { WebhooksClient } from './webhooks-client';

import { Topbar } from '@/components/layout/topbar';

export const metadata = { title: 'Webhooks' };

export default async function WebhooksPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  return (
    <div>
      <Topbar
        title="Webhooks"
        subtitle="Send real-time event notifications to your services"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />
      <WebhooksClient />
    </div>
  );
}
