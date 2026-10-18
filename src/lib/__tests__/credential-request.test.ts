import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  write: vi.fn(),
  read: vi.fn(),
  exists: vi.fn(),
}));
vi.mock("@/lib/auth/internal-guard", () => ({ requireInternalOperator: mocks.guard }));
vi.mock("fs", () => ({
  writeFileSync: mocks.write,
  readFileSync: mocks.read,
  existsSync: mocks.exists,
}));
import { Route } from "@/routes/api/internal/credential-setup";

type Post = (ctx: { request: Request }) => Promise<Response>;
const post = (
  Route.options as typeof Route.options & {
    server: { handlers: { POST: Post } };
  }
).server.handlers.POST;
const request = (body: unknown) =>
  new Request("https://fixture.invalid/api/internal/credential-setup", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ ok: true, via: "internal token" });
});

describe("credential route request contract", () => {
  it("passes the actual Request to the guard and parses its JSON body", async () => {
    const req = request({ serviceRoleKey: "short-fixture-only" });
    const response = await post({ request: req });
    expect(mocks.guard).toHaveBeenCalledWith(req);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Credential appears too short (< 50 chars)" });
    expect(req.bodyUsed).toBe(true);
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.exists).not.toHaveBeenCalled();
  });

  it.each([{}, { serviceRoleKey: 123 }, { serviceRoleKey: "unsafe\nfixture" }])(
    "rejects invalid input without writing: %j",
    async (body) => {
      const response = await post({ request: request(body) });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid credential provided" });
      expect(mocks.write).not.toHaveBeenCalled();
    },
  );

  it("rejects non-internal authenticated callers before reading credentials", async () => {
    mocks.guard.mockResolvedValue({ ok: true, via: "user session" });
    const req = request({});
    expect((await post({ request: req })).status).toBe(403);
    expect(req.bodyUsed).toBe(false);
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
