import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScimClient, ScimRequestError } from './client';
import { SCIM_SCHEMAS } from './types';

const BASE = 'https://app.internal/scim/v2';
const TOKEN = 'test-token';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/scim+json' },
  });
}

function listResponse(resources: unknown[]): Response {
  return jsonResponse({
    schemas: [SCIM_SCHEMAS.LIST],
    totalResults: resources.length,
    itemsPerPage: resources.length,
    startIndex: 1,
    Resources: resources,
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ScimClient', () => {
  it('sends bearer auth and SCIM content type', async () => {
    fetchMock.mockResolvedValue(listResponse([]));
    const client = new ScimClient(BASE, TOKEN);

    await client.findUserByUserName('alice@example.com');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`${BASE}/Users?filter=`);
    expect(url).toContain(encodeURIComponent('userName eq "alice@example.com"'));
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/scim+json');
  });

  it('strips trailing slashes from the base URL', async () => {
    fetchMock.mockResolvedValue(listResponse([]));
    const client = new ScimClient(`${BASE}///`, TOKEN);

    await client.listGroups();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`${BASE}/Groups?count=500`);
  });

  it('returns null when no user matches', async () => {
    fetchMock.mockResolvedValue(listResponse([]));
    const client = new ScimClient(BASE, TOKEN);

    expect(await client.findUserByUserName('nobody@example.com')).toBeNull();
  });

  it('falls back to lookup when create returns 409', async () => {
    const existing = { id: 'u-1', userName: 'alice@example.com', active: true };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'uniqueness' }, 409))
      .mockResolvedValueOnce(listResponse([existing]));
    const client = new ScimClient(BASE, TOKEN);

    const user = await client.createUser({
      schemas: [SCIM_SCHEMAS.USER],
      userName: 'alice@example.com',
      active: true,
    });

    expect(user.id).toBe('u-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws ScimRequestError with status and detail on failure', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const client = new ScimClient(BASE, TOKEN);

    await expect(client.listGroups()).rejects.toMatchObject({
      name: 'ScimRequestError',
      status: 500,
    });
  });

  it('treats deleting an already-gone group as success', async () => {
    fetchMock.mockResolvedValue(new Response('not found', { status: 404 }));
    const client = new ScimClient(BASE, TOKEN);

    await expect(client.deleteGroup('g-1')).resolves.toBeUndefined();
  });

  it('propagates non-404 errors from group deletion', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 403 }));
    const client = new ScimClient(BASE, TOKEN);

    await expect(client.deleteGroup('g-1')).rejects.toBeInstanceOf(ScimRequestError);
  });

  it('handles 204 responses without parsing a body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ScimClient(BASE, TOKEN);

    await expect(client.deleteGroup('g-1')).resolves.toBeUndefined();
  });
});
