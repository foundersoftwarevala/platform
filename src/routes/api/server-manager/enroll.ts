import { createFileRoute } from '@tanstack/react-router';
import { bearerToken, userFromBearerToken } from '@/lib/auth/bearer-user.server';
import { parseEnrollmentInput, parseIdempotencyKey, sha256Hex } from '@/lib/server-manager/agent-contract';
import { readRequestText, RequestBodyTooLargeError } from '@/lib/server-manager/request-body.server';

function supabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
}

function publishableKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    ''
  ).trim();
}

export const Route = createFileRoute('/api/server-manager/enroll')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = supabaseUrl();
        const key = publishableKey();
        if (!url || !key) {
          console.error('[server-manager/enroll] Supabase server configuration is unavailable');
          return Response.json({ error: 'Server enrollment is unavailable' }, { status: 503 });
        }

        const token = bearerToken(request.headers.get('authorization'));
        if (!token || !(await userFromBearerToken(token))) {
          return Response.json({ error: 'Authentication required' }, { status: 401 });
        }
        if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
          return Response.json({ error: 'Content-Type must be application/json' }, { status: 415 });
        }

        let body: unknown;
        try {
          body = JSON.parse(await readRequestText(request, 4096));
        } catch (error) {
          if (error instanceof RequestBodyTooLargeError) {
            return Response.json({ error: 'Enrollment request is too large' }, { status: 413 });
          }
          return Response.json({ error: 'Invalid JSON request' }, { status: 400 });
        }
        const input = parseEnrollmentInput(body);
        if (!input) {
          return Response.json({ error: 'Enrollment fields are invalid' }, { status: 400 });
        }
        if (parseIdempotencyKey(request.headers.get('idempotency-key')) !== input.enrollmentKey) {
          return Response.json({ error: 'Idempotency-Key must match the enrollment key' }, { status: 400 });
        }

        try {
          const response = await fetch(`${url}/rest/v1/rpc/server_agent_enroll`, {
            method: 'POST',
            headers: {
              apikey: key,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              p_server_name: input.serverName,
              p_os: input.os,
              p_provider: input.provider,
              p_region: input.region,
              p_enrollment_key: input.enrollmentKey,
              p_token_hash: await sha256Hex(input.agentToken),
            }),
          });

          if (!response.ok) {
            let code: string | null = null;
            try {
              const error = (await response.json()) as { code?: unknown };
              code = typeof error.code === 'string' ? error.code : null;
            } catch {
              code = null;
            }
            if (code === '23505') {
              return Response.json({ error: 'This enrollment request was already used with different credentials' }, { status: 409 });
            }
            if (code === '22023') {
              return Response.json({ error: 'Enrollment fields are invalid' }, { status: 400 });
            }
            if (code === '42501') {
              return Response.json({ error: 'Enrollment is not authorized' }, { status: 403 });
            }
            console.error('[server-manager/enroll] database request failed', { status: response.status, code });
            return Response.json({ error: 'Enrollment could not be completed' }, { status: 503 });
          }

          const result = (await response.json()) as {
            server_id?: unknown;
            agent_id?: unknown;
            status?: unknown;
          };
          if (
            typeof result.server_id !== 'string' ||
            typeof result.agent_id !== 'string' ||
            typeof result.status !== 'string'
          ) {
            console.error('[server-manager/enroll] database returned an invalid enrollment response');
            return Response.json({ error: 'Enrollment could not be completed' }, { status: 502 });
          }

          return Response.json({
            server_id: result.server_id,
            agent_id: result.agent_id,
            status: result.status,
            agent_token: input.agentToken,
          });
        } catch (error) {
          console.error('[server-manager/enroll] request failed', error);
          return Response.json({ error: 'Enrollment could not be completed' }, { status: 503 });
        }
      },
    },
  },
});
