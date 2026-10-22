// Keep the test out of TanStack's generated route tree.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isApplicationBoss: vi.fn(),
  isApplicationStaff: vi.fn(),
  isResellerApplicationReader: vi.fn(),
  listApplications: vi.fn(),
  getApplication: vi.fn(),
  rpcAs: vi.fn(),
  applySellerCommissionRule: vi.fn(),
}));

vi.mock("@/lib/applications/gateway.server", () => ({
  bearer: (request: Request) => request.headers.get("authorization")?.slice(7) ?? null,
  isApplicationBoss: mocks.isApplicationBoss,
  isApplicationStaff: mocks.isApplicationStaff,
  isResellerApplicationReader: mocks.isResellerApplicationReader,
  rpcAs: mocks.rpcAs,
}));
vi.mock("@/lib/applications/registry.server", () => ({
  APPLICATION_KINDS: ["reseller", "vendor", "author", "franchise", "influencer", "affiliate"],
  definitionOf: () => ({
    review: (id: string, status: string, reason: string | null) => ({
      fn: "mm_reseller_status",
      args: { p_id: id, p_to: status, p_reason: reason },
    }),
    approvedStatus: "active",
  }),
  getApplication: mocks.getApplication,
  isApplicationKind: (value: unknown) =>
    typeof value === "string" &&
    ["reseller", "vendor", "author", "franchise", "influencer", "affiliate"].includes(value),
  listApplications: mocks.listApplications,
}));
vi.mock("@/lib/commerce/seller-commission.server", () => ({
  applySellerCommissionRule: mocks.applySellerCommissionRule,
}));

import { Route } from "./queue";

type QueueRoute = {
  options: {
    server: {
      handlers: {
        GET: (context: { request: Request }) => Promise<Response>;
        POST: (context: { request: Request }) => Promise<Response>;
      };
    };
  };
};

const handlers = (Route as unknown as QueueRoute).options.server.handlers;
const application = {
  kind: "reseller",
  id: "12345678-1234-4234-8234-123456789012",
  number: "RSA-123",
  name: "Applicant",
  email: "applicant@example.invalid",
  status: "pending",
  reason: null,
  submitted: "2026-10-01T00:00:00Z",
  actions: ["active", "rejected"],
};

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost/api/applications/queue${path}`, {
    ...init,
    headers: { authorization: "Bearer fixture-token", ...init?.headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isApplicationBoss.mockResolvedValue(false);
  mocks.isApplicationStaff.mockResolvedValue(false);
  mocks.isResellerApplicationReader.mockResolvedValue(true);
  mocks.listApplications.mockResolvedValue([{ ...application, actions: [] }]);
  mocks.getApplication.mockResolvedValue(application);
  mocks.rpcAs.mockResolvedValue({ ok: true, data: { ok: true } });
});

afterEach(() => vi.clearAllMocks());

describe("application queue access", () => {
  it("lets a Reseller Manager read only the restricted reseller summary list", async () => {
    const response = await handlers.GET({
      request: request("?kind=reseller&filter=reseller-manager"),
    });

    expect(response.status).toBe(200);
    expect(mocks.listApplications).toHaveBeenCalledWith(["reseller"], true, true);
    expect(mocks.getApplication).not.toHaveBeenCalled();
  });

  it("does not let a Reseller Manager read full applicant details or documents", async () => {
    const response = await handlers.GET({
      request: request("?kind=reseller&id=12345678-1234-4234-8234-123456789012"),
    });

    expect(response.status).toBe(403);
    expect(mocks.getApplication).not.toHaveBeenCalled();
  });

  it("denies non-Boss reseller decisions even if the caller is application staff", async () => {
    mocks.isApplicationStaff.mockResolvedValue(true);
    const response = await handlers.POST({
      request: request("", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "decide",
          kind: "reseller",
          id: application.id,
          status: "rejected",
          reason: "Application does not meet the criteria.",
        }),
      }),
    });

    expect(response.status).toBe(403);
    expect(mocks.getApplication).not.toHaveBeenCalled();
    expect(mocks.rpcAs).not.toHaveBeenCalled();
  });

  it("allows the Boss decision to pass through the existing caller-scoped RPC", async () => {
    mocks.isApplicationBoss.mockResolvedValue(true);
    mocks.isApplicationStaff.mockResolvedValue(true);
    const response = await handlers.POST({
      request: request("", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "decide",
          kind: "reseller",
          id: application.id,
          status: "active",
        }),
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.rpcAs).toHaveBeenCalledWith("fixture-token", "mm_reseller_status", {
      p_id: application.id,
      p_to: "active",
      p_reason: null,
    });
  });
});
