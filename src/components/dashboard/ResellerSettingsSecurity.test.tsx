// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  listDocuments: vi.fn(),
  registerDocument: vi.fn(),
  saveSettings: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  unenroll: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/reseller-dashboard.functions", () => ({
  getResellerAccountSettings: mocks.getSettings,
  listResellerKycDocuments: mocks.listDocuments,
  registerResellerKycDocument: mocks.registerDocument,
  saveResellerAccountSettings: mocks.saveSettings,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
      mfa: {
        listFactors: mocks.listFactors,
        enroll: mocks.enroll,
        challenge: mocks.challenge,
        verify: mocks.verify,
        unenroll: mocks.unenroll,
      },
    },
    storage: {
      from: vi.fn(() => ({ upload: mocks.upload, remove: mocks.remove })),
    },
  },
}));

import { ResellerSettingsSecurity } from "./ResellerSettingsSecurity";

function renderFeature(featureKey: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ResellerSettingsSecurity featureKey={featureKey} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mocks.getSettings.mockReset();
  mocks.listDocuments.mockReset();
  mocks.registerDocument.mockReset();
  mocks.saveSettings.mockReset();
  mocks.updateUser.mockReset();
  mocks.getUser.mockReset();
  mocks.listFactors.mockReset();
  mocks.enroll.mockReset();
  mocks.challenge.mockReset();
  mocks.verify.mockReset();
  mocks.unenroll.mockReset();
  mocks.upload.mockReset();
  mocks.remove.mockReset();
});

const account = {
  profile: {
    resellerId: "reseller-1",
    name: "Riya",
    email: "riya@example.test",
    phone: "12345",
    companyName: "Riya Systems",
    legalName: "Riya Systems Pvt Ltd",
    gstNumber: "",
    panNumber: "",
    region: "India",
    kycStatus: "unverified",
  },
  settings: {
    timezone: "Asia/Kolkata",
    companyAddress: "",
    payoutMethod: "bank",
    bankAccountHolder: "",
    bankName: "",
    bankAccountNumber: "",
    bankIfsc: "",
    upiVpa: "",
  },
};

describe("Reseller settings and security", () => {
  it("persists profile edits through the reseller settings handler", async () => {
    mocks.getSettings.mockResolvedValue(account);
    mocks.saveSettings.mockResolvedValue({ success: true });
    renderFeature("profile");

    fireEvent.change(await screen.findByLabelText("Full name"), {
      target: { value: "Riya Shah" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Profile" }));

    await waitFor(() =>
      expect(mocks.saveSettings).toHaveBeenCalledWith({
        data: { name: "Riya Shah", phone: "12345", timezone: "Asia/Kolkata" },
      }),
    );
  });

  it("saves payout account details and IFSC through the owner-scoped handler", async () => {
    mocks.getSettings.mockResolvedValue(account);
    mocks.saveSettings.mockResolvedValue({ success: true });
    renderFeature("bank");

    fireEvent.change(await screen.findByLabelText("Account holder name"), {
      target: { value: "Riya Shah" },
    });
    fireEvent.change(screen.getByLabelText("Bank name"), { target: { value: "Example Bank" } });
    fireEvent.change(screen.getByLabelText("Account number"), { target: { value: "1234567890" } });
    fireEvent.change(screen.getByLabelText("IFSC code"), { target: { value: "ABCD0123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Bank Details" }));

    await waitFor(() =>
      expect(mocks.saveSettings).toHaveBeenCalledWith({
        data: {
          bankAccountHolder: "Riya Shah",
          bankName: "Example Bank",
          bankAccountNumber: "1234567890",
          bankIfsc: "ABCD0123456",
        },
      }),
    );
  });

  it("persists company identity and address settings", async () => {
    mocks.getSettings.mockResolvedValue(account);
    mocks.saveSettings.mockResolvedValue({ success: true });
    renderFeature("company");

    fireEvent.change(await screen.findByLabelText("Legal name"), {
      target: { value: "Riya Systems Private Limited" },
    });
    fireEvent.change(screen.getByLabelText("Company address"), {
      target: { value: "Pune, Maharashtra" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Company Details" }));

    await waitFor(() =>
      expect(mocks.saveSettings).toHaveBeenCalledWith({
        data: expect.objectContaining({
          legalName: "Riya Systems Private Limited",
          companyAddress: "Pune, Maharashtra",
        }),
      }),
    );
  });

  it("saves the reseller's UPI payout address", async () => {
    mocks.getSettings.mockResolvedValue(account);
    mocks.saveSettings.mockResolvedValue({ success: true });
    renderFeature("upi");

    fireEvent.change(await screen.findByLabelText("UPI ID / VPA"), {
      target: { value: "riya@bank" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save UPI Details" }));

    await waitFor(() =>
      expect(mocks.saveSettings).toHaveBeenCalledWith({
        data: { upiVpa: "riya@bank" },
      }),
    );
  });

  it("updates the signed-in account password and clears the fields on success", async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    renderFeature("password");

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "a-long-enough-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "a-long-enough-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({
        password: "a-long-enough-password",
      }),
    );
    expect((screen.getByLabelText("New password") as HTMLInputElement).value).toBe("");
  });

  it("enrolls and verifies an authenticator factor before showing 2FA as enabled", async () => {
    mocks.listFactors
      .mockResolvedValueOnce({ data: { totp: [] }, error: null })
      .mockResolvedValueOnce({
        data: { totp: [{ id: "factor-1", friendly_name: "Authenticator" }] },
        error: null,
      });
    mocks.enroll.mockResolvedValue({
      data: { id: "factor-1", totp: { qr_code: "data:image/svg+xml,test" } },
      error: null,
    });
    mocks.challenge.mockResolvedValue({ data: { id: "challenge-1" }, error: null });
    mocks.verify.mockResolvedValue({ error: null });
    renderFeature("2fa");

    fireEvent.click(await screen.findByRole("button", { name: "Set up authenticator" }));
    expect(
      await screen.findByAltText("Scan this QR code with your authenticator app"),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and Enable 2FA" }));

    await waitFor(() =>
      expect(mocks.verify).toHaveBeenCalledWith({
        factorId: "factor-1",
        challengeId: "challenge-1",
        code: "123456",
      }),
    );
    const enabledFactor = await screen.findByText("Reseller dashboard authenticator");
    expect(enabledFactor.parentElement?.textContent).toContain("enabled");
  });

  it("uploads KYC files to the private owner path and registers the document", async () => {
    mocks.getSettings.mockResolvedValue(account);
    mocks.listDocuments.mockResolvedValue([]);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.upload.mockResolvedValue({ data: { path: "stored" }, error: null });
    mocks.registerDocument.mockResolvedValue({ success: true });
    renderFeature("kyc");
    const fileInput = await screen.findByLabelText("Upload KYC Document");

    fireEvent.change(fileInput, {
      target: { files: [new File(["identity"], "identity.pdf", { type: "application/pdf" })] },
    });

    await waitFor(() =>
      expect(mocks.registerDocument).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fileName: "identity.pdf",
          mimeType: "application/pdf",
          fileSize: 8,
        }),
      }),
    );
    const path = mocks.registerDocument.mock.calls[0][0].data.storagePath;
    expect(path).toMatch(/^user-1\/reseller-1\//);
    expect(mocks.upload).toHaveBeenCalledWith(path, expect.any(File), {
      contentType: "application/pdf",
      upsert: false,
    });
  });
});
