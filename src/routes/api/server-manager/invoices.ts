import { createFileRoute } from "@tanstack/react-router";
import { jsPDF } from "jspdf";
import { bearerToken, userFromBearerToken } from "@/lib/auth/bearer-user.server";
import { parseIdempotencyKey } from "@/lib/server-manager/agent-contract";
import { formatMinorCurrency } from "@/lib/server-manager/invoice-format";
import {
  readRequestText,
  RequestBodyTooLargeError,
} from "@/lib/server-manager/request-body.server";

function config() {
  return {
    url: (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "")
      .trim()
      .replace(/\/+$/, ""),
    publishableKey: (
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      ""
    ).trim(),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
  };
}

function serviceHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function validRequest(value: unknown): value is { subscription_id: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 1 &&
    typeof record.subscription_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.subscription_id)
  );
}

export const Route = createFileRoute("/api/server-manager/invoices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { url, publishableKey, serviceKey } = config();
        if (!url || !publishableKey || !serviceKey) {
          return Response.json({ error: "Invoice generation is unavailable" }, { status: 503 });
        }
        if (
          request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !==
          "application/json"
        ) {
          return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
        }
        const token = bearerToken(request.headers.get("authorization"));
        if (!token) return Response.json({ error: "Authentication required" }, { status: 401 });
        const user = await userFromBearerToken(token);
        if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

        const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
        if (!idempotencyKey) {
          return Response.json({ error: "A UUID Idempotency-Key is required" }, { status: 400 });
        }
        let body: unknown;
        try {
          body = JSON.parse(await readRequestText(request, 2048));
        } catch (error) {
          if (error instanceof RequestBodyTooLargeError) {
            return Response.json({ error: "Invoice request is too large" }, { status: 413 });
          }
          return Response.json({ error: "Invalid JSON request" }, { status: 400 });
        }
        if (!validRequest(body)) {
          return Response.json({ error: "Invoice request fields are invalid" }, { status: 400 });
        }

        try {
          const invoiceResponse = await fetch(`${url}/rest/v1/rpc/server_create_invoice`, {
            method: "POST",
            headers: serviceHeaders(serviceKey),
            body: JSON.stringify({
              p_owner_id: user.id,
              p_subscription_id: body.subscription_id,
              p_idempotency_key: idempotencyKey,
            }),
          });
          if (!invoiceResponse.ok) {
            const errorBody = (await invoiceResponse.json().catch(() => ({}))) as {
              code?: unknown;
            };
            const status =
              errorBody.code === "P0002" ? 404 : errorBody.code === "42501" ? 403 : 422;
            return Response.json(
              { error: "Invoice could not be generated for this subscription" },
              { status },
            );
          }

          const invoice = (await invoiceResponse.json()) as {
            id?: unknown;
            invoice_code?: unknown;
            period_label?: unknown;
            period_start?: unknown;
            period_end?: unknown;
            amount_minor?: unknown;
            currency?: unknown;
            status?: unknown;
            server_name?: unknown;
            plan?: unknown;
          };
          if (
            typeof invoice.id !== "string" ||
            typeof invoice.invoice_code !== "string" ||
            typeof invoice.period_label !== "string" ||
            typeof invoice.period_start !== "string" ||
            typeof invoice.period_end !== "string" ||
            typeof invoice.amount_minor !== "number" ||
            !Number.isSafeInteger(invoice.amount_minor) ||
            invoice.amount_minor < 1 ||
            typeof invoice.currency !== "string" ||
            typeof invoice.status !== "string" ||
            typeof invoice.server_name !== "string" ||
            typeof invoice.plan !== "string"
          ) {
            return Response.json(
              { error: "Invoice data returned by the database is invalid" },
              { status: 502 },
            );
          }

          const document = new jsPDF();
          document.setFontSize(20);
          document.text("Software Vala Server Manager", 20, 24);
          document.setFontSize(14);
          document.text("Subscription invoice", 20, 36);
          document.setFontSize(10);
          document.text(`Invoice: ${invoice.invoice_code}`, 20, 50);
          document.text(`Issued: ${new Date().toISOString().slice(0, 10)}`, 20, 58);
          document.text(
            `Period: ${invoice.period_label} (${invoice.period_start} to ${invoice.period_end})`,
            20,
            66,
          );
          document.text(`Server: ${invoice.server_name}`, 20, 78);
          document.text(`Plan: ${invoice.plan}`, 20, 86);
          document.text(`Subscription status: ${String(invoice.status)}`, 20, 94);
          document.text("Line item", 20, 112);
          document.text(`${invoice.plan} subscription`, 20, 122);
          document.text(formatMinorCurrency(invoice.amount_minor, invoice.currency), 185, 122, {
            align: "right",
          });
          document.setFontSize(9);
          document.text(
            "Issued invoice document. This document does not independently verify payment settlement.",
            20,
            145,
          );
          const pdf = document.output("arraybuffer");
          const objectPath = `${user.id}/${invoice.id}.pdf`;

          const uploadResponse = await fetch(
            `${url}/storage/v1/object/server-invoices/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
            {
              method: "POST",
              headers: {
                ...serviceHeaders(serviceKey),
                "Content-Type": "application/pdf",
                "x-upsert": "true",
              },
              body: pdf,
            },
          );
          if (!uploadResponse.ok) {
            console.error("[server-manager/invoices] PDF upload failed", uploadResponse.status);
            return Response.json({ error: "Invoice PDF could not be stored" }, { status: 502 });
          }

          const pathResponse = await fetch(
            `${url}/rest/v1/server_invoices?id=eq.${encodeURIComponent(invoice.id)}&owner_id=eq.${encodeURIComponent(user.id)}`,
            {
              method: "PATCH",
              headers: { ...serviceHeaders(serviceKey), Prefer: "return=minimal" },
              body: JSON.stringify({ pdf_storage_path: objectPath }),
            },
          );
          if (!pathResponse.ok) {
            console.error("[server-manager/invoices] PDF path update failed", pathResponse.status);
            return Response.json({ error: "Invoice record could not be updated" }, { status: 502 });
          }

          const signedResponse = await fetch(
            `${url}/storage/v1/object/sign/server-invoices/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
            {
              method: "POST",
              headers: serviceHeaders(serviceKey),
              body: JSON.stringify({ expiresIn: 300 }),
            },
          );
          if (!signedResponse.ok) {
            console.error(
              "[server-manager/invoices] signed URL creation failed",
              signedResponse.status,
            );
            return Response.json(
              { error: "Invoice download link could not be created" },
              { status: 502 },
            );
          }
          const signed = (await signedResponse.json()) as { signedURL?: unknown };
          if (typeof signed.signedURL !== "string") {
            return Response.json(
              { error: "Invoice download link response is invalid" },
              { status: 502 },
            );
          }
          const downloadUrl = signed.signedURL.startsWith("http")
            ? signed.signedURL
            : `${url}/storage/v1${signed.signedURL.startsWith("/") ? "" : "/"}${signed.signedURL}`;

          return Response.json({
            invoice_id: invoice.id,
            invoice_code: invoice.invoice_code,
            amount_minor: invoice.amount_minor,
            currency: invoice.currency,
            download_url: downloadUrl,
            expires_in_seconds: 300,
          });
        } catch (error) {
          console.error("[server-manager/invoices] generation failed", error);
          return Response.json({ error: "Invoice generation failed" }, { status: 502 });
        }
      },
    },
  },
});
