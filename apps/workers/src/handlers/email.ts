import type { Job } from 'bullmq';

import { logger } from '@platform/logger';
import type { EmailJob } from '@platform/jobs';

export async function handleEmail(job: Job<EmailJob>): Promise<void> {
  const { to, subject, templateId, tenantId } = job.data;
  logger.info({ jobId: job.id, to, subject, templateId, tenantId }, 'Sending email');
  // @platform/notifications handles actual delivery
  // Dynamically imported to avoid circular dep if notifications imports jobs
  const { sendEmail } = await import('@platform/notifications');
  await sendEmail(job.data);
}
