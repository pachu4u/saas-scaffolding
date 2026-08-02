import { auth } from '@platform/auth';
import { env } from '@platform/config';
import type { NextRequest } from 'next/server';
import type { Notification } from 'pg';
import { Client } from 'pg';

import { getTenantFromRequest } from '@/lib/server-tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEEPALIVE_INTERVAL_MS = 25_000;

interface UsageNotifyPayload {
  tenantId?: string;
  at?: string;
  totals?: Record<string, number>;
  events?: { kind: string; quantity: number; occurredAt: string }[];
}

/**
 * GET /api/usage/stream
 *
 * Server-Sent Events stream of realtime usage events for the caller's
 * tenant. Authenticates exactly like GET /api/usage (session + tenant
 * membership via getTenantFromRequest), then LISTENs on the Postgres
 * `usage_events` channel (notified by POST /api/internal/usage-events) and
 * forwards notifications for this tenant as SSE `data:` frames.
 *
 * A dedicated pg Client is used (Prisma can't LISTEN); it is released when
 * the client disconnects. A keep-alive comment is sent every ~25s so
 * proxies don't idle-close the connection.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const tenantCtx = await getTenantFromRequest(req);
  if (!tenantCtx) return new Response('Tenant not found', { status: 404 });

  const tenantId = tenantCtx.tenantId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const client = new Client({
        connectionString: env.DATABASE_URL_MIGRATOR ?? env.DATABASE_URL,
      });

      let closed = false;
      const keepAlive = setInterval(() => {
        send(`: keep-alive ${new Date().toISOString()}\n\n`);
      }, KEEPALIVE_INTERVAL_MS);

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream already closed by the runtime.
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        client.removeAllListeners('notification');
        client.end().catch(() => undefined);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      req.signal.addEventListener('abort', cleanup, { once: true });

      client.on('notification', (msg: Notification) => {
        if (msg.channel !== 'usage_events' || !msg.payload) return;
        let parsed: UsageNotifyPayload;
        try {
          parsed = JSON.parse(msg.payload) as UsageNotifyPayload;
        } catch {
          return;
        }
        if (parsed.tenantId !== tenantId) return;
        send(`data: ${JSON.stringify(parsed)}\n\n`);
      });

      client.on('error', () => {
        // Surface as a comment so the browser EventSource fires its error
        // handler and reconnects, then tear down this connection.
        send(`: stream error\n\n`);
        cleanup();
      });

      client
        .connect()
        .then(() => client.query('LISTEN usage_events'))
        .then(() => {
          send(`: connected\n\n`);
        })
        .catch(() => {
          cleanup();
        });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
