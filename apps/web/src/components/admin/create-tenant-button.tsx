import Link from 'next/link';

// Tenant provisioning happens through the onboarding wizard (name, initial
// invites, branding, plan in one guided flow) rather than a bare form here,
// so there's a single tenant-creation path instead of two divergent ones.
export function CreateTenantButton() {
  return (
    <Link
      href="/onboarding"
      className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
    >
      + Create tenant
    </Link>
  );
}
