import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { bearerToken } from "@/lib/auth/bearer-user.server";
import { send } from "@/lib/commerce/mailer";
import { supabaseAdmin } from "./supabase/client.server";
import {
  RD_TEAM_INBOX,
  REQUEST_PDF_LIMIT,
  softwareRequestSchema,
  type SoftwareRequestReceipt,
} from "./public-request";

class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  email_confirmed_at: z.string().datetime({ offset: true }).nullable().optional(),
});

async function verifiedRequester(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) throw new RequestError(401, "Verify your email before submitting.");
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new RequestError(503, "Email verification is temporarily unavailable.");
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401 || response.status === 403)
    throw new RequestError(401, "Your verification session expired. Verify your email again.");
  if (!response.ok) throw new RequestError(503, "Email verification is temporarily unavailable.");
  const parsed = authUserSchema.safeParse(await response.json());
  if (!parsed.success || !parsed.data.email_confirmed_at)
    throw new RequestError(403, "Please verify your email before submitting.");
  return parsed.data;
}

async function boundedForm(request: Request) {
  const maximum = REQUEST_PDF_LIMIT + 512 * 1024;
  if (Number(request.headers.get("content-length")) > maximum)
    throw new RequestError(413, "Your PDF must be 10 MB or smaller.");
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new RequestError(415, "Submit the request using the software request form.");
  if (!request.body) throw new RequestError(400, "Request content is required.");
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new RequestError(413, "Your PDF must be 10 MB or smaller.");
      }
      parts.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(parts);
  try {
    return await new Response(body, {
      headers: { "content-type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new RequestError(400, "The uploaded request could not be read.");
  }
}

function check(error: { message: string } | null, operation: string) {
  if (error) {
    console.error(`[rd-request] ${operation}: ${error.message}`);
    throw new RequestError(503, "Your request could not be completed. Please retry.");
  }
}

function escaped(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export async function handleSoftwareRequest(request: Request): Promise<Response> {
  try {
    const user = await verifiedRequester(request);
    const form = await boundedForm(request);
    if (["submissionId", "text", "pdf", "website"].some((name) => form.getAll(name).length > 1))
      throw new RequestError(400, "Submit one request and at most one PDF.");
    if (form.get("website")) throw new RequestError(400, "Submission rejected.");
    const parsed = softwareRequestSchema.safeParse({
      submissionId: form.get("submissionId"),
      text: form.get("text") ?? "",
    });
    if (!parsed.success) throw new RequestError(400, "Check your request text and try again.");
    const { submissionId, text } = parsed.data;
    const file = form.get("pdf");
    if (file !== null && !(file instanceof File)) throw new RequestError(400, "Choose a PDF file.");
    if (file && (file.size === 0 || file.size > REQUEST_PDF_LIMIT))
      throw new RequestError(413, "Choose a nonempty PDF, 10 MB or smaller.");
    if (!text.trim() && !file)
      throw new RequestError(400, "Describe your software or attach a PDF.");
    const bytes = file ? Buffer.from(await file.arrayBuffer()) : null;
    if (file && (!/\.pdf$/i.test(file.name) || bytes?.subarray(0, 5).toString() !== "%PDF-"))
      throw new RequestError(400, "Only PDF files are supported. Paste other formats as text.");
    const digest = createHash("sha256")
      .update(JSON.stringify({ text, filename: file?.name ?? null }))
      .update(bytes ?? "")
      .digest("hex");
    const email = user.email.toLowerCase();
    const db = supabaseAdmin;
    const prior = await db
      .from("rd_opportunities")
      .select("id, public_request_id, contact_email, details")
      .eq("id", submissionId)
      .maybeSingle();
    check(prior.error, "Read prior submission");
    if (prior.data) {
      const details = z.object({ submission_hash: z.string() }).safeParse(prior.data.details);
      if (
        prior.data.contact_email.toLowerCase() !== email ||
        !details.success ||
        details.data.submission_hash !== digest
      )
        throw new RequestError(
          409,
          "This submission ID has already been used. Start a new request.",
        );
      return Response.json(
        {
          requestId: prior.data.public_request_id,
          assignedTo: RD_TEAM_INBOX,
          confirmation: "unavailable",
          repeated: true,
        } satisfies SoftwareRequestReceipt,
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const day = new Date(Date.now() - 86_400_000).toISOString();
    const usage = await db
      .from("rd_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("contact_email", email)
      .gte("created_at", day);
    check(usage.error, "Check request limit");
    if (usage.count === null) {
      console.error("[rd-request] Request limit query returned no count.");
      throw new RequestError(503, "Your request limit could not be checked. Please retry.");
    }
    if (usage.count >= 10)
      throw new RequestError(429, "You have reached today's request limit. Please try tomorrow.");
    const filename = file?.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-90) || "request.pdf";
    const path = `pending/${submissionId}/0-${digest.slice(0, 16)}-${filename}`;
    if (bytes) {
      const uploaded = await db.storage.from("rd-attachments").upload(path, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      check(uploaded.error, "Upload request PDF");
    }
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let requestId = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      requestId = `SV-RD-${Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join("")}`;
      const inserted = await db.from("rd_opportunities").insert({
        id: submissionId,
        public_request_id: requestId,
        type: "SOFTWARE_ON_DEMAND",
        title:
          text
            .trim()
            .split(/\r?\n/)
            .find((line) => line.trim())
            ?.slice(0, 160) || file!.name.slice(0, 160),
        description: text,
        contact_name: user.email,
        contact_email: email,
        assigned_to: RD_TEAM_INBOX,
        source: "homepage_request",
        details: { submission_hash: digest, verified_user_id: user.id, email_verified: true },
        attachments: file
          ? [{ path, name: file.name, size: file.size, type: "application/pdf" }]
          : [],
      });
      if (inserted.error?.code === "23505") {
        const concurrent = await db
          .from("rd_opportunities")
          .select("public_request_id, contact_email, details")
          .eq("id", submissionId)
          .maybeSingle();
        check(concurrent.error, "Read concurrent submission");
        if (concurrent.data) {
          const details = z
            .object({ submission_hash: z.string() })
            .safeParse(concurrent.data.details);
          if (
            concurrent.data.contact_email.toLowerCase() !== email ||
            !details.success ||
            details.data.submission_hash !== digest
          )
            throw new RequestError(
              409,
              "This submission ID has already been used. Start a new request.",
            );
          return Response.json({
            requestId: concurrent.data.public_request_id,
            assignedTo: RD_TEAM_INBOX,
            confirmation: "unavailable",
            repeated: true,
          } satisfies SoftwareRequestReceipt);
        }
        if (attempt < 2) continue;
      }
      check(inserted.error, "Save software request");
      break;
    }
    const sideEffects = await Promise.all([
      db.from("rd_opportunity_events").insert({
        opportunity_id: submissionId,
        kind: "created",
        to_value: "NEW",
        body: "Verified homepage request received in the R&D team inbox.",
        actor: user.email,
      }),
      db.from("rnd_notifications").insert({
        type: "idea",
        title: "New software request",
        message: `${requestId} assigned to ${RD_TEAM_INBOX}`,
      }),
    ]);
    for (const effect of sideEffects) {
      if (effect.error)
        console.error(
          "[rd-request] Request saved; team notification failed:",
          effect.error.message,
        );
    }
    const mail = await send({
      to: user.email,
      subject: `Software request received: ${requestId}`,
      text: `Your request ${requestId} has been received by the R&D team. We will review it and contact you by email.`,
      html: `<p>Your request <strong>${escaped(requestId)}</strong> has been received by the R&amp;D team.</p><p>We will review it and contact you by email.</p>`,
      context: { rd_request_id: submissionId, kind: "software_request_confirmation" },
    });
    return Response.json(
      {
        requestId,
        assignedTo: RD_TEAM_INBOX,
        confirmation: mail.sent ? "sent" : mail.queued ? "queued" : "unavailable",
        repeated: false,
      } satisfies SoftwareRequestReceipt,
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RequestError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    console.error("[rd-request] Unexpected submission failure:", error);
    return Response.json(
      { error: "Your request could not be completed. Please retry." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
