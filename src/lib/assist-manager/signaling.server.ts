import { createServer, type IncomingMessage } from "node:http";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { WebSocket, WebSocketServer } from "ws";
import type { Sql } from "postgres";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const SIGNAL_TYPES = new Set(["offer", "answer", "ice", "control", "control_ack"]);
const MAX_SIGNAL_BYTES = 64 * 1024;

type ParticipantRole = "target" | "assistant" | "manager";
type SignalPeer = { socket: WebSocket; userId: string; role: ParticipantRole };
type SignalMessage = { type: string; payload?: unknown };

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured to run Assist signaling.`);
  return value;
}

function databaseUrl(): string {
  const value = requiredEnvironment("VPS_DATABASE_URL");
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("VPS_DATABASE_URL must use PostgreSQL.");
  }
  url.pathname = "/sv_platform";
  return url.toString();
}

function originAllowed(request: IncomingMessage, allowed: Set<string>): boolean {
  const origin = request.headers.origin;
  return typeof origin === "string" && allowed.has(origin);
}

function ticketFromProtocols(header: string | string[] | undefined): string | null {
  if (typeof header !== "string") return null;
  const protocol = header.split(",").map((value) => value.trim());
  if (!protocol.includes("assist.v1")) return null;
  const ticket = protocol.find((value) => value.startsWith("ticket."));
  const token = ticket?.slice("ticket.".length) ?? "";
  return TOKEN.test(token) ? token : null;
}

function validSignalMessage(value: unknown): value is SignalMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as { type?: unknown; payload?: unknown };
  if (typeof message.type !== "string" || !SIGNAL_TYPES.has(message.type)) return false;
  if (message.type === "offer" || message.type === "answer") {
    const description = message.payload as { type?: unknown; sdp?: unknown } | null;
    return Boolean(
      description &&
        description.type === message.type &&
        typeof description.sdp === "string" &&
        description.sdp.length <= 60_000,
    );
  }
  if (message.type === "ice") {
    const candidate = message.payload as { candidate?: unknown } | null;
    return Boolean(candidate && typeof candidate.candidate === "string" && candidate.candidate.length <= 4096);
  }
  if (message.type === "control" || message.type === "control_ack") {
    return Boolean(message.payload && typeof message.payload === "object" && !Array.isArray(message.payload));
  }
  return false;
}

async function consumeTicket(sql: Sql, ticket: string, sessionId: string) {
  const tokenHash = createHash("sha256").update(ticket).digest("hex");
  return sql.begin(async (tx) => {
    await tx`set local role service_role`;
    const tickets = await tx<{ user_id: string; session_id: string }[]>`
      update public.assist_signal_tickets
         set consumed_at = now()
       where token_hash = ${tokenHash}
         and session_id = ${sessionId}::uuid
         and consumed_at is null
         and expires_at > now()
       returning user_id, session_id
    `;
    const row = tickets[0];
    if (!row) return null;
    const sessions = await tx<{
      status: string;
      consent_hash: string | null;
      consent_granted: boolean;
      target_user_id: string | null;
      operator_user_id: string | null;
      agent_user_id: string | null;
      control_consent_at: Date | string | null;
      control_consent_by: string | null;
      consent_by: string | null;
      consent_revoked_at: Date | string | null;
      approval_valid: boolean;
    }[]>`
      select s.status, s.consent_hash, s.consent_granted, s.target_user_id,
             s.operator_user_id, a.user_id as agent_user_id, s.control_consent_at,
             s.control_consent_by, s.consent_by, s.consent_revoked_at,
             exists (
               select 1 from public.assist_approvals ap
                where ap.session_id = s.id and ap.status = 'approved'
                  and ap.decided_by = s.operator_user_id and ap.expires_at > now()
             ) as approval_valid
        from public.assist_sessions s
        left join public.assist_agents a on a.id = s.agent_id
       where s.id = ${row.session_id}::uuid
    `;
    const session = sessions[0];
    if (
      !session ||
      !["active", "paused"].includes(session.status) ||
      !session.consent_hash ||
      !session.consent_granted ||
      session.consent_by !== session.target_user_id ||
      session.consent_revoked_at ||
      !session.approval_valid
    ) {
      return null;
    }
    const role: ParticipantRole | null =
      row.user_id === session.target_user_id
        ? "target"
        : row.user_id === session.agent_user_id
          ? "assistant"
          : row.user_id === session.operator_user_id
            ? "manager"
            : null;
    if (!role) return null;
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      role,
      controlAllowed:
        Boolean(session.control_consent_at) && session.control_consent_by === session.target_user_id,
    };
  });
}

async function isSessionLive(sql: Sql, sessionId: string): Promise<{ live: boolean; controlAllowed: boolean }> {
  return sql.begin(async (tx) => {
    await tx`set local role service_role`;
    const rows = await tx<{ live: boolean; control_allowed: boolean }[]>`
      select s.status in ('active', 'paused')
          and s.consent_granted and s.consent_hash is not null
          and s.consent_by = s.target_user_id
          and s.consent_revoked_at is null
          and exists (
            select 1 from public.assist_approvals a
             where a.session_id = s.id and a.status = 'approved'
               and a.decided_by = s.operator_user_id
               and a.expires_at > now()
          ) as live,
          s.control_consent_at is not null
            and s.control_consent_by = s.target_user_id as control_allowed
        from public.assist_sessions s
       where s.id = ${sessionId}::uuid
    `;
    return { live: rows[0]?.live ?? false, controlAllowed: rows[0]?.control_allowed ?? false };
  });
}

async function logConnection(
  sql: Sql,
  peer: SignalPeer,
  sessionId: string,
  action: "signaling.connected" | "signaling.disconnected",
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`set local role service_role`;
    const details = JSON.stringify({ participant_role: peer.role });
    await tx`
      insert into public.assist_logs (session_id, actor_user_id, action, details)
      values (${sessionId}::uuid, ${peer.userId}::uuid, ${action}, ${details}::jsonb)
    `;
    await tx`
      insert into public.assist_audit_logs (
        session_id, actor, actor_user_id, actor_role, action, target,
        old_state, new_state, severity, result
      ) values (
        ${sessionId}::uuid, ${peer.userId}, ${peer.userId}::uuid, ${peer.role},
        ${action}, 'webrtc_signaling', null, ${details}::jsonb, 'info', 'success'
      )
    `;
    await tx`
      insert into public.audit_logs (
        actor_id, actor, action, entity_type, entity_id, severity, metadata
      ) values (
        ${peer.userId}::uuid, ${peer.userId}, ${`assist.${action}`},
        'assist_sessions', ${sessionId}, 'info', ${details}::jsonb
      )
    `;
  });
}

export async function startAssistSignalingServer(): Promise<void> {
  const allowedOrigins = new Set(
    requiredEnvironment("ASSIST_SIGNALING_ORIGINS")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  if (!allowedOrigins.size) throw new Error("ASSIST_SIGNALING_ORIGINS must include the dashboard origin.");

  const sql = postgres(databaseUrl(), {
    max: 8,
    idle_timeout: 30,
    connect_timeout: 10,
    connection: { application_name: "sv-assist-signaling", statement_timeout: 10_000 },
  });
  const server = createServer((request, response) => {
    if (request.url === "/healthz") {
      response.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
      response.end("ok");
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_SIGNAL_BYTES,
    perMessageDeflate: false,
    handleProtocols: (protocols) => (protocols.has("assist.v1") ? "assist.v1" : false),
  });
  const rooms = new Map<string, Set<SignalPeer>>();

  server.on("upgrade", (request, socket, head) => {
    void (async () => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const match = /^\/assist\/([0-9a-f-]{36})$/i.exec(pathname);
      const ticket = ticketFromProtocols(request.headers["sec-websocket-protocol"]);
      if (!originAllowed(request, allowedOrigins) || !match || !UUID.test(match[1]) || !ticket) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      const grant = await consumeTicket(sql, ticket, match[1]);
      if (!grant) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        const peer: SignalPeer = {
          socket: websocket,
          userId: grant.userId,
          role: grant.role,
        };
        const room = rooms.get(grant.sessionId) ?? new Set<SignalPeer>();
        if (
          (peer.role === "target" && [...room].some((other) => other.role === "target")) ||
          (peer.role === "assistant" && [...room].some((other) => other.role === "assistant"))
        ) {
          websocket.close(1008, "This session participant is already connected.");
          return;
        }
        room.add(peer);
        rooms.set(grant.sessionId, room);
        websocket.send(JSON.stringify({ type: "connected", role: peer.role }));
        void logConnection(sql, peer, grant.sessionId, "signaling.connected").catch((error: unknown) =>
          console.error("[assist-signaling] failed to audit connection", error),
        );
        websocket.on("message", (data, isBinary) => {
          void (async () => {
            const payload = Array.isArray(data)
              ? Buffer.concat(data).toString("utf8")
              : Buffer.isBuffer(data)
                ? data.toString("utf8")
                : Buffer.from(data).toString("utf8");
            if (isBinary || Buffer.byteLength(payload, "utf8") > MAX_SIGNAL_BYTES) {
              websocket.close(1003, "Only bounded JSON signaling messages are accepted.");
              return;
            }
            let message: unknown;
            try {
              message = JSON.parse(payload);
            } catch {
              websocket.close(1007, "Malformed signaling message.");
              return;
            }
            if (!validSignalMessage(message)) {
              websocket.close(1008, "Unsupported signaling message.");
              return;
            }
            const state = await isSessionLive(sql, grant.sessionId);
            if (!state.live) {
              closeRoom(rooms, grant.sessionId, "Assist session is no longer approved and consented.");
              return;
            }
            if (message.type === "offer" && peer.role !== "target") {
              websocket.close(1008, "Only the target device may offer its captured stream.");
              return;
            }
            if (message.type === "answer" && peer.role === "target") {
              websocket.close(1008, "The target device cannot answer its own offer.");
              return;
            }
            if (message.type === "control" && (peer.role === "target" || !state.controlAllowed)) {
              websocket.close(1008, "Target consent for control is not active.");
              return;
            }
            const outgoing = JSON.stringify({ type: message.type, payload: message.payload });
            for (const other of room) {
              if (other !== peer && other.socket.readyState === WebSocket.OPEN) {
                other.socket.send(outgoing);
              }
            }
          })().catch((error: unknown) => {
            console.error("[assist-signaling] message processing failed", error);
            websocket.close(1011, "Signaling service error.");
          });
        });
        websocket.on("close", () => {
          room.delete(peer);
          if (!room.size) rooms.delete(grant.sessionId);
          void logConnection(sql, peer, grant.sessionId, "signaling.disconnected").catch((error: unknown) =>
            console.error("[assist-signaling] failed to audit disconnection", error),
          );
        });
      });
    })().catch((error: unknown) => {
      console.error("[assist-signaling] upgrade failed", error);
      if (!socket.destroyed) {
        socket.write("HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n");
        socket.destroy();
      }
    });
  });

  await sql.listen("assist_session_status", (payload) => {
    try {
      const event = JSON.parse(payload) as {
        session_id?: unknown;
        status?: unknown;
        control_allowed?: unknown;
      };
      if (typeof event.session_id !== "string") return;
      if (!["active", "paused"].includes(String(event.status))) {
        closeRoom(rooms, event.session_id, "Assist session was stopped.");
      } else if (event.control_allowed === false) {
        const room = rooms.get(event.session_id);
        for (const peer of room ?? []) {
          if (peer.socket.readyState === WebSocket.OPEN) {
            peer.socket.send(JSON.stringify({ type: "control", payload: { kind: "revoked" } }));
          }
        }
      }
    } catch (error) {
      console.error("[assist-signaling] invalid session status notification", error);
    }
  });

  const port = Number(process.env.ASSIST_SIGNALING_PORT ?? 3090);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("ASSIST_SIGNALING_PORT must be a valid TCP port.");
  }
  const host = process.env.ASSIST_SIGNALING_HOST ?? "127.0.0.1";
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  console.info(`[assist-signaling] listening on ${host}:${port}`);

  const close = () => {
    for (const peers of rooms.values()) {
      for (const peer of peers) peer.socket.close(1001, "Signaling server shutting down.");
    }
    server.close();
    void sql.end({ timeout: 5 }).catch((error: unknown) =>
      console.error("[assist-signaling] database shutdown failed", error),
    );
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

function closeRoom(rooms: Map<string, Set<SignalPeer>>, sessionId: string, reason: string): void {
  const room = rooms.get(sessionId);
  if (!room) return;
  rooms.delete(sessionId);
  for (const peer of room) peer.socket.close(1008, reason.slice(0, 120));
}
