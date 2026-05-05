import Link from 'next/link';

const features = [
  {
    icon: '⚡',
    title: 'Multi-Tenant Architecture',
    description:
      'Subdomain-per-tenant routing with Postgres Row-Level Security. Strict tenant isolation enforced at every layer.',
  },
  {
    icon: '🔐',
    title: 'Enterprise SSO & SCIM',
    description:
      'Keycloak-backed OIDC/SAML, SCIM 2.0 for automated provisioning from Okta, Entra ID, and any compliant IdP.',
  },
  {
    icon: '🛡️',
    title: 'RBAC + ABAC Authorization',
    description:
      'Role-based and attribute-based access control with plan-gated entitlements. One unified permission engine.',
  },
  {
    icon: '💳',
    title: 'Stripe Billing Built-In',
    description:
      'Free, Pro, and Enterprise plans with Stripe Checkout, Customer Portal, and idempotent webhook handling.',
  },
  {
    icon: '📊',
    title: 'Full Observability',
    description:
      'OpenTelemetry traces, structured logs with pino, and Grafana LGTM dashboards. Trace every request end-to-end.',
  },
  {
    icon: '🔁',
    title: 'Async Job Engine',
    description:
      'BullMQ on Redis with retries, DLQ, and idempotency keys. Scales to millions of background jobs per day.',
  },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For startups and small teams getting started.',
    features: [
      'Up to 5 users',
      '1 tenant workspace',
      'Core RBAC',
      'Community support',
      '7-day audit log',
    ],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: 'per month',
    description: 'For growing teams that need more power.',
    features: [
      'Up to 50 users',
      '5 tenant workspaces',
      'SSO + SCIM provisioning',
      'Priority support',
      '90-day audit log',
      'Custom domains',
      'Webhook integrations',
    ],
    cta: 'Start Pro trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    description: 'For large organizations with advanced needs.',
    features: [
      'Unlimited users',
      'Unlimited workspaces',
      'Dedicated infrastructure',
      'SLA-backed support',
      'Unlimited audit log',
      'Custom branding',
      'SAML + SCIM',
      'Compliance exports',
    ],
    cta: 'Contact sales',
    highlighted: false,
  },
];

const stats = [
  { value: '99.99%', label: 'Uptime SLA' },
  { value: '<150ms', label: 'p95 API latency' },
  { value: 'SOC 2', label: 'Compliant ready' },
  { value: '∞', label: 'Tenant scalability' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      {/* Navigation */}
      <nav
        className="fixed left-0 right-0 top-0 z-50 border-b"
        style={{
          borderColor: 'var(--border-light)',
          background: 'rgba(248, 246, 255, 0.85)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
              R
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              riogentix
            </span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {['Features', 'Pricing', 'Docs', 'Blog'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="hover:text-brand-primary text-sm font-medium transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="hover:text-brand-primary text-sm font-medium transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              Sign in
            </Link>
            <Link
              href="/auth/signin"
              className="brand-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-32">
        {/* Background orbs */}
        <div
          className="pointer-events-none absolute left-1/4 top-20 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'var(--glow-purple)' }}
        />
        <div
          className="pointer-events-none absolute right-1/4 top-40 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{ background: 'var(--glow-blue)' }}
        />

        <div className="relative mx-auto max-w-5xl text-center">
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              background: 'var(--bg-subtle)',
              borderColor: 'var(--border-default)',
              color: 'var(--brand-secondary)',
            }}
          >
            <span className="bg-brand-accent h-1.5 w-1.5 animate-pulse rounded-full" />
            Now with SCIM 2.0 & custom domain support
          </div>

          <h1 className="mb-6 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
            <span style={{ color: 'var(--text-primary)' }}>The enterprise</span>{' '}
            <span className="brand-gradient-text">SaaS platform</span>{' '}
            <span style={{ color: 'var(--text-primary)' }}>you&apos;ve been waiting for</span>
          </h1>

          <p
            className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed md:text-xl"
            style={{ color: 'var(--text-secondary)' }}
          >
            riogentix gives you multi-tenancy, SSO, RBAC, billing, observability, and async workers
            — all pre-wired and production-ready on day one.
          </p>

          <div className="mb-16 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/signin"
              className="brand-gradient brand-shadow rounded-xl px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Start building free →
            </Link>
            <a
              href="#features"
              className="hover:bg-bg-subtle rounded-xl border px-8 py-4 text-base font-semibold transition-colors"
              style={{
                color: 'var(--text-primary)',
                borderColor: 'var(--border-default)',
                background: 'var(--bg-white)',
              }}
            >
              See what&apos;s included
            </a>
          </div>

          {/* Stats row */}
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border p-4 text-center"
                style={{ background: 'var(--bg-white)', borderColor: 'var(--border-light)' }}
              >
                <div className="brand-gradient-text text-2xl font-extrabold">{s.value}</div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div
            className="brand-shadow relative overflow-hidden rounded-3xl border"
            style={{ borderColor: 'var(--border-light)' }}
          >
            {/* Mock dashboard UI */}
            <div className="flex" style={{ background: 'var(--bg-white)', minHeight: '420px' }}>
              {/* Sidebar */}
              <div
                className="flex w-56 flex-col gap-1 border-r p-4"
                style={{ borderColor: 'var(--border-light)', background: 'var(--bg-main)' }}
              >
                <div className="mb-4 flex items-center gap-2 p-2">
                  <div className="brand-gradient h-6 w-6 rounded" />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    riogentix
                  </span>
                </div>
                {['Dashboard', 'Team', 'Billing', 'Settings', 'Audit Log'].map((item, i) => (
                  <div
                    key={item}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium ${i === 0 ? 'text-white' : ''}`}
                    style={
                      i === 0
                        ? { background: 'var(--brand-primary)' }
                        : { color: 'var(--text-secondary)' }
                    }
                  >
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-white' : ''}`}
                      style={i !== 0 ? { background: 'var(--border-default)' } : {}}
                    />
                    {item}
                  </div>
                ))}
              </div>
              {/* Main content */}
              <div className="flex-1 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <div
                      className="mb-2 h-3 w-32 rounded-full"
                      style={{ background: 'var(--border-light)' }}
                    />
                    <div
                      className="h-5 w-20 rounded-full"
                      style={{ background: 'var(--bg-subtle)' }}
                    />
                  </div>
                  <div className="brand-gradient h-8 w-24 rounded-lg" />
                </div>
                <div className="mb-6 grid grid-cols-4 gap-4">
                  {['#4F7BFF', '#6A6DFF', '#B06CFF', '#16A34A'].map((color, i) => (
                    <div
                      key={i}
                      className="rounded-xl border p-4"
                      style={{ borderColor: 'var(--border-light)' }}
                    >
                      <div
                        className="mb-3 h-2 w-16 rounded-full"
                        style={{ background: 'var(--border-light)' }}
                      />
                      <div className="text-xl font-bold" style={{ color }}>
                        {['2,847', '98.9%', '143ms', '$4.2k'][i]}
                      </div>
                      <div
                        className="mt-1 h-1.5 w-12 rounded-full"
                        style={{ background: 'var(--border-light)' }}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div
                    className="col-span-2 rounded-xl border p-4"
                    style={{ borderColor: 'var(--border-light)' }}
                  >
                    <div
                      className="mb-4 h-2 w-24 rounded-full"
                      style={{ background: 'var(--border-light)' }}
                    />
                    <div className="flex h-24 items-end gap-1">
                      {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm"
                          style={{
                            height: `${String(h)}%`,
                            background:
                              i % 3 === 0
                                ? 'var(--brand-accent)'
                                : i % 3 === 1
                                  ? 'var(--brand-secondary)'
                                  : 'var(--brand-primary)',
                            opacity: 0.7 + i * 0.02,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div
                    className="rounded-xl border p-4"
                    style={{ borderColor: 'var(--border-light)' }}
                  >
                    <div
                      className="mb-3 h-2 w-20 rounded-full"
                      style={{ background: 'var(--border-light)' }}
                    />
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 border-b py-2 last:border-0"
                        style={{ borderColor: 'var(--border-light)' }}
                      >
                        <div className="brand-gradient h-6 w-6 flex-shrink-0 rounded-full" />
                        <div>
                          <div
                            className="mb-1 h-1.5 w-16 rounded-full"
                            style={{ background: 'var(--border-light)' }}
                          />
                          <div
                            className="h-1.5 w-10 rounded-full"
                            style={{ background: 'var(--bg-subtle)' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2
              className="mb-4 text-4xl font-extrabold md:text-5xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Everything you need,{' '}
              <span className="brand-gradient-text">nothing you don&apos;t</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg" style={{ color: 'var(--text-secondary)' }}>
              Months of scaffolding work, done. Ship your core product instead of rebuilding auth
              and billing for the nth time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="hover:border-brand-secondary rounded-xl border p-6 transition-all hover:-translate-y-0.5"
                style={{
                  background: 'var(--bg-white)',
                  borderColor: 'var(--border-light)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="mb-4 text-3xl">{f.icon}</div>
                <h3 className="mb-2 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24" style={{ background: 'var(--bg-white)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2
              className="mb-4 text-4xl font-extrabold md:text-5xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Simple, <span className="brand-gradient-text">transparent pricing</span>
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              Start free. Scale as you grow. No surprises.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-3xl border p-8 ${plan.highlighted ? 'ring-2' : ''}`}
                style={{
                  background: plan.highlighted ? 'var(--bg-main)' : 'var(--bg-white)',
                  borderColor: plan.highlighted ? 'var(--brand-primary)' : 'var(--border-light)',
                  ['--tw-ring-color' as string]: plan.highlighted
                    ? 'var(--brand-primary)'
                    : undefined,
                  boxShadow: plan.highlighted ? 'var(--shadow-brand)' : 'var(--shadow-card)',
                }}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="brand-gradient rounded-full px-3 py-1 text-xs font-bold text-white">
                      Most popular
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="mb-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {plan.name}
                  </h3>
                  <div className="mb-2 flex items-end gap-1">
                    <span
                      className="text-4xl font-extrabold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {plan.price}
                    </span>
                    <span className="mb-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                      /{plan.period}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {plan.description}
                  </p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2.5 text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="8" fill="var(--brand-primary)" opacity="0.1" />
                        <path
                          d="M5 8l2 2 4-4"
                          stroke="var(--brand-primary)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/auth/signin"
                  className={`w-full rounded-xl py-3 text-center text-sm font-semibold transition-all ${
                    plan.highlighted
                      ? 'brand-gradient text-white hover:opacity-90'
                      : 'hover:bg-bg-subtle border'
                  }`}
                  style={
                    !plan.highlighted
                      ? { borderColor: 'var(--border-default)', color: 'var(--text-primary)' }
                      : {}
                  }
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="rounded-4xl brand-gradient relative overflow-hidden p-12">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.3), transparent 60%), radial-gradient(circle at 70% 50%, rgba(255,255,255,0.2), transparent 60%)',
              }}
            />
            <div className="relative">
              <h2 className="mb-4 text-4xl font-extrabold text-white md:text-5xl">
                Ready to build your SaaS?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-white/80">
                Join hundreds of teams that chose riogentix to skip the plumbing and focus on what
                makes their product unique.
              </p>
              <Link
                href="/auth/signin"
                className="inline-block rounded-xl bg-white px-8 py-4 text-base font-semibold transition-opacity hover:opacity-90"
                style={{ color: 'var(--brand-primary)' }}
              >
                Start for free today →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t px-6 py-12"
        style={{ borderColor: 'var(--border-light)', background: 'var(--bg-white)' }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="brand-gradient h-6 w-6 rounded" />
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
              riogentix
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} riogentix. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {['Privacy', 'Terms', 'Status', 'Docs'].map((item) => (
              <a
                key={item}
                href="#"
                className="hover:text-brand-primary text-sm transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
