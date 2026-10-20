// @vitest-environment jsdom
import {
  cleanup,
  configure,
  fireEvent,
  getConfig,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamEvent } from "@/lib/realtime/notification-stream";
import type { ApplicationSummary } from "@/lib/applications/registry.server";
import { APPLICATION_KINDS } from "@/lib/applications/kinds";
import { messageText } from "@/lib/i18n/messages";
import { formatMessage } from "@/lib/i18n/format";

const state = vi.hoisted(() => ({
  rows: [] as ApplicationSummary[],
  listener: null as ((event: StreamEvent) => void) | null,
  unsubscribe: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  countError: false,
}));
const originalAsyncTimeout = getConfig().asyncUtilTimeout;
vi.mock("@/lib/auth/operator-fetch", () => ({ authHeaders: async () => ({}) }));
vi.mock("@/lib/realtime/notification-stream", () => ({
  subscribeNotificationStream: (listener: (event: StreamEvent) => void) => {
    state.listener = listener;
    return state.unsubscribe;
  },
}));
vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({
    t: (key: string, variables?: Record<string, string | number>) =>
      formatMessage(messageText(key) ?? key, variables ?? {}, "en"),
  }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: state.success,
    warning: state.warning,
    error: state.error,
  },
}));
import { RoleApplicationsQueue } from "./RoleApplicationsQueue";

function fixture(id = "employee-1"): ApplicationSummary {
  return {
    id,
    kind: "employee",
    number: `SVE-${id}`,
    name: "Fixture Applicant",
    email: "applicant@fixture.invalid",
    status: "pending",
    reason: null,
    submitted: "2026-10-16T00:00:00Z",
    actions: ["in_review", "approved", "rejected"],
  };
}
function mount() {
  const cache = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={cache}>
      <RoleApplicationsQueue kind="all" />
    </QueryClientProvider>,
  );
  return cache;
}
beforeEach(() => {
  configure({ asyncUtilTimeout: 5000 });
  vi.clearAllMocks();
  state.rows = [fixture()];
  state.countError = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, "https://fixture.invalid");
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          id: string;
          status: string;
          reason: string | null;
        };
        const row = state.rows.find((row) => row.id === body.id);
        if (!row) return Response.json({ error: "Application not found" }, { status: 404 });
        row.status = body.status;
        row.reason = body.reason;
        row.actions = [];
        return Response.json({
          ok: true,
          email: { sent: 0, reason: "no email provider configured" },
        });
      }
      if (url.searchParams.has("counts")) {
        if (state.countError)
          return Response.json({ error: "Counts unavailable" }, { status: 502 });
        const byRole = APPLICATION_KINDS.map((kind) => ({
          kind,
          count: state.rows.filter(
            (row) => row.kind === kind && ["pending", "in_review"].includes(row.status),
          ).length,
        }));
        return Response.json({
          byRole,
          total: byRole.reduce((sum, row) => sum + row.count, 0),
          emailProviderConfigured: false,
        });
      }
      const kind = url.searchParams.get("kind");
      return Response.json({
        rows: state.rows.filter(
          (row) =>
            (kind === "all" || row.kind === kind) &&
            (url.searchParams.get("filter") === "all" ||
              ["pending", "in_review"].includes(row.status)),
        ),
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  configure({ asyncUtilTimeout: originalAsyncTimeout });
});

describe("central role queue and pending counts", () => {
  it("shows all seven role sections with actual counts and an honest email warning", async () => {
    mount();
    await screen.findByRole("button", { name: "Employee · 1" });
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(7);
    expect(screen.getByText(/Email delivery is not configured/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Employee · 1" }));
    expect(screen.getByText(/Employee approval means shortlisting only/)).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Shortlist" })).toBeTruthy();
  });
  it("increments on submission events, then decrements after shortlisting with cache invalidation", async () => {
    const cache = mount();
    const invalidate = vi.spyOn(cache, "invalidateQueries");
    await screen.findByRole("button", { name: "Employee · 1" });
    state.rows.push(fixture("employee-2"));
    state.listener?.({
      type: "notification",
      event: "application.submitted",
      id: "event",
      ledger_id: null,
      conversation_id: null,
      sender_id: null,
    });
    await screen.findByRole("button", { name: "Employee · 2" });
    fireEvent.click(screen.getAllByRole("button", { name: "Shortlist" })[0]);
    await screen.findByRole("button", { name: "Employee · 1" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["control-panel", "cockpit"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["application-counts"] });
    expect(state.success).toHaveBeenCalled();
    expect(state.warning).toHaveBeenCalledWith(
      expect.stringMatching(/delivery has not been confirmed/),
    );
  });
  it("requires a rejection reason, records it, and removes the pending item", async () => {
    mount();
    await screen.findByRole("button", { name: "Employee · 1" });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const confirm = screen.getByRole("button", { name: "Reject application" });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/Reason for rejection/), {
      target: { value: "Role requirements not met" },
    });
    fireEvent.click(confirm);
    await screen.findByRole("button", { name: "Employee · 0" });
    expect(state.rows[0].reason).toBe("Role requirements not met");
  });
  it("shows an error instead of zero when exact counts fail", async () => {
    state.countError = true;
    mount();
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Employee · —" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Every kind · 0" })).toBeNull();
  });
  it("catches up on stream reconnect, ignores unrelated events, and unsubscribes", async () => {
    const cache = mount();
    const invalidate = vi.spyOn(cache, "invalidateQueries");
    await screen.findByRole("button", { name: "Employee · 1" });
    state.listener?.({ type: "unavailable" });
    expect(invalidate).not.toHaveBeenCalled();
    state.listener?.({
      type: "notification",
      event: "order.created",
      id: "event",
      ledger_id: null,
      conversation_id: null,
      sender_id: null,
    });
    expect(invalidate).not.toHaveBeenCalled();
    state.rows.push(fixture("employee-2"));
    state.listener?.({ type: "open" });
    await screen.findByRole("button", { name: "Employee · 2" });
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(4));
    cleanup();
    expect(state.unsubscribe).toHaveBeenCalledOnce();
  });
});
