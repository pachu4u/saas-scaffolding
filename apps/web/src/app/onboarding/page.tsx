import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { OnboardingWizard } from './onboarding-wizard';

export const dynamic = 'force-dynamic';

// Provisioning a brand-new tenant is a platform-admin action — regular
// tenant members have no legitimate reason to reach this page.
export default async function OnboardingPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));

  if (!isPlatformAdmin) redirect('/no-workspace');

  return <OnboardingWizard />;
}
