import { formatMoney, type PlanPrice } from '@/lib/plan-prices';

export interface PlanEntitlementRow {
  code: string;
  name: string;
  features: Record<string, unknown>;
  hasStripePrice: boolean;
  price: PlanPrice | undefined;
  priceError: string | undefined;
  tenantCount: number;
}

function limit(value: unknown): string {
  if (value === null) return 'Unlimited';
  if (typeof value === 'number') return value.toLocaleString();
  return '—';
}

function flag(value: unknown): string {
  return value === true ? 'Yes' : 'No';
}

function seats(features: Record<string, unknown>): unknown {
  const users = features.users as { maxCount?: unknown } | undefined;
  return users?.maxCount;
}

/**
 * The plans as stored in the `plans` table: these features are what this
 * platform enforces (seat limits on invite, SCIM, webhooks, custom domains).
 */
export function PlanEntitlementsTable({ rows }: { rows: PlanEntitlementRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
            <th className="px-4 py-3 font-medium text-zinc-600">Plan</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-600">Tenants</th>
            <th className="px-4 py-3 font-medium text-zinc-600">Stripe price</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-600">Seats</th>
            <th className="px-4 py-3 font-medium text-zinc-600">SCIM</th>
            <th className="px-4 py-3 font-medium text-zinc-600">Webhooks</th>
            <th className="px-4 py-3 font-medium text-zinc-600">Custom domain</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((p) => (
            <tr key={p.code}>
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-800">{p.name}</div>
                <div className="font-mono text-xs text-zinc-400">{p.code}</div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{p.tenantCount}</td>
              <td className="px-4 py-3 text-zinc-700">
                {p.price
                  ? `${formatMoney(p.price.monthly, p.price.currency)}/mo`
                  : p.priceError
                    ? `Linked, unreadable (${p.priceError})`
                    : p.hasStripePrice
                      ? 'Linked'
                      : p.code === 'free'
                        ? 'Free'
                        : 'Not set'}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {limit(seats(p.features))}
              </td>
              <td className="px-4 py-3 text-zinc-700">{flag(p.features.scim)}</td>
              <td className="px-4 py-3 text-zinc-700">{flag(p.features.webhooks)}</td>
              <td className="px-4 py-3 text-zinc-700">{flag(p.features.customDomain)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
