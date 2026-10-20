// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RnDNotification } from "@/lib/rd-module/rnd-types";

const state = vi.hoisted(() => {
  const data: RnDNotification[] = [];
  return {
    path: "/rd-manager/start",
    data,
    error: null as Error | null,
    submit: vi.fn(),
    prepare: vi.fn(),
    upload: vi.fn<(args: { data: FormData }) => Promise<{ path: string }>>(),
    dismiss: vi.fn(),
    mark: vi.fn(),
    gate: vi.fn(),
    toast: vi.fn(),
  };
});
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useRouterState: () => state.path,
  Outlet: () => <p>Public R&amp;D page</p>,
}));
vi.mock("@/components/auth/RequireRole", () => ({
  RequireRole: (props: unknown) => {
    state.gate(props);
    return <p>Control Panel access required</p>;
  },
}));
vi.mock("@/lib/rd-module/rd-opportunities.functions", () => ({
  submitOpportunity: state.submit,
  createAttachmentUploads: state.prepare,
  uploadOpportunityAttachment: state.upload,
}));
vi.mock("@/lib/rd-module/rnd-data.functions", () => ({
  dismissNotification: state.dismiss,
  markNotificationsRead: state.mark,
}));
vi.mock("@/hooks/rd-module/useRnDData", () => ({
  rndKeys: { notifications: ["rnd", "notifications"] },
  useNotifications: () => ({ data: state.data, error: state.error, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: state.toast } }));

import { RequestForm } from "./RequestForm";
import { RnDNotifications } from "../rnd/RnDNotifications";
import { ResearchModule } from "../ResearchModule";

function shell(component: React.ReactNode) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    cache,
    ...render(<QueryClientProvider client={cache}>{component}</QueryClientProvider>),
  };
}
function fillForm() {
  for (const [label, value] of [
    ["Request title", "Transport software"],
    ["What software do you need?", "Manage school transport routes and student attendance."],
    ["Name", "Fixture Applicant"],
    ["Email", "applicant@fixture.invalid"],
    ["Country", "India"],
  ])
    fireEvent.change(screen.getByLabelText(`${label} *`), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.path = "/rd-manager/start";
  state.data.length = 0;
  state.error = null;
  state.submit.mockResolvedValue({
    requestId: "SV-RD-ABCDEF",
    status: "Received",
    createdAt: "2026-10-16T14:00:00Z",
  });
  state.prepare.mockResolvedValue([
    { path: "pending/c733350b-27f5-424e-9b21-f6b837c48018/0-brief.pdf", token: "isolated-token" },
  ]);
  state.upload.mockResolvedValue({
    path: "pending/c733350b-27f5-424e-9b21-f6b837c48018/0-brief.pdf",
  });
  state.dismiss.mockResolvedValue({ ok: true });
  state.mark.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("R&D public form and real notification surfaces", () => {
  it.each(["/rd-manager/start", "/rd-manager/track", "/rd-manager/start/"])(
    "allows public page %s without mounting the internal role gate",
    (path) => {
      state.path = path;
      shell(<ResearchModule />);
      expect(screen.getByText("Public R&D page")).toBeTruthy();
      expect(state.gate).not.toHaveBeenCalled();
    },
  );
  it.each([
    "/rd-manager",
    "/rd-manager/lab",
    "/rd-manager/pro-manager",
    "/rd-manager/start/internal",
  ])("retains the manager gate for %s", (path) => {
    state.path = path;
    shell(<ResearchModule />);
    expect(screen.getByText("Control Panel access required")).toBeTruthy();
    expect(state.gate).toHaveBeenCalledWith(
      expect.objectContaining({ role: expect.arrayContaining(["admin", "boss"]) }),
    );
  });
  it("submits pasted requirements, contact email and the uploaded PDF through the existing intake", async () => {
    const done = vi.fn();
    const { container } = shell(<RequestForm type="SOFTWARE_ON_DEMAND" onDone={done} />);
    fillForm();
    const pdf = new File(["%PDF-1.4\nfixture"], "brief.pdf", { type: "application/pdf" });
    const picker = container.querySelector<HTMLInputElement>('input[name="attachment_picker"]')!;
    fireEvent.change(picker, { target: { files: [pdf] } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit to R&D" }).closest("form")!);
    await waitFor(() =>
      expect(done).toHaveBeenCalledWith(expect.objectContaining({ requestId: "SV-RD-ABCDEF" })),
    );
    const form = state.upload.mock.calls[0][0].data;
    expect(form.get("path")).toContain("pending/");
    expect(form.get("token")).toBe("isolated-token");
    expect(form.get("file")).toBe(pdf);
    expect(state.submit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "applicant@fixture.invalid",
        need: expect.stringContaining("transport routes"),
        attachments: [
          {
            path: expect.stringContaining("pending/"),
            name: "brief.pdf",
            size: pdf.size,
            type: "application/pdf",
          },
        ],
      }),
    });
  });
  it("shows upload failure and never claims the request was submitted", async () => {
    const done = vi.fn();
    state.upload.mockRejectedValue(new Error("Could not upload brief.pdf"));
    const { container } = shell(<RequestForm type="SOFTWARE_ON_DEMAND" onDone={done} />);
    fillForm();
    fireEvent.change(container.querySelector('input[name="attachment_picker"]')!, {
      target: { files: [new File(["%PDF-1.4"], "brief.pdf", { type: "application/pdf" })] },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Submit to R&D" }).closest("form")!);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Could not upload brief.pdf"),
    );
    expect(state.submit).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  });
  it("renders database alerts instead of the former hardcoded examples and persists dismissal", async () => {
    state.data.push({
      id: "c733350b-27f5-424e-9b21-f6b837c48018",
      type: "idea",
      title: "New Software On Demand request",
      message: "SV-RD-ABCDEF: Transport software",
      read: false,
      dismissed: false,
      created_at: "2026-10-16T14:00:00Z",
    });
    const { cache } = shell(<RnDNotifications />);
    const invalidated = vi.spyOn(cache, "invalidateQueries");
    expect(screen.getByText("SV-RD-ABCDEF: Transport software")).toBeTruthy();
    expect(screen.queryByText("Holographic Dashboard")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss New Software On Demand request" }));
    await waitFor(() =>
      expect(state.dismiss).toHaveBeenCalledWith({ data: { id: state.data[0].id } }),
    );
    await waitFor(() =>
      expect(invalidated).toHaveBeenCalledWith({ queryKey: ["rnd", "notifications"] }),
    );
  });
  it("marks alerts read in the database", async () => {
    state.data.push({
      id: "fixture",
      type: "idea",
      title: "Request",
      message: "Request",
      read: false,
      dismissed: false,
      created_at: "2026-10-16T14:00:00Z",
    });
    shell(<RnDNotifications />);
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(state.mark).toHaveBeenCalledWith({ data: {} }));
  });
  it("distinguishes notification failures from an empty inbox", () => {
    state.error = new Error("R&D database is unavailable");
    shell(<RnDNotifications />);
    expect(screen.getByRole("alert").textContent).toContain("database is unavailable");
    expect(screen.queryByText("No R&D alerts.")).toBeNull();
  });
});
