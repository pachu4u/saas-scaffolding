import { env } from '@platform/config';

/**
 * Provision (or re-provision) a tenant in the Riogentix instance.
 *
 * Idempotent on the Riogentix side — the /provision endpoint upserts the
 * tenant row, so it is safe to call again for retries from the admin console.
 * No-op when the integration isn't configured.
 */
export async function provisionRiogentixTenant(
  tenantId: string,
  plan: string,
  slug: string,
): Promise<void> {
  const url = env.RIOGENTIX_INTERNAL_URL;
  const sec = env.RIOGENTIX_INTERNAL_SECRET;

  if (!url || !sec) return; // non-fatal — Riogentix integration optional

  // Bounded timeout: if Riogentix is down/hung this must fail fast and mark the
  // tenant FAILED (retryable from the admin console) instead of hanging the whole
  // request past the proxy timeout with the tenant stuck IN_PROGRESS.
  const res = await fetch(`${url}/internal/tenant/${tenantId}/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': sec,
    },
    body: JSON.stringify({ plan, slug }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Riogentix provision failed (${String(res.status)}): ${text}`);
  }
}
