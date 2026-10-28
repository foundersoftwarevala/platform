// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AyraCommandCenter } from "./AyraCommandCenter";

const server = vi.hoisted(() => ({
  grants: vi.fn(),
  audit: vi.fn(),
  update: vi.fn(),
  credentials: vi.fn(),
  saveCredential: vi.fn(),
  revokeCredential: vi.fn(),
  proposals: vi.fn(),
  generateProposals: vi.fn(),
  reviewProposal: vi.fn(),
  memoryFacts: vi.fn(),
  rememberFact: vi.fn(),
  forgetFact: vi.fn(),
  companyProfile: vi.fn(),
  saveCompanyProfile: vi.fn(),
  issueExtensionToken: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/ai-ceo/ceo.functions", () => ({
  loadAyraGrants: server.grants,
  loadAyraGrantAudit: server.audit,
  setAyraGrant: server.update,
}));
vi.mock("@/lib/ai-ceo/ayra-vault.functions", () => ({
  loadAyraCredentialStatuses: server.credentials,
  saveAyraCredential: server.saveCredential,
  revokeAyraCredential: server.revokeCredential,
}));
vi.mock("@/lib/ai-ceo/ayra-improvement.functions", () => ({
  loadAyraPromptProposals: server.proposals,
  generateAyraPromptProposals: server.generateProposals,
  reviewAyraPromptProposal: server.reviewProposal,
}));
vi.mock("@/lib/ai-ceo/ayra-memory.functions", () => ({
  loadAyraMemoryFacts: server.memoryFacts,
  rememberAyraFact: server.rememberFact,
  forgetAyraFact: server.forgetFact,
}));
vi.mock("@/lib/ai-ceo/ayra-autofill.functions", () => ({
  loadAyraCompanyProfile: server.companyProfile,
  saveAyraCompanyProfile: server.saveCompanyProfile,
  issueAyraAutofillExtensionToken: server.issueExtensionToken,
}));

afterEach(() => cleanup());
beforeEach(() => {
  server.grants.mockResolvedValue([
    {
      roleName: "SUPER_ADMIN",
      permissionKey: "allow_system_coding",
      isEnabled: false,
      updatedAt: "2026-10-28T00:00:00Z",
    },
    {
      roleName: "FRANCHISE",
      permissionKey: "allow_system_coding",
      isEnabled: false,
      updatedAt: "2026-10-28T00:00:00Z",
    },
    {
      roleName: "AYRA_AGENT",
      permissionKey: "allow_system_coding",
      isEnabled: false,
      updatedAt: "2026-10-28T00:00:00Z",
    },
  ]);
  server.audit.mockResolvedValue([]);
  server.update.mockResolvedValue({
    roleName: "SUPER_ADMIN",
    permissionKey: "allow_system_coding",
    isEnabled: true,
    updatedAt: "2026-10-28T00:01:00Z",
  });
  server.credentials.mockResolvedValue([]);
  server.saveCredential.mockResolvedValue({ ok: true });
  server.revokeCredential.mockResolvedValue({ ok: true });
  server.proposals.mockResolvedValue([]);
  server.generateProposals.mockResolvedValue({ created: 0, candidates: 0 });
  server.reviewProposal.mockResolvedValue({ ok: true });
  server.memoryFacts.mockResolvedValue([]);
  server.rememberFact.mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000001",
    createdAt: "2026-10-28T00:00:00Z",
  });
  server.forgetFact.mockResolvedValue({ deleted: true });
  server.companyProfile.mockResolvedValue({
    configured: false,
    profile: {
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      address: "",
      address_line_2: "",
      city: "",
      region: "",
      postal_code: "",
      country: "",
      website: "",
    },
  });
  server.saveCompanyProfile.mockResolvedValue({ company_name: "Software Vala" });
  server.issueExtensionToken.mockResolvedValue({ token: `ayra_ext_${"a".repeat(43)}`, expiresAt: "2026-10-29T21:00:00Z" });
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
    await waitFor(() =>
      expect(server.update).toHaveBeenCalledWith({
        data: { roleName: "SUPER_ADMIN", permissionKey: "allow_system_coding", isEnabled: true },
      }),
    );
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

  it("saves external tokens through the VPS-backed credential flow", async () => {
    renderCenter();
    await screen.findByRole("switch", { name: "Allow system coding" });
    fireEvent.click(screen.getByRole("tab", { name: "Connect Services" }));
    const token = await screen.findByLabelText("Personal access token");
    fireEvent.change(token, { target: { value: "github-test-token" } });
    fireEvent.submit(token.closest("form")!);
    await waitFor(() =>
      expect(server.saveCredential).toHaveBeenCalledWith({
        data: { serviceName: "github", token: "github-test-token" },
      }),
    );
  });

  it("loads prompt proposals only after opening the self-improvement tab", async () => {
    renderCenter();
    await screen.findByRole("switch", { name: "Allow system coding" });
    fireEvent.click(screen.getByRole("tab", { name: "Self Improvement" }));
    expect(
      await screen.findByText("No eligible verified low-success agents or pending proposals."),
    ).toBeTruthy();
    expect(server.proposals).toHaveBeenCalled();
  });

  it("loads private memories and exposes forget controls", async () => {
    server.memoryFacts.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000001",
        content: "Use IST for reporting.",
        createdAt: "2026-10-28T00:00:00Z",
      },
    ]);
    renderCenter();
    await screen.findByRole("switch", { name: "Allow system coding" });
    fireEvent.click(screen.getByRole("tab", { name: "Long-Term Memory" }));
    expect(await screen.findByText("Use IST for reporting.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Forget" }));
    await waitFor(() =>
      expect(server.forgetFact).toHaveBeenCalledWith({
        data: { id: "00000000-0000-4000-8000-000000000001" },
      }),
    );
  });

  it("loads and saves company details from the VPS-backed profile", async () => {
    renderCenter();
    await screen.findByRole("switch", { name: "Allow system coding" });
    fireEvent.click(screen.getByRole("tab", { name: "Company Profile" }));
    const name = await screen.findByLabelText("Company name *");
    fireEvent.change(name, { target: { value: "Software Vala" } });
    fireEvent.change(screen.getByLabelText("Business email"), {
      target: { value: "hello@softwarevala.net" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save company profile" }));
    await waitFor(() =>
      expect(server.saveCompanyProfile).toHaveBeenCalledWith({
        data: expect.objectContaining({
          company_name: "Software Vala",
          email: "hello@softwarevala.net",
        }),
      }),
    );
  });

  it("downloads the extension and creates a short-lived connection token for a saved profile", async () => {
    server.companyProfile.mockResolvedValueOnce({
      configured: true,
      profile: {
        company_name: "Software Vala",
        contact_name: "",
        email: "",
        phone: "",
        address: "",
        address_line_2: "",
        city: "",
        region: "",
        postal_code: "",
        country: "",
        website: "",
      },
    });
    renderCenter();
    await screen.findByRole("switch", { name: "Allow system coding" });
    fireEvent.click(screen.getByRole("tab", { name: "Company Profile" }));
    const download = await screen.findByRole("link", { name: "Download extension (.zip)" });
    expect(download.getAttribute("href")).toBe("/downloads/ayra-extension.zip");
    fireEvent.click(screen.getByRole("button", { name: "Generate 24-hour connection token" }));
    await waitFor(() => expect(server.issueExtensionToken).toHaveBeenCalledOnce());
    expect(await screen.findByText(/Copy this token into the extension popup/)).toBeTruthy();
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
