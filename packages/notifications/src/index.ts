import { env } from '@platform/config';
import { getPlatformSecrets } from '@platform/vault';
import { Resend } from 'resend';

let emailConfig: { apiKey: string | null; from: string } | null = null;

/**
 * Resolves Resend credentials from Vault (platform/email), falling back to
 * RESEND_API_KEY/EMAIL_FROM env vars when Vault is unreachable or unconfigured.
 */
async function getEmailConfig(): Promise<{ apiKey: string | null; from: string }> {
  if (emailConfig) return emailConfig;

  let vaultConfig: { api_key: string; from_email: string } | null = null;
  try {
    vaultConfig = await getPlatformSecrets().getEmailConfig();
  } catch (err) {
    console.warn(
      '[notifications] Vault lookup for platform/email failed, falling back to env:',
      err,
    );
  }

  emailConfig = {
    apiKey: vaultConfig?.api_key ?? env.RESEND_API_KEY ?? null,
    from: vaultConfig?.from_email ?? env.EMAIL_FROM ?? 'noreply@platform.test',
  };
  return emailConfig;
}

export interface EmailPayload {
  to: string;
  subject: string;
  templateId: string;
  data: Record<string, unknown>;
  tenantId: string;
}

/**
 * Send a transactional email.
 * Falls back to console.log in development when no Resend API key is available.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { apiKey, from } = await getEmailConfig();
  const resend = apiKey ? new Resend(apiKey) : null;

  if (!resend || env.NODE_ENV === 'development') {
    console.log('[notifications] sendEmail:', JSON.stringify({ from, ...payload }, null, 2));
    return;
  }

  const { error } = await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    html: renderTemplate(payload.templateId, payload.data),
  });

  if (error) {
    throw new Error(`[notifications] Resend send failed: ${error.name} — ${error.message}`);
  }
}

function renderTemplate(templateId: string, data: Record<string, unknown>): string {
  // Minimal template engine — replace {{ key }} tokens
  const templates: Record<string, string> = {
    'invite-user': `<p>You've been invited to join <strong>{{ tenantName }}</strong>.</p>
      <p><a href="{{ inviteUrl }}">Accept Invitation</a></p>`,
    'plan-changed': `<p>Your plan has been changed to <strong>{{ newPlan }}</strong>.</p>`,
  };

  const template = templates[templateId] ?? `<p>Notification: ${templateId}</p>`;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = data[key];
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  });
}
