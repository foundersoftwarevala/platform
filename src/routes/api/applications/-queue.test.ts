import { beforeEach, describe, expect, it, vi } from "vitest";
import { APPLICATION_KINDS } from "@/lib/applications/kinds";

type Handler = (context: { request: Request }) => Promise<Response>;
const state = vi.hoisted(() => ({
  handlers: null as { GET: Handler; POST: Handler } | null,
  staff: vi.fn(),
  rpc: vi.fn(),
  count: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  send: vi.fn(),
  provider: vi.fn(),
  commission: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { server: { handlers: { GET: Handler; POST: Handler } } }) => {
    state.handlers = options.server.handlers;
    return options;
  },
}));
vi.mock("@/lib/applications/registry.server", async (original) => ({
  ...(await original<typeof import("@/lib/applications/registry.server")>()),
  countApplications: state.count,
  getApplication: state.get,
  listApplications: state.list,
}));
vi.mock("@/lib/applications/gateway.server", () => ({
  bearer: (request: Request) =>
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? null,
  isApplicationStaff: state.staff,
  rpcAs: state.rpc,
  serviceRest: vi.fn(),
}));
vi.mock("@/lib/commerce/mailer", () => ({
  sendQueued: state.send,
  providerConfigured: state.provider,
}));
vi.mock("@/lib/commerce/seller-commission.server", () => ({
  applySellerCommissionRule: state.commission,
}));
import "./queue";

const id = "c733350b-27f5-424e-9b21-f6b837c48018";
function call(method: "GET" | "POST", body?: Record<string, unknown>, query = "", signedIn = true) {
  if (!state.handlers) throw new Error("Route handlers were not registered");
  return state.handlers[method]({
    request: new Request(`https://fixture.invalid/api/applications/queue${query}`, {
      method,
      headers: signedIn ? { authorization: "Bearer fixture-token" } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.staff.mockResolvedValue(true);
  state.provider.mockReturnValue(null);
  state.get.mockResolvedValue({
    id,
    kind: "employee",
    status: "pending",
    actions: ["approved", "rejected"],
  });
  state.rpc.mockResolvedValue({ ok: true, data: { ok: true } });
  state.send.mockResolvedValue({
    attempted: 0,
    sent: 0,
    retrying: 0,
    failed: 0,
    reason: "no email provider configured",
  });
});
describe("authenticated central application API", () => {
  it.each(["GET", "POST"] as const)("requires sign-in for %s", async (method) => {
    expect((await call(method, undefined, "", false)).status).toBe(401);
    expect(state.count).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("refuses non-staff before reading any private application", async () => {
    state.staff.mockResolvedValue(false);
    expect((await call("GET", undefined, "?counts=true")).status).toBe(403);
    expect(state.count).not.toHaveBeenCalled();
  });
  it("returns exact uncached counts and actual delivery configuration", async () => {
    state.count.mockResolvedValue({ total: 5009, byRole: [{ kind: "employee", count: 5009 }] });
    const response = await call("GET", undefined, "?counts=true");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ total: 5009, emailProviderConfigured: false });
  });
  it("surfaces missing-schema or count failures instead of success-shaped zero", async () => {
    state.count.mockRejectedValue(new Error("employee table not migrated"));
    expect((await call("GET", undefined, "?counts=true")).status).toBe(502);
  });
  it("requires a rejection reason before calling the database", async () => {
    expect(
      (await call("POST", { action: "decide", kind: "employee", id, status: "rejected" })).status,
    ).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("preserves the database's self-review refusal without attempting email", async () => {
    state.rpc.mockResolvedValue({
      ok: false,
      status: 403,
      message: "You cannot review your own application",
    });
    expect(
      (await call("POST", { action: "decide", kind: "employee", id, status: "approved" })).status,
    ).toBe(403);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("does not report success for an HTTP-200 business refusal", async () => {
    state.rpc.mockResolvedValue({ ok: true, data: { ok: false, reason: "not_permitted" } });
    const response = await call("POST", {
      action: "decide",
      kind: "employee",
      id,
      status: "approved",
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "not_permitted" });
    expect(state.send).not.toHaveBeenCalled();
  });
  it.each(APPLICATION_KINDS)(
    "dispatches only the approved %s application's outbox",
    async (kind) => {
      const status = kind === "reseller" ? "active" : "approved";
      state.get.mockResolvedValue({ id, kind, status: "pending", actions: [status] });
      const response = await call("POST", { action: "decide", kind, id, status });
      expect(response.status).toBe(200);
      expect(state.send).toHaveBeenCalledWith(1, { id, kind });
      if (kind === "vendor" || kind === "author")
        expect(state.commission).toHaveBeenCalledWith(id, kind);
      else expect(state.commission).not.toHaveBeenCalled();
      expect(await response.json()).toMatchObject({
        ok: true,
        email: { sent: 0, reason: "no email provider configured" },
      });
    },
  );
  it("does not turn an already-saved decision into a false failure when email dispatch fails", async () => {
    state.send.mockRejectedValue(new Error("delivery state could not be recorded"));
    const response = await call("POST", {
      action: "decide",
      kind: "employee",
      id,
      status: "approved",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      email: {
        sent: 0,
        reason: "Decision saved; email delivery could not be confirmed.",
      },
    });
  });
});
