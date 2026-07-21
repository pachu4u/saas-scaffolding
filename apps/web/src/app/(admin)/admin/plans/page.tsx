import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plans — Admin' };

interface FeatureRow {
  label: string;
  slug: string;
  free: boolean;
  pro: boolean;
  enterprise: boolean;
}

const FEATURES: FeatureRow[] = [
  {
    label: 'Basic Chat',
    slug: 'feature:basic_chat:access',
    free: true,
    pro: true,
    enterprise: true,
  },
  {
    label: 'Knowledge Bases',
    slug: 'feature:knowledge_bases:access',
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    label: 'Deployments',
    slug: 'feature:deployments:access',
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    label: 'MCP Servers',
    slug: 'feature:mcp:access',
    free: false,
    pro: false,
    enterprise: true,
  },
  {
    label: 'Memory',
    slug: 'feature:memory:access',
    free: false,
    pro: false,
    enterprise: true,
  },
  {
    label: 'Multi-Agent / Agentic Sessions',
    slug: 'feature:multi_agent:access',
    free: false,
    pro: false,
    enterprise: true,
  },
];

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className="mx-auto h-5 w-5 text-green-500"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Dash() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className="mx-auto h-5 w-5 text-zinc-300"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

const PLAN_LABELS: Record<string, { label: string; badge: string }> = {
  free: { label: 'Free', badge: 'bg-zinc-100 text-zinc-600' },
  pro: { label: 'Pro', badge: 'bg-blue-100 text-blue-700' },
  enterprise: { label: 'Enterprise', badge: 'bg-violet-100 text-violet-700' },
};

export default async function PlansPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');
  if (!isPlatformAdmin(session)) redirect('/dashboard');

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Plans &amp; Riogentix Features</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Which Riogentix feature-permission slugs each plan tier unlocks. These slugs are enforced
          by the Riogentix API on every request via the{' '}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">saas_plan</code> JWT claim.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="px-4 py-3 text-left font-medium text-zinc-600">Feature</th>
              <th className="px-4 py-3 text-left font-mono text-xs font-medium text-zinc-400">
                Permission slug
              </th>
              {Object.entries(PLAN_LABELS).map(([key, { label, badge }]) => (
                <th key={key} className="px-4 py-3 text-center font-medium text-zinc-600">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
                    {label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {FEATURES.map((row) => (
              <tr key={row.slug} className="hover:bg-zinc-50/60">
                <td className="px-4 py-3 font-medium text-zinc-800">{row.label}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">{row.slug}</td>
                <td className="px-4 py-3 text-center">{row.free ? <Check /> : <Dash />}</td>
                <td className="px-4 py-3 text-center">{row.pro ? <Check /> : <Dash />}</td>
                <td className="px-4 py-3 text-center">{row.enterprise ? <Check /> : <Dash />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">How it works</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
          <li>
            <strong>Keycloak</strong> embeds{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">saas_plan</code>,{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">saas_role</code>,{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">saas_tenant_id</code>, and{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">usage_locked</code> in every
            JWT via OIDC protocol mappers.
          </li>
          <li>
            <strong>SaasClaimsMiddleware</strong> (Riogentix) reads those claims from the bearer
            token on each request and attaches them to{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">request.state</code>.
          </li>
          <li>
            <strong>require_feature(slug)</strong> dependency gates entire router sub-trees —
            returns HTTP 403 with{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">X-Saas-Feature-Required</code>{' '}
            when the tenant&apos;s plan lacks the slug.
          </li>
          <li>
            <strong>UsageLockMiddleware</strong> separately blocks all write operations (POST / PUT
            / PATCH / DELETE) when{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">usage_locked=true</code>.
          </li>
          <li>
            Plan changes sync via{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">plan-changed</code> worker →{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
              PUT /api/v1/internal/saas/tenant/&#123;id&#125;/plan
            </code>{' '}
            on the Riogentix instance.
          </li>
        </ul>
      </div>
    </div>
  );
}
