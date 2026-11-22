import { generateKeyPairSync, createVerify } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { FlexClient, signKeyFlowAssertion } from './stackit-flex.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = {
  credentials: {
    kid: 'kid-1',
    iss: 'sa@sa.stackit.cloud',
    sub: 'sub-1',
    aud: 'https://stackit-service-account-prod.apps.01.cf.eu01.stackit.cloud',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    tokenEndpoint: 'https://token.example/token',
  },
};

describe('signKeyFlowAssertion', () => {
  it('produces an RS512 JWT with the key claims that verifies against the public key', () => {
    const jwt = signKeyFlowAssertion(key, 1_000);
    const [h, p, sig] = jwt.split('.') as [string, string, string];
    const header = JSON.parse(Buffer.from(h, 'base64url').toString()) as Record<string, unknown>;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString()) as Record<string, unknown>;
    expect(header).toMatchObject({ alg: 'RS512', kid: 'kid-1' });
    expect(payload).toMatchObject({
      iss: key.credentials.iss,
      sub: 'sub-1',
      iat: 1_000,
      exp: 1_600,
    });
    const v = createVerify('RSA-SHA512');
    v.update(`${h}.${p}`);
    expect(v.verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
  });
});

describe('FlexClient', () => {
  function fakeFetch(users: { id: number; username: string }[]) {
    const calls: { method: string; url: string; body: string | undefined }[] = [];
    const impl = ((input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body as string | undefined });
      const json = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      if (url === key.credentials.tokenEndpoint)
        return Promise.resolve(json({ access_token: 'tok', expires_in: 600 }));
      if (method === 'GET') return Promise.resolve(json({ items: users }));
      if (method === 'POST' && url.endsWith('/reset'))
        return Promise.resolve(json({ item: { password: 'new-pw' } }));
      if (method === 'POST')
        return Promise.resolve(json({ item: { id: 42, password: 'fresh-pw' } }));
      if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 404 }));
      return Promise.resolve(json({}, 500));
    }) as typeof fetch;
    return { impl, calls };
  }

  const opts = (impl: typeof fetch) => ({
    serviceAccountKey: JSON.stringify(key),
    projectId: 'proj',
    region: 'eu01',
    instanceId: 'inst',
    fetchImpl: impl,
  });

  it('creates a login-only user when none exists', async () => {
    const { impl, calls } = fakeFetch([]);
    const creds = await new FlexClient(opts(impl)).ensureUser('riogentix_acme');
    expect(creds).toEqual({ id: '42', username: 'riogentix_acme', password: 'fresh-pw' });
    const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/users'));
    expect(create?.url).toBe(
      'https://postgres-flex-service.api.stackit.cloud/v2/projects/proj/regions/eu01/instances/inst/users',
    );
    expect(JSON.parse(create?.body ?? '{}')).toEqual({
      username: 'riogentix_acme',
      roles: ['login'],
    });
  });

  it('resets the password when the user already exists', async () => {
    const { impl, calls } = fakeFetch([{ id: 7, username: 'riogentix_acme' }]);
    const creds = await new FlexClient(opts(impl)).ensureUser('riogentix_acme');
    expect(creds.password).toBe('new-pw');
    expect(calls.some((c) => c.url.endsWith('/users/7/reset'))).toBe(true);
  });

  it('treats deleting a missing user as done', async () => {
    const { impl } = fakeFetch([]);
    await expect(new FlexClient(opts(impl)).deleteUser('9')).resolves.toBeUndefined();
  });

  it('does not leak response bodies in errors', async () => {
    const impl = ((input: string | URL) =>
      Promise.resolve(
        String(input).endsWith('/token')
          ? new Response(JSON.stringify({ access_token: 't' }))
          : new Response('{"password":"secret"}', { status: 500 }),
      )) as typeof fetch;
    await expect(new FlexClient(opts(impl)).createUser('x')).rejects.toThrow(/→ 500$/);
  });
});
