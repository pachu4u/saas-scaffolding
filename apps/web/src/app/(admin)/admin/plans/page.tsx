import { auth } from '@platform/auth';
import { PLAN_CODES, PLAN_FEATURES } from '@platform/billing';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Plans & Riogentix Features — Admin' };

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

export default async function AdminPlansPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');
  if (!isPlatformAdmin(session)) redirect('/dashboard');

  return (
    <div>
      <div
        className="border-b px-6 py-4"
        style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
      >
        <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          Plans & Riogentix Features
        </h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Plan → SaaS & Riogentix feature mapping · platform admin only
        </p>
      </div>

      <main className="p-6">
        <div
          className="overflow-hidden rounded-xl border"
          style={{
            background: 'var(--bg-white)',
            borderColor: 'var(--border-light)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                {['Plan', 'SaaS Features', 'Riogentix Features'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_CODES.map((plan) => {
                const f = PLAN_FEATURES[plan];
                const saasFeatures: string[] = [];
                if (f.notes.maxCount !== null)
                  saasFeatures.push(`Notes: up to ${String(f.notes.maxCount)}`);
                else saasFeatures.push('Notes: unlimited');
                if (f.notes.delete) saasFeatures.push('Delete notes');
                if (f.users.maxCount !== null)
                  saasFeatures.push(`Users: up to ${String(f.users.maxCount)}`);
                else saasFeatures.push('Users: unlimited');
                if (f.scim) saasFeatures.push('SCIM provisioning');
                if (f.webhooks) saasFeatures.push('Webhooks');
                if (f.customDomain) saasFeatures.push('Custom domain');

                return (
                  <tr key={plan} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td className="px-6 py-4">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
                        style={{
                          background:
                            plan === 'enterprise'
                              ? '#EDE9FE'
                              : plan === 'pro'
                                ? 'var(--brand-subtle)'
                                : 'var(--border-light)',
                          color:
                            plan === 'enterprise'
                              ? '#7C3AED'
                              : plan === 'pro'
                                ? 'var(--brand-primary)'
                                : 'var(--text-secondary)',
                        }}
                      >
                        {plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <ul className="space-y-0.5">
                        {saasFeatures.map((feat) => (
                          <li
                            key={feat}
                            className="text-xs"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {feat}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4">
                      <ul className="space-y-0.5">
                        {f.riogentix.features.map((feat) => (
                          <li
                            key={feat}
                            className="font-mono text-xs"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {feat}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
