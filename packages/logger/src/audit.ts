import { adminDb, Prisma } from '@platform/db';

import { scrubSecrets } from './index.js';

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
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      before: entry.before ? (scrubSecrets(entry.before) as Prisma.InputJsonValue) : Prisma.DbNull,
      after: entry.after ? (scrubSecrets(entry.after) as Prisma.InputJsonValue) : Prisma.DbNull,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
