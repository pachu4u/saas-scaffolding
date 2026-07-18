// Client-safe barrel only — no `@platform/db` or `next/server` deps, so
// non-Next.js consumers (e.g. the workers app) can build without pulling in
// server-only route-handler code. Those pieces live in `./server` instead,
// consumed by the Next.js SCIM route handlers in apps/web.
export { ScimClient, ScimRequestError, type ScimUserWrite, type ScimGroupWrite } from './client';
export {
  SCIM_SCHEMAS,
  SCIM_ROLE_EXTENSION,
  type ScimUser,
  type ScimGroup,
  type ScimListResponse,
  type ScimError,
  type ScimPatchOp,
} from './types';
