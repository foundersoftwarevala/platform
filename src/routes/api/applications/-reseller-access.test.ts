import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (context: { request: Request }) => Promise<Response>;
const state = vi.hoisted(() => ({
  handlers: null as { GET: Handler; POST: Handler } | null,
  staff: vi.fn(),
  boss: vi.fn(),
  resellerReader: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { server: { handlers: { GET: Handler; POST: Handler } } }) => {
    state.handlers = options.server.handlers;
    return options;
  },
}));
vi.mock("@/lib/applications/registry.server", async (original) => ({
  ...(await original<typeof import("@/lib/applications/registry.server")>()),
  getApplication: state.get,
  listApplications: state.list,
}));
vi.mock("@/lib/applications/gateway.server", () => ({
  bearer: (request: Request) => request.headers.get("authorization")?.slice(7) ?? null,
  isApplicationBoss: state.boss,
  isApplicationStaff: state.staff,
  isResellerApplicationReader: state.resellerReader,
  rpcAs: state.rpc,
}));
vi.mock("@/lib/commerce/mailer", () => ({
  providerConfigured: () => null,
  sendQueued: vi.fn(),
}));
vi.mock("@/lib/commerce/seller-commission.server", () => ({
  applySellerCommissionRule: vi.fn(),
}));

import "./queue";

const id = "12345678-1234-4234-8234-123456789012";

function request(method: "GET" | "POST", query = "", body?: Record<string, unknown>) {
  if (!state.handlers) throw new Error("Route handlers were not registered");
  return state.handlers[method]({
    request: new Request(`https://fixture.invalid/api/applications/queue${query}`, {
      method,
      headers: { authorization: "Bearer fixture-token", ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.staff.mockResolvedValue(false);
  state.boss.mockResolvedValue(false);
  state.resellerReader.mockResolvedValue(true);
  state.get.mockResolvedValue({
    kind: "reseller",
    id,
    status: "pending",
    actions: ["active", "rejected"],
  });
  state.list.mockResolvedValue([{ kind: "reseller", id, actions: [] }]);
  state.rpc.mockResolvedValue({ ok: true, data: { ok: true } });
});

describe("Reseller Manager application access", () => {
  it("allows only the restricted reseller summary query", async () => {
    const response = await request("GET", "?kind=reseller&filter=reseller-manager");
    expect(response.status).toBe(200);
    expect(state.list).toHaveBeenCalledWith(["reseller"], true, true);
    expect(state.get).not.toHaveBeenCalled();
  });

  it("does not expose applicant details to a reseller application reader", async () => {
    const response = await request("GET", `?kind=reseller&id=${id}`);
    expect(response.status).toBe(403);
    expect(state.get).not.toHaveBeenCalled();
  });

  it("does not allow non-Boss staff to decide reseller applications", async () => {
    state.staff.mockResolvedValue(true);
    const response = await request("POST", "", {
      action: "decide",
      kind: "reseller",
      id,
      status: "rejected",
      reason: "The application did not meet the criteria.",
    });
    expect(response.status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
