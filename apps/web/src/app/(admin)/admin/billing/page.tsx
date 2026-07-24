import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { StripeSetupForm } from './stripe-setup-form';

import { Topbar } from '@/components/layout/topbar';

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Billing — Platform Admin' };

export default async function AdminBillingPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');
  if (!isPlatformAdmin(session)) redirect('/dashboard');

  return (
    <div>
      <Topbar
        title="Billing"
        subtitle="Connect Stripe so tenant admins can upgrade to a paid plan"
        userEmail={session.user.email}
        userName={session.user.name ?? undefined}
      />
      <main className="p-6">
        <StripeSetupForm />
      </main>
    </div>
  );
}
