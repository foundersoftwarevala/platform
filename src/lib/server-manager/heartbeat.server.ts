import { bearerToken } from "@/lib/auth/bearer-user.server";
import { isAgentHeartbeat, parseIdempotencyKey, sha256Hex } from "./agent-contract";
import { readRequestText, RequestBodyTooLargeError } from "./request-body.server";

function supabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
}

export async function handleAgentHeartbeat(request: Request): Promise<Response> {
  const url = supabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceKey) {
    console.error("[server-manager/heartbeat] server database configuration is unavailable");
    return Response.json({ error: "Heartbeat ingestion is unavailable" }, { status: 503 });
  }
  if (
    request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !==
    "application/json"
  ) {
    return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  const token = bearerToken(request.headers.get("authorization"));
  if (!token || !/^sv_agent_[0-9a-f]{64}$/.test(token)) {
    return Response.json({ error: "Agent authentication required" }, { status: 401 });
  }
  const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
  if (!idempotencyKey) {
    return Response.json({ error: "A UUID Idempotency-Key is required" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await readRequestText(request, 16_384));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Heartbeat payload is too large" }, { status: 413 });
    }
    return Response.json({ error: "Invalid JSON request" }, { status: 400 });
  }
  if (!isAgentHeartbeat(payload)) {
    return Response.json({ error: "Heartbeat fields are invalid" }, { status: 400 });
  }

  try {
    const response = await fetch(`${url}/rest/v1/rpc/server_agent_receive_heartbeat`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_token_hash: await sha256Hex(token),
        p_idempotency_key: idempotencyKey,
        p_payload: payload,
      }),
    });

    if (!response.ok) {
      let code: string | null = null;
      try {
        const error = (await response.json()) as { code?: unknown };
        code = typeof error.code === "string" ? error.code : null;
      } catch {
        code = null;
      }
      if (code === "22023") {
        return Response.json(
          { error: "Heartbeat values are invalid or outside the accepted window" },
          { status: 400 },
        );
      }
      console.error("[server-manager/heartbeat] database request failed", {
        status: response.status,
        code,
      });
      return Response.json({ error: "Heartbeat could not be recorded" }, { status: 503 });
    }

    const result = (await response.json()) as {
      accepted?: unknown;
      duplicate?: unknown;
      rate_limited?: unknown;
      suspended?: unknown;
      agent_id?: unknown;
      recorded_at?: unknown;
    };
    if (result.rate_limited === true) {
      return Response.json(
        { error: "Heartbeat rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "5" } },
      );
    }
    if (result.suspended === true) {
      return Response.json(
        { error: "Server monitoring is suspended for this subscription" },
        { status: 403 },
      );
    }
    if (result.accepted !== true) {
      return Response.json({ error: "Agent token is invalid or revoked" }, { status: 401 });
    }
    return Response.json({
      accepted: true,
      duplicate: result.duplicate === true,
      agent_id: typeof result.agent_id === "string" ? result.agent_id : null,
      recorded_at: typeof result.recorded_at === "string" ? result.recorded_at : null,
    });
  } catch (error) {
    console.error("[server-manager/heartbeat] request failed", error);
    return Response.json({ error: "Heartbeat could not be recorded" }, { status: 503 });
  }
}
