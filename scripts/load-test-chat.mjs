import { setTimeout as sleep } from "node:timers/promises";

const MAX_CONNECTIONS = 1_000;
const ACK = "I_OWN_THIS_ENDPOINT_AND_CONVERSATION";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function boundedInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

function realtimeUrl() {
  const url = new URL(required("CHAT_LOAD_TEST_WS_URL"));
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !["ws:", "wss:"].includes(url.protocol) ||
    (url.protocol === "ws:" && !loopback) ||
    !url.searchParams.has("apikey")
  ) {
    throw new Error("Use a WebSocket Realtime URL with an apikey; non-loopback targets must use WSS.");
  }
  if (!loopback && process.env.CHAT_LOAD_TEST_ALLOW_REMOTE !== "1") {
    throw new Error("Remote load tests require CHAT_LOAD_TEST_ALLOW_REMOTE=1.");
  }
  if (process.env.CHAT_LOAD_TEST_ACK !== ACK) {
    throw new Error(`Set CHAT_LOAD_TEST_ACK=${ACK} to confirm this is an authorized test target.`);
  }
  return url;
}

function conversationId() {
  const value = required("CHAT_LOAD_TEST_CONVERSATION_ID");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("CHAT_LOAD_TEST_CONVERSATION_ID must be a UUID.");
  }
  return value;
}

function connectAndJoin(url, topic, token, index, sockets) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    sockets.add(socket);
    const joinRef = `join-${index}`;
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out waiting for a Realtime channel join."));
    }, 20_000);
    let joined = false;
    let heartbeatRef = 0;
    let heartbeat;

    const cleanup = () => {
      clearTimeout(timeout);
      if (heartbeat) clearInterval(heartbeat);
    };

    socket.addEventListener("open", () => {
      heartbeat = setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) return;
        heartbeatRef += 1;
        socket.send(
          JSON.stringify({
            topic: "phoenix",
            event: "heartbeat",
            payload: {},
            ref: String(heartbeatRef),
          }),
        );
      }, 25_000);
      socket.send(
        JSON.stringify({
          topic,
          event: "phx_join",
          ref: joinRef,
          join_ref: joinRef,
          payload: {
            access_token: token,
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: `load-${index}` },
              postgres_changes: [],
            },
          },
        }),
      );
    });

    socket.addEventListener("message", (event) => {
      let frame;
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (
        !isRecord(frame) ||
        frame.event !== "phx_reply" ||
        frame.ref !== joinRef ||
        !isRecord(frame.payload)
      ) return;
      clearTimeout(timeout);
      if (frame.payload?.status !== "ok") {
        socket.close();
        reject(new Error("Realtime rejected a channel join."));
        return;
      }
      joined = true;
      resolve(socket);
    });

    socket.addEventListener("error", () => {
      cleanup();
      socket.close();
      reject(new Error("A Realtime WebSocket connection failed."));
    });
    socket.addEventListener("close", () => {
      cleanup();
      if (!joined) reject(new Error("Realtime closed before channel join completed."));
    });
  });
}

async function main() {
  if (typeof WebSocket === "undefined") {
    throw new Error("Node.js with the built-in WebSocket client (Node 22+) is required.");
  }
  const url = realtimeUrl();
  const conversation = conversationId();
  const token = required("CHAT_LOAD_TEST_JWT");
  const connections = boundedInteger("CHAT_LOAD_TEST_CONNECTIONS", 1_000, 1, MAX_CONNECTIONS);
  const rampMs = boundedInteger("CHAT_LOAD_TEST_RAMP_MS", 10_000, 0, 60_000);
  const holdMs = boundedInteger("CHAT_LOAD_TEST_HOLD_MS", 10_000, 1_000, 60_000);
  const topic = `realtime:conversation:${conversation}`;
  const sockets = new Set();
  const joined = new Set();
  let closeAfterTest = false;
  let unexpectedCloses = 0;
  const startedAt = Date.now();
  const latencies = [];
  const joins = [];

  try {
    for (let index = 0; index < connections; index += 1) {
      const started = Date.now();
      const join = connectAndJoin(url, topic, token, index, sockets).then((socket) => {
        joined.add(socket);
        latencies.push(Date.now() - started);
        socket.addEventListener("close", () => {
          if (!closeAfterTest) unexpectedCloses += 1;
        });
        return socket;
      });
      joins.push(join);
      if (index + 1 < connections && rampMs > 0) {
        await sleep(rampMs / connections);
      }
    }
    await Promise.all(joins);
    await sleep(holdMs);
  } finally {
    closeAfterTest = true;
    for (const socket of sockets) socket.close(1000, "Load test complete");
  }

  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? 0;
  console.log(
    JSON.stringify({
      targetConnections: connections,
      joinedConnections: joined.size,
      rampMs,
      holdMs,
      durationMs: Date.now() - startedAt,
      joinLatencyP95Ms: p95,
      unexpectedCloses,
      result: joined.size === connections && unexpectedCloses === 0 ? "PASS" : "FAIL",
    }),
  );
  if (joined.size !== connections || unexpectedCloses > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Chat load test failed.");
  process.exitCode = 1;
});
