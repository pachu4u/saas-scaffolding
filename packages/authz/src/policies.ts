import type { AuthzContext } from './engine';

/**
 * ABAC: the resource must be owned by the calling user.
 * Pass the resource's userId field (nullable from DB).
 */
export function isOwnerPolicy(
  ctx: AuthzContext,
  resourceUserId: string | null | undefined,
): boolean {
  return resourceUserId === ctx.user.id;
}

/**
 * ABAC: the calling user must be the same as the target user.
 * Use for self-service operations (e.g. updating own profile).
 */
export function isSelfPolicy(ctx: AuthzContext, targetUserId: string): boolean {
  return targetUserId === ctx.user.id;
}
