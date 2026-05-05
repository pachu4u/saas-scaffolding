// SCIM 2.0 core types (RFC 7643)

export const SCIM_SCHEMAS = {
  USER: 'urn:ietf:params:scim:schemas:core:2.0:User',
  GROUP: 'urn:ietf:params:scim:schemas:core:2.0:Group',
  LIST: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
  ERROR: 'urn:ietf:params:scim:api:messages:2.0:Error',
  PATCH: 'urn:ietf:params:scim:api:messages:2.0:PatchOp',
} as const;

export interface ScimUser {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name?: { formatted?: string; givenName?: string; familyName?: string };
  emails?: Array<{ value: string; primary?: boolean; type?: string }>;
  active: boolean;
  meta: { resourceType: 'User'; created: string; lastModified: string; location: string };
}

export interface ScimGroup {
  schemas: string[];
  id: string;
  externalId?: string;
  displayName: string;
  members?: Array<{ value: string; display?: string }>;
  meta: { resourceType: 'Group'; created: string; lastModified: string; location: string };
}

export interface ScimListResponse<T> {
  schemas: string[];
  totalResults: number;
  itemsPerPage: number;
  startIndex: number;
  Resources: T[];
}

export interface ScimError {
  schemas: string[];
  status: number;
  detail: string;
  scimType?: string;
}

export interface ScimPatchOp {
  schemas: string[];
  Operations: Array<{
    op: 'add' | 'remove' | 'replace';
    path?: string;
    value?: unknown;
  }>;
}
