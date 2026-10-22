import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "./supabase/types";
import { REQUEST_PDF_LIMIT } from "./public-request";

const state = vi.hoisted(() => ({
  confirmed: true,
  authStatus: 200,
  dailyCount: 0 as number | null,
  failTable: "",
  mailSent: false,
  mailQueued: true,
  rows: [] as { id: string; public_request_id: string; contact_email: string; details: unknown }[],
  requests: [] as { url: URL; method: string; body: unknown; headers: Headers }[],
  send: vi.fn(),
}));
vi.mock("@/lib/commerce/mailer", () => ({
  send: async (message: unknown) => {
    state.send(message);
    return { sent: state.mailSent, queued: state.mailQueued, reason: "fixture" };
  },
}));
vi.mock("./supabase/client.server", () => ({
  supabaseAdmin: createClient<Database>("https://request-fixture.invalid", "fixture-admin-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init),
          url = new URL(request.url);
        const body: unknown = request.headers.get("content-type")?.includes("application/json")
          ? await request.json()
          : request.method === "POST"
            ? await request.arrayBuffer()
            : null;
        state.requests.push({ url, method: request.method, body, headers: request.headers });
        const table = url.pathname.split("/").at(-1);
        if (table === state.failTable)
          return Response.json(
            { code: "42501", message: "Fixture backend refused" },
            { status: 403 },
          );
        if (url.pathname.startsWith("/storage/v1/object/rd-attachments/"))
          return Response.json({ Key: "private-fixture" });
        if (table === "rd_opportunities") {
          if (request.method === "HEAD")
            return new Response(null, {
              headers:
                state.dailyCount === null ? {} : { "content-range": `*/${state.dailyCount}` },
            });
          if (request.method === "GET") {
            const id = url.searchParams.get("id")?.replace(/^eq\./, "");
            return Response.json(state.rows.filter((row) => row.id === id));
          }
          const row = body;
          if (
            !row ||
            typeof row !== "object" ||
            !("id" in row) ||
            typeof row.id !== "string" ||
            !("public_request_id" in row) ||
            typeof row.public_request_id !== "string" ||
            !("contact_email" in row) ||
            typeof row.contact_email !== "string" ||
            !("details" in row)
          )
            throw new Error("Unexpected fixture insert");
          if (state.rows.some((prior) => prior.id === row.id))
            return Response.json(
              { code: "23505", message: "Duplicate fixture ID" },
              { status: 409 },
            );
          state.rows.push({
            id: row.id,
            public_request_id: row.public_request_id,
            contact_email: row.contact_email,
            details: row.details,
          });
          return new Response(null, { status: 201 });
        }
        if (table === "rd_opportunity_events" || table === "rnd_notifications")
          return new Response(null, { status: 201 });
        throw new Error(`Unexpected request fixture operation: ${url.pathname}`);
      },
    },
  }),
}));
import { handleSoftwareRequest } from "./public-request.server";

const submissionId = "a0000000-0000-4000-8000-000000000001";
beforeEach(() => {
  Object.assign(state, {
    confirmed: true,
    authStatus: 200,
    dailyCount: 0,
    failTable: "",
    mailSent: false,
    mailQueued: true,
    rows: [],
    requests: [],
  });
  state.send.mockClear();
  vi.stubEnv("SUPABASE_URL", "https://request-fixture.invalid");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture-public-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      const request = new Request(input, init);
      expect(request.url).toBe("https://request-fixture.invalid/auth/v1/user");
      expect(request.headers.get("apikey")).toBe("fixture-public-key");
      expect(request.headers.get("authorization")).toBe("Bearer fixture-user-token");
      if (state.authStatus !== 200) return Response.json({}, { status: state.authStatus });
      return Response.json({
        id: "b0000000-0000-4000-8000-000000000001",
        email: "Requester@Example.invalid",
        email_confirmed_at: state.confirmed ? "2026-10-15T00:00:00Z" : null,
      });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function request(
  text = "Pasted WhatsApp text\n• POS & inventory <script>not markup</script>",
  pdf?: File,
) {
  const body = new FormData();
  body.set("submissionId", submissionId);
  body.set("text", text);
  body.set("email", "untrusted@example.invalid");
  if (pdf) body.set("pdf", pdf);
  return new Request("https://softwarevala.net/api/rd-request", {
    method: "POST",
    headers: { Authorization: "Bearer fixture-user-token" },
    body,
  });
}
const pdf = () =>
  new File(["%PDF-1.7\nprivate requirements"], "requirements.pdf", { type: "application/pdf" });

describe("verified public software inquiry", () => {
  it("saves untouched text using verified email and assigns the actual shared R&D inbox", async () => {
    const response = await handleSoftwareRequest(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      assignedTo: "R&D Team",
      confirmation: "queued",
      repeated: false,
    });
    const insert = state.requests.find(
      (row) => row.method === "POST" && row.url.pathname.endsWith("/rd_opportunities"),
    );
    expect(insert?.body).toMatchObject({
      id: submissionId,
      description: "Pasted WhatsApp text\r\n• POS & inventory <script>not markup</script>",
      contact_email: "requester@example.invalid",
      assigned_to: "R&D Team",
      type: "SOFTWARE_ON_DEMAND",
      source: "homepage_request",
    });
    expect(state.requests.filter((row) => row.method === "POST")).toHaveLength(3);
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "Requester@Example.invalid" }),
    );
  });

  it("accepts PDF-only requests and keeps attachments in the existing private bucket", async () => {
    const response = await handleSoftwareRequest(request("", pdf()));
    expect(response.status).toBe(201);
    const upload = state.requests.find((row) => row.url.pathname.includes("/storage/v1/object/"));
    expect(upload?.url.pathname).toContain(`/rd-attachments/pending/${submissionId}/`);
    expect(upload?.headers.get("content-type")).toContain("application/pdf");
    const insert = state.requests.find(
      (row) => row.url.pathname.endsWith("/rd_opportunities") && row.method === "POST",
    );
    expect(insert?.body).toMatchObject({
      title: "requirements.pdf",
      attachments: [expect.objectContaining({ type: "application/pdf", name: "requirements.pdf" })],
    });
  });

  it("does not duplicate inquiries or confirmation mail on a repeated submission", async () => {
    const first = await handleSoftwareRequest(request("Same request", pdf()));
    const second = await handleSoftwareRequest(request("Same request", pdf()));
    expect(first.status).toBe(201);
    expect(await second.json()).toMatchObject({ repeated: true, confirmation: "unavailable" });
    expect(state.rows).toHaveLength(1);
    expect(state.send).toHaveBeenCalledOnce();
    expect((await handleSoftwareRequest(request("Changed request"))).status).toBe(409);
  });

  it("does not expose another submitter's reference", async () => {
    await handleSoftwareRequest(request());
    state.rows[0].contact_email = "another@example.invalid";
    const response = await handleSoftwareRequest(request());
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain(state.rows[0].public_request_id);
  });

  it("denies unsigned, expired and unverified sessions before any database operation", async () => {
    expect(
      (
        await handleSoftwareRequest(
          new Request("https://softwarevala.net/api/rd-request", { method: "POST" }),
        )
      ).status,
    ).toBe(401);
    state.confirmed = false;
    expect((await handleSoftwareRequest(request())).status).toBe(403);
    state.authStatus = 401;
    expect((await handleSoftwareRequest(request())).status).toBe(401);
    expect(state.requests).toEqual([]);
  });

  it("refuses unavailable auth instead of trusting a client-side verified flag", async () => {
    state.authStatus = 503;
    expect((await handleSoftwareRequest(request())).status).toBe(503);
    expect(state.rows).toEqual([]);
  });

  it("rejects an empty request and non-PDF bytes", async () => {
    expect((await handleSoftwareRequest(request(""))).status).toBe(400);
    expect(
      (await handleSoftwareRequest(request("", new File(["<html>"], "fake.pdf")))).status,
    ).toBe(400);
    expect(
      (await handleSoftwareRequest(request("", new File(["%PDF-1.7"], "document.docx")))).status,
    ).toBe(400);
    expect(state.requests).toEqual([]);
  });

  it("checks the actual multipart size and the PDF size", async () => {
    const oversized = new File([new Uint8Array(REQUEST_PDF_LIMIT + 1)], "large.pdf");
    expect((await handleSoftwareRequest(request("", oversized))).status).toBe(413);
    const req = request();
    req.headers.set("content-length", String(REQUEST_PDF_LIMIT + 1024 * 1024));
    expect((await handleSoftwareRequest(req)).status).toBe(413);
    expect(state.rows).toEqual([]);
  });

  it("rejects ambiguous duplicate multipart fields", async () => {
    const original = request();
    const body = await original.formData();
    body.append("text", "Different text");
    const response = await handleSoftwareRequest(
      new Request("https://softwarevala.net/api/rd-request", {
        method: "POST",
        headers: { Authorization: original.headers.get("authorization")! },
        body,
      }),
    );
    expect(response.status).toBe(400);
    expect(state.requests).toEqual([]);
  });

  it("refuses an unavailable quota count instead of treating it as zero", async () => {
    state.dailyCount = null;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await handleSoftwareRequest(request())).status).toBe(503);
    expect(state.rows).toEqual([]);
    expect(log).toHaveBeenCalled();
  });

  it("fails explicitly when the database throttle query fails", async () => {
    state.dailyCount = 10;
    expect((await handleSoftwareRequest(request())).status).toBe(429);
    state.failTable = "rd_opportunities";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await handleSoftwareRequest(request())).status).toBe(503);
    expect(state.send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it.each([
    { sent: true, queued: true, expected: "sent" },
    { sent: false, queued: false, expected: "unavailable" },
  ])(
    "reports actual confirmation delivery state: $expected",
    async ({ sent, queued, expected }) => {
      state.mailSent = sent;
      state.mailQueued = queued;
      const response = await handleSoftwareRequest(request());
      expect((await response.json()).confirmation).toBe(expected);
    },
  );
});
