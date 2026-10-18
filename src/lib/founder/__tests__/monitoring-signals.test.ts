import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What Founder AI does with a Monitoring Agent's signal.
 *
 * Sixty agents watching sixty things will, on a bad day, all report the same
 * outage at once. The behaviour that matters is therefore not "does a signal
 * create an item" but "does the second one fold into the first", and "does a
 * severity get exactly what the ladder says it gets and nothing more".
 *
 * These run against a fake PostgREST rather than the database: every request
 * is recorded, so the test can assert not only the outcome but which tables
 * were written and which were left alone. Whether the constraints behind
 * those tables hold is checked separately, in SQL, against the real database.
 */

const ROUTES = [
  {
    severity: "INFO",
    label: "silently monitored",
    raises_attention: false,
    attention_priority: 5,
    notifies: false,
    escalates: false,
    opens_decision: false,
    correlation_window: "06:00:00",
  },
  {
    severity: "LOW",
    label: "dashboard",
    raises_attention: true,
    attention_priority: 4,
    notifies: false,
    escalates: false,
    opens_decision: false,
    correlation_window: "04:00:00",
  },
  {
    severity: "MEDIUM",
    label: "attention queue",
    raises_attention: true,
    attention_priority: 3,
    notifies: false,
    escalates: false,
    opens_decision: false,
    correlation_window: "02:00:00",
  },
  {
    severity: "HIGH",
    label: "alerts the Founder",
    raises_attention: true,
    attention_priority: 2,
    notifies: true,
    escalates: false,
    opens_decision: false,
    correlation_window: "01:00:00",
  },
  {
    severity: "CRITICAL",
    label: "immediate alert and escalation",
    raises_attention: true,
    attention_priority: 1,
    notifies: true,
    escalates: true,
    opens_decision: true,
    correlation_window: "00:15:00",
  },
];

interface Call {
  method: string;
  path: string;
  body: unknown;
}

let calls: Call[] = [];
/** Attention rows the fake database already holds, for correlation. */
let openAttention: { id: string }[] = [];
let agentPermissions = ["READ", "ANALYZE", "RECOMMEND", "CREATE"];
let attentionInsertFails = false;
let duplicateEvent = false;

vi.mock("../events.server", () => ({
  ingestEvent: vi.fn(async () => ({
    accepted: true as const,
    id: "event-1",
    duplicate: duplicateEvent,
  })),
}));

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  calls = [];
  openAttention = [];
  agentPermissions = ["READ", "ANALYZE", "RECOMMEND", "CREATE"];
  attentionInsertFails = false;
  duplicateEvent = false;

  process.env.SUPABASE_URL = "http://localhost:9999";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const path = String(url).replace("http://localhost:9999/rest/v1/", "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, path, body });

    if (path.startsWith("ai_agents?")) {
      return jsonResponse([{ id: "agent-1", permissions: agentPermissions }]);
    }
    if (path.startsWith("founder_signal_routes")) return jsonResponse(ROUTES);
    if (path.startsWith("founder_attention?select=id")) return jsonResponse(openAttention);
    if (path.startsWith("founder_attention") && method === "POST") {
      if (attentionInsertFails) return jsonResponse({ message: "boom" }, false, 500);
      return jsonResponse([{ id: "attention-1" }]);
    }
    if (path.startsWith("founder_signal_dispatch") && method === "GET") return jsonResponse([]);
    if (path.startsWith("founder_signal_dispatch")) return jsonResponse([{ id: "dispatch-1" }]);
    if (path.startsWith("user_roles")) return jsonResponse([{ user_id: "boss-1" }]);
    if (path.startsWith("notifications")) return jsonResponse([{ id: "note-1" }]);
    if (path.startsWith("founder_decisions")) return jsonResponse([{ id: "decision-1" }]);
    return jsonResponse([]);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function route(over: Record<string, unknown> = {}) {
  const { routeSignal } = await import("../monitoring/signals.server");
  return routeSignal({
    agentKey: "mon-payment",
    kind: "payment_failure_rate",
    domain: "finance",
    title: "Payment failures above threshold",
    reason: "Failure rate is 12% against a 2% threshold.",
    severity: "HIGH",
    sourceSystem: "payments",
    sourceRef: "sig-1",
    entityId: "gateway-a",
    ...over,
  } as never);
}

const wrote = (table: string) => calls.some((c) => c.method === "POST" && c.path.startsWith(table));

describe("the severity ladder decides what a signal earns", () => {
  it("watches an INFO signal without raising anything", async () => {
    const out = await route({ severity: "INFO" });
    expect(out.accepted).toBe(true);
    if (!out.accepted) return;
    expect(out.attentionId).toBeNull();
    expect(out.notified).toBe(false);
    expect(out.decisionId).toBeNull();
    // The event is the whole record; nothing is queued and nobody is told.
    expect(wrote("founder_attention")).toBe(false);
    expect(wrote("notifications")).toBe(false);
  });

  it("raises an item for LOW without interrupting anyone", async () => {
    const out = await route({ severity: "LOW" });
    expect(out.accepted).toBe(true);
    if (!out.accepted) return;
    expect(out.attentionId).toBe("attention-1");
    expect(out.notified).toBe(false);
    expect(wrote("notifications")).toBe(false);
  });

  it("queues a MEDIUM signal and still tells nobody", async () => {
    const out = await route({ severity: "MEDIUM" });
    expect(out.accepted).toBe(true);
    if (!out.accepted) return;
    expect(out.attentionId).toBe("attention-1");
    expect(out.notified).toBe(false);
  });

  it("alerts a person for HIGH, but does not escalate or decide", async () => {
    const out = await route({ severity: "HIGH" });
    expect(out.accepted).toBe(true);
    if (!out.accepted) return;
    expect(out.notified).toBe(true);
    expect(out.escalated).toBe(false);
    expect(out.decisionId).toBeNull();
    expect(wrote("founder_decisions")).toBe(false);
  });

  it("alerts, escalates and opens a governed decision for CRITICAL", async () => {
    const out = await route({ severity: "CRITICAL" });
    expect(out.accepted).toBe(true);
    if (!out.accepted) return;
    expect(out.notified).toBe(true);
    expect(out.escalated).toBe(true);
    expect(out.decisionId).toBe("decision-1");

    // The decision is opened for approval, never as an action already taken.
    const decision = calls.find((c) => c.path.startsWith("founder_decisions"));
    const body = decision?.body as Record<string, unknown>;
    expect(body.state).toBe("DETECTED");
    expect(body.approval_required).toBe(true);
  });
});

describe("the same problem does not fill the queue", () => {
  it("folds a repeat into the item that is already open", async () => {
    openAttention = [{ id: "attention-existing" }];
    const out = await route({ severity: "HIGH" });
    expect(out.accepted).toBe(true);
    if (!out.accepted) return;
    expect(out.correlated).toBe(true);
    expect(out.attentionId).toBe("attention-existing");
    // No second item is created for a problem already being worked.
    expect(wrote("founder_attention")).toBe(false);
  });

  it("correlates on the entity, so a different one gets its own item", async () => {
    openAttention = [];
    const out = await route({ severity: "HIGH", entityId: "gateway-b" });
    expect(out.accepted).toBe(true);
    if (!out.accepted) return;
    expect(out.correlated).toBe(false);
    const lookup = calls.find((c) => c.path.startsWith("founder_attention?select=id"));
    expect(lookup?.path).toContain("gateway-b");
    expect(lookup?.path).toContain("status=in.(NEW,ACKNOWLEDGED,IN_PROGRESS)");
  });

  it("treats the same signal arriving twice as one signal", async () => {
    duplicateEvent = true;
    const out = await route({ severity: "CRITICAL" });
    expect(out.accepted).toBe(true);
    if (!out.accepted) return;
    expect(out.duplicate).toBe(true);
    // A duplicate is not re-routed: nothing is raised, nobody is told again.
    expect(wrote("founder_attention")).toBe(false);
    expect(wrote("notifications")).toBe(false);
    expect(wrote("founder_decisions")).toBe(false);
  });
});

describe("an agent cannot exceed what it holds", () => {
  it("refuses a signal from an agent without CREATE", async () => {
    agentPermissions = ["READ", "ANALYZE"];
    const out = await route();
    expect(out.accepted).toBe(false);
    if (out.accepted) return;
    expect(out.reason).toContain("CREATE");
    expect(wrote("founder_attention")).toBe(false);
  });

  it("refuses a signal from an agent that is not registered", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      const path = String(url).replace("http://localhost:9999/rest/v1/", "");
      if (path.startsWith("ai_agents?")) return jsonResponse([]);
      return jsonResponse([]);
    });
    const out = await route();
    expect(out.accepted).toBe(false);
    if (out.accepted) return;
    expect(out.reason).toContain("no agent is registered");
  });
});

describe("a failure is reported, never hidden", () => {
  it("says so when the attention item could not be raised", async () => {
    attentionInsertFails = true;
    const out = await route({ severity: "HIGH" });
    expect(out.accepted).toBe(false);
    if (out.accepted) return;
    expect(out.reason).toContain("could not be raised");
  });

  it("records a signal as not notified when notifying fails", async () => {
    const original = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const path = String(url).replace("http://localhost:9999/rest/v1/", "");
      if (path.startsWith("notifications")) throw new Error("smtp down");
      return (original as typeof fetch)(url as never, init as never);
    });
    const out = await route({ severity: "HIGH" });
    expect(out.accepted).toBe(true);
    if (!out.accepted) return;
    // The signal still lands and is honest about not having reached anyone.
    expect(out.attentionId).toBe("attention-1");
    expect(out.notified).toBe(false);
  });
});
