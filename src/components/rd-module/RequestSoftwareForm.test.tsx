// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  verified: false,
  loading: false,
  send: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isLoading: state.loading,
    user: state.verified
      ? { email: "verified@example.invalid", email_confirmed_at: "2026-10-15T00:00:00Z" }
      : null,
    session: state.verified ? { access_token: "fixture-user-token" } : null,
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithOtp: state.send } },
}));
import { RequestSoftwareForm } from "./RequestSoftwareForm";

beforeEach(() => {
  state.verified = false;
  state.loading = false;
  state.send.mockReset().mockResolvedValue({ error: null });
  state.fetch.mockReset().mockResolvedValue(
    Response.json(
      {
        requestId: "SV-RD-ABCDEF",
        assignedTo: "R&D Team",
        confirmation: "queued",
        repeated: false,
      },
      { status: 201 },
    ),
  );
  vi.stubGlobal("fetch", state.fetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("minimal public request form", () => {
  it("uses the existing email magic link without a password or signup form", async () => {
    render(<RequestSoftwareForm />);
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reader@example.invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send verification link" }));
    await waitFor(() =>
      expect(state.send).toHaveBeenCalledWith({
        email: "reader@example.invalid",
        options: { emailRedirectTo: `${window.location.origin}/request-software` },
      }),
    );
    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      expect.stringContaining("Check your email"),
    );
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("shows verification delivery errors and never claims a link was sent", async () => {
    state.send.mockResolvedValue({ error: new Error("Email service unavailable") });
    render(<RequestSoftwareForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "reader@example.invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send verification link" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Email service unavailable",
    );
    expect(screen.queryByText(/Check your email/)).toBeNull();
  });
  it("preserves pasted text and sends the user's session, not an operator credential", async () => {
    state.verified = true;
    render(<RequestSoftwareForm />);
    fireEvent.change(screen.getByLabelText("What software do you need?"), {
      target: { value: "WhatsApp paste\nAny format: <tag> & budget" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    await screen.findByText("Your request has been received");
    const [url, init] = state.fetch.mock.calls[0];
    expect(url).toBe("/api/rd-request");
    expect(init.headers.Authorization).toBe("Bearer fixture-user-token");
    expect(init.body.get("text")).toBe("WhatsApp paste\nAny format: <tag> & budget");
    expect(screen.getByRole("status").textContent).toContain("queued for delivery");
    expect(screen.queryByText("Your confirmation email was sent.")).toBeNull();
  });
  it("retains the same submission ID and text across a failed network retry", async () => {
    state.verified = true;
    state.fetch.mockRejectedValueOnce(new Error("Offline"));
    render(<RequestSoftwareForm />);
    fireEvent.change(screen.getByLabelText("What software do you need?"), {
      target: { value: "My requirements" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    await screen.findByText("Your request has been received");
    expect(state.fetch.mock.calls[0][1].body.get("submissionId")).toBe(
      state.fetch.mock.calls[1][1].body.get("submissionId"),
    );
  });
});
