import { describe, expect, it } from 'vitest';

import { assertValidSlug, tenantDatabaseUrl, tenantDbName } from './database.js';

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
