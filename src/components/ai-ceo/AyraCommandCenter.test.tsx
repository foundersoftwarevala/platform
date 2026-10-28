// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AyraCommandCenter } from "./AyraCommandCenter";

const server = vi.hoisted(() => ({
  grants: vi.fn(),
  audit: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/ai-ceo/ceo.functions", () => ({
  loadAyraGrants: server.grants,
  loadAyraGrantAudit: server.audit,
  setAyraGrant: server.update,
}));

afterEach(() => cleanup());
beforeEach(() => {
  server.grants.mockResolvedValue([
    { roleName: "SUPER_ADMIN", permissionKey: "allow_system_coding", isEnabled: false, updatedAt: "2026-10-28T00:00:00Z" },
    { roleName: "FRANCHISE", permissionKey: "allow_system_coding", isEnabled: false, updatedAt: "2026-10-28T00:00:00Z" },
    { roleName: "AYRA_AGENT", permissionKey: "allow_system_coding", isEnabled: false, updatedAt: "2026-10-28T00:00:00Z" },
  ]);
  server.audit.mockResolvedValue([]);
  server.update.mockResolvedValue({ roleName: "SUPER_ADMIN", permissionKey: "allow_system_coding", isEnabled: true, updatedAt: "2026-10-28T00:01:00Z" });
});

function renderCenter(open = true, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AyraCommandCenter open={open} onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe("AYRA Command Center", () => {
  it("loads persisted grants and saves a changed permission", async () => {
    renderCenter();
    expect(await screen.findByRole("dialog", { name: "AYRA COMMAND CENTER" })).toBeTruthy();
    const toggle = await screen.findByRole("switch", { name: "Allow system coding" });
    expect(toggle.getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(toggle);
    await waitFor(() => expect(server.update).toHaveBeenCalledWith({
      data: { roleName: "SUPER_ADMIN", permissionKey: "allow_system_coding", isEnabled: true },
    }));
  });

  it("lets an authorized operator inspect roles and real audit logs without a local PIN", async () => {
    renderCenter();
    await screen.findByRole("switch", { name: "Allow system coding" });
    fireEvent.click(screen.getByRole("tab", { name: "Franchise" }));
    expect(screen.getByLabelText("Franchise grants")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Audit Logs" }));
    await waitFor(() => expect(server.audit).toHaveBeenCalled());
    expect(await screen.findByText("No AYRA grant changes have been recorded.")).toBeTruthy();
    expect(screen.queryByLabelText("Command Center PIN")).toBeNull();
  });

  it("closes from the close button and Escape key", async () => {
    const onClose = vi.fn();
    renderCenter(true, onClose);
    await screen.findByRole("dialog", { name: "AYRA COMMAND CENTER" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
