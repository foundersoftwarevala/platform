import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendQueued } from "./mailer";

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://db.fixture.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-key");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("SMTP_RELAY_URL", "");
  vi.stubEnv("SMTP_RELAY_TOKEN", "");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const row = {
  id: "email-fixture",
  to_email: "applicant@fixture.invalid",
  subject: "Application decision",
  body_html: "<p>Shortlisted</p>",
  body_text: "Shortlisted",
  attempts: 0,
  updated_at: "2026-10-16T00:00:00Z",
  created_at: "2026-10-16T00:00:00Z",
};
describe("application decision email delivery", () => {
  it("does not claim delivery or drain mail without a provider", async () => {
    expect(await sendQueued(1, { id: "application", kind: "employee" })).toMatchObject({
      sent: 0,
      attempted: 0,
      reason: "no email provider configured",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("only attempts the current application's queue, never unrelated backlog", async () => {
    vi.stubEnv("RESEND_API_KEY", "fixture-provider");
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([row]))
      .mockResolvedValueOnce(Response.json({ id: "provider-fixture" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await sendQueued(1, { id: "application", kind: "employee" })).toMatchObject({
      attempted: 1,
      sent: 1,
    });
    const [url] = vi.mocked(fetch).mock.calls[0];
    const params = new URL(String(url)).searchParams;
    expect(params.get("context->>application_id")).toBe("eq.application");
    expect(params.get("context->>application_kind")).toBe("eq.employee");
    const [, patch] = vi.mocked(fetch).mock.calls[2];
    expect(JSON.parse(String(patch?.body))).toMatchObject({ status: "sent", attempts: 1 });
  });
  it("keeps provider failures pending with the real reason", async () => {
    vi.stubEnv("RESEND_API_KEY", "fixture-provider");
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([row]))
      .mockResolvedValueOnce(new Response("Provider unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await sendQueued(1, { id: "application", kind: "employee" })).toMatchObject({
      sent: 0,
      retrying: 1,
    });
    const [, patch] = vi.mocked(fetch).mock.calls[2];
    expect(JSON.parse(String(patch?.body))).toMatchObject({
      status: "pending",
      last_error: "Provider unavailable",
    });
  });
  it("does not report success when recording the delivery outcome fails", async () => {
    vi.stubEnv("RESEND_API_KEY", "fixture-provider");
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([row]))
      .mockResolvedValueOnce(Response.json({ id: "provider-fixture" }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(sendQueued(1, { id: "application", kind: "employee" })).rejects.toThrow(
      /verify before retrying/,
    );
  });
});
