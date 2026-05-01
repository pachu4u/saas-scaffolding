import { adminDb } from '@platform/db';

import { scrubSecrets } from './index';

export interface AuditEntry {
  tenantId: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: object;
  after?: object;
  ip?: string;
  userAgent?: string;
}

/**
 * Append an entry to the audit_log table.
 * Secrets in before/after are scrubbed before insert.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  await adminDb.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      before: entry.before ? (scrubSecrets(entry.before) as object) : undefined,
      after: entry.after ? (scrubSecrets(entry.after) as object) : undefined,
      ip: entry.ip,
      userAgent: entry.userAgent,
    },
  });
}
