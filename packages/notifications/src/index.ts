import { Resend } from 'resend';

import { env } from '@platform/config';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface EmailPayload {
  to: string;
  subject: string;
  templateId: string;
  data: Record<string, unknown>;
  tenantId: string;
}

/**
 * Send a transactional email.
 * Falls back to console.log in development when RESEND_API_KEY is not set.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const from = env.EMAIL_FROM ?? 'noreply@platform.test';

  if (!resend || env.NODE_ENV === 'development') {
    console.log('[notifications] sendEmail:', JSON.stringify({ from, ...payload }, null, 2));
    return;
  }

  await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    html: renderTemplate(payload.templateId, payload.data),
  });
}

function renderTemplate(templateId: string, data: Record<string, unknown>): string {
  // Minimal template engine — replace {{ key }} tokens
  const templates: Record<string, string> = {
    'invite-user': `<p>You've been invited to join <strong>{{ tenantName }}</strong>.</p>
      <p><a href="{{ inviteUrl }}">Accept Invitation</a></p>`,
    'plan-changed': `<p>Your plan has been changed to <strong>{{ newPlan }}</strong>.</p>`,
  };

  const template = templates[templateId] ?? `<p>Notification: ${templateId}</p>`;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    String(data[key] ?? ''),
  );
}
