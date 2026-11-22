import { describe, expect, it } from 'vitest';

import {
  assertValidSlug,
  tenantAccessStatements,
  tenantDatabaseUrl,
  tenantDbName,
  tenantDbUser,
  tenantOwnLoginUrl,
  urlUsername,
} from './database.js';

describe('slug validation', () => {
  it('accepts lowercase alphanumerics and hyphens', () => {
    expect(() => {
      assertValidSlug('acme-co-2');
    }).not.toThrow();
  });

  it.each([
    'Acme', // uppercase
    'a b', // whitespace
    'a;drop table', // injection attempt
    'a"b', // quote — would escape identifier quoting
    '', // empty
    'x'.repeat(41), // too long
  ])('rejects %j', (slug) => {
    expect(() => {
      assertValidSlug(slug);
    }).toThrow(/not a valid identifier/);
  });
});

describe('naming', () => {
  it('derives the database name with hyphens folded to underscores', () => {
    expect(tenantDbName('acme-co')).toBe('riogentix_acme_co');
  });
});

describe('tenantDatabaseUrl', () => {
  const adminUrl = 'postgresql://admin:root@pg.internal:5432/postgres?sslmode=require';

  it('builds the pod connection URL from the admin host and credentials, keeping query params', () => {
    const url = tenantDatabaseUrl(adminUrl, 'acme-co');
    expect(url).toBe('postgresql://admin:root@pg.internal:5432/riogentix_acme_co?sslmode=require');
  });

  it('prefers the pod-facing host override when provided', () => {
    const url = tenantDatabaseUrl(adminUrl, 'acme-co', 'pg-flex.private:5433');
    expect(url).toContain('@pg-flex.private:5433/');
  });

  it('preserves reserved characters in the admin credentials as already encoded in adminUrl', () => {
    const encoded = 'postgresql://admin:p%40ss%2Fw%3Ard@pg.internal:5432/postgres?sslmode=require';
    const url = tenantDatabaseUrl(encoded, 'acme-co');
    expect(url).toContain(':p%40ss%2Fw%3Ard@');
  });
});

describe('per-tenant login helpers', () => {
  const adminUrl = 'postgresql://admin:root@pg.internal:5432/postgres?sslmode=require';

  it('uses the database name as the login name', () => {
    expect(tenantDbUser('acme-co')).toBe('riogentix_acme_co');
  });

  it('builds a URL with the tenant login, encoding the password, keeping params', () => {
    const url = tenantOwnLoginUrl(adminUrl, 'acme-co', {
      username: 'riogentix_acme_co',
      password: 'p@ss/w:rd',
    });
    expect(url).toBe(
      'postgresql://riogentix_acme_co:p%40ss%2Fw%3Ard@pg.internal:5432/riogentix_acme_co?sslmode=require',
    );
    expect(urlUsername(url)).toBe('riogentix_acme_co');
  });

  it('never leaves the admin credentials in the tenant URL', () => {
    const url = tenantOwnLoginUrl(adminUrl, 'acme-co', { username: 'u', password: 'p' }, 'h:1');
    expect(url).not.toContain('admin');
    expect(url).not.toContain('root');
    expect(url).toContain('@h:1/');
  });

  it('revokes PUBLIC connect and grants only the tenant login and monitoring', () => {
    const sql = tenantAccessStatements('riogentix_acme_co', 'riogentix_acme_co');
    expect(sql[0]).toBe('REVOKE CONNECT, TEMPORARY ON DATABASE "riogentix_acme_co" FROM PUBLIC');
    expect(sql).toContain(
      'GRANT CONNECT, TEMPORARY ON DATABASE "riogentix_acme_co" TO "riogentix_acme_co"',
    );
    expect(sql).toContain('GRANT CONNECT ON DATABASE "riogentix_acme_co" TO "monitoring"');
    expect(sql).toContain('GRANT USAGE, CREATE ON SCHEMA public TO "riogentix_acme_co"');
    expect(sql.some((s) => s.includes('saas_platform'))).toBe(false);
  });
});
