import { env } from '@platform/config';
import { getPlatformSecrets } from '@platform/vault';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

interface EmailConfig {
  from: string;
  apiKey: string | null;
  smtp: { host: string; port: number; username: string; password: string } | null;
}

let emailConfig: EmailConfig | null = null;

/**
 * Resolves email credentials from Vault (platform/email), falling back to
 * env vars when Vault is unreachable or unconfigured. SMTP (e.g. STACKIT
 * MailOut -- a purpose-built transactional relay with managed SPF/DKIM/DMARC
 * and bounce handling) takes priority over Resend when configured; Resend
 * stays supported as a fallback rather than being ripped out.
 */
async function getEmailConfig(): Promise<EmailConfig> {
  if (emailConfig) return emailConfig;

  let vaultConfig: {
    api_key?: string;
    from_email: string;
    smtp_host?: string;
    smtp_port?: string;
    smtp_username?: string;
    smtp_password?: string;
  } | null = null;
  try {
    vaultConfig = await getPlatformSecrets().getEmailConfig();
  } catch (err) {
    console.warn(
      '[notifications] Vault lookup for platform/email failed, falling back to env:',
      err,
    );
  }

  const smtpHost = vaultConfig?.smtp_host ?? env.SMTP_HOST ?? null;
  const smtpUsername = vaultConfig?.smtp_username ?? env.SMTP_USERNAME ?? null;
  const smtpPassword = vaultConfig?.smtp_password ?? env.SMTP_PASSWORD ?? null;
  const smtpPort = Number(vaultConfig?.smtp_port) || env.SMTP_PORT || 587;

  emailConfig = {
    from: vaultConfig?.from_email ?? env.EMAIL_FROM ?? 'noreply@platform.test',
    apiKey: vaultConfig?.api_key ?? env.RESEND_API_KEY ?? null,
    smtp:
      smtpHost && smtpUsername && smtpPassword
        ? { host: smtpHost, port: smtpPort, username: smtpUsername, password: smtpPassword }
        : null,
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
 * Send a transactional email. Prefers SMTP (e.g. STACKIT MailOut) over
 * Resend when both are configured -- see getEmailConfig. Falls back to
 * console.log in development, or when neither provider is configured.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { apiKey, from, smtp } = await getEmailConfig();

  if ((!smtp && !apiKey) || env.NODE_ENV === 'development') {
    console.log('[notifications] sendEmail:', JSON.stringify({ from, ...payload }, null, 2));
    return;
  }

  const html = renderTemplate(payload.templateId, payload.data);

  if (smtp) {
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      // STACKIT MailOut's documented setup uses STARTTLS, not implicit TLS
      // (submission port 587, upgraded in-band) -- secure: true would try
      // an implicit-TLS handshake on connect and fail against it.
      secure: smtp.port === 465,
      auth: { user: smtp.username, pass: smtp.password },
    });
    await transport.sendMail({ from, to: payload.to, subject: payload.subject, html });
    return;
  }

  const resend = new Resend(apiKey!);
  const { error } = await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    html,
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
