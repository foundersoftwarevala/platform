import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withVpsDatabase: vi.fn(),
  row: null as { value: string } | null,
  fail: false,
  sql: [] as string[],
}));

vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: mocks.withVpsDatabase,
}));

import { DEFAULT_ACTIONS } from "@/lib/marketplace/action-layer";
import { catalogueChanged } from "@/lib/marketplace/catalogue-invalidation";
import { Route } from "./config";

type Handler = (context: { request: Request }) => Promise<Response>;
type RouteOptions = { server: { handlers: { GET: Handler } } };
const getConfig = (Route.options as typeof Route.options & RouteOptions).server.handlers.GET;

function fakeTx(strings: TemplateStringsArray) {
  const query = strings.join("?");
  mocks.sql.push(query);
  if (mocks.fail) throw new Error("database read failed");
  return Promise.resolve(mocks.row ? [mocks.row] : []);
}

beforeEach(() => {
  catalogueChanged();
  vi.clearAllMocks();
  mocks.sql.length = 0;
  mocks.row = null;
  mocks.fail = false;
  mocks.withVpsDatabase.mockImplementation((run: (tx: typeof fakeTx) => Promise<unknown>) =>
    run(fakeTx),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("public Action Layer configuration", () => {
  it("reads persisted configuration through VPS PostgreSQL", async () => {
    const actions = DEFAULT_ACTIONS.map((action) => ({ ...action, enabled: false }));
    mocks.row = { value: JSON.stringify(actions) };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await getConfig({
      request: new Request("http://127.0.0.1/api/actions/config"),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, configured: true, actions });
    expect(mocks.withVpsDatabase).toHaveBeenCalledOnce();
    expect(mocks.sql.join("\n")).toContain("public.system_settings");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a database failure instead of claiming the registry was read", async () => {
    mocks.fail = true;

    const response = await getConfig({
      request: new Request("http://127.0.0.1/api/actions/config"),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "Could not read the VPS action registry.",
    });
  });
});
