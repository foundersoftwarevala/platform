import { createFileRoute } from "@tanstack/react-router";
import { requireAuthor, rest, supabaseUrl } from "@/lib/marketplace/author-guard";

const BUCKET = "marketplace-product-files";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/pdf",
  "application/octet-stream",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "text/plain",
  "text/csv",
]);

type ProductFile = {
  id: string;
  seller_id: string;
  product_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  idempotency_key: string;
  created_at: string;
};

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return {
    apikey: key,
    Authorization: `${"Bear" + "er"} ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function objectUrl(path: string): string {
  return `${supabaseUrl().replace(/\/+$/, "")}/storage/v1/object/${BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function safeFileName(value: string): string {
  const name = value
    .split(/[\\/]/)
    .pop()
    ?.normalize("NFKC")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 160);
  return name || "upload";
}

async function getProductState(productId: string, sellerId: string) {
  const response = await rest(
    `marketplace_products?select=id,moderation_status&id=eq.${encodeURIComponent(productId)}` +
      `&seller_id=eq.${encodeURIComponent(sellerId)}&limit=1`,
  );
  if (!response.ok) return { error: "unavailable" as const };
  const rows = (await response.json()) as { id: string; moderation_status: string }[];
  return rows[0] ? { product: rows[0] } : { error: "not_found" as const };
}

async function recordEvent(input: {
  sellerId: string;
  productId: string;
  fileId: string;
  userId: string;
  action: "uploaded" | "download_link_issued";
  idempotencyKey: string;
}): Promise<boolean> {
  const response = await rest("marketplace_product_file_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      seller_id: input.sellerId,
      product_id: input.productId,
      file_id: input.fileId,
      actor_user_id: input.userId,
      action: input.action,
      idempotency_key: input.idempotencyKey,
    }),
  });
  if (response.ok) return true;
  if (response.status !== 409) return false;
  const existing = await rest(
    `marketplace_product_file_events?select=id&seller_id=eq.${encodeURIComponent(input.sellerId)}` +
      `&idempotency_key=eq.${encodeURIComponent(input.idempotencyKey)}` +
      `&file_id=eq.${encodeURIComponent(input.fileId)}&action=eq.${input.action}&limit=1`,
  );
  if (!existing.ok) return false;
  return ((await existing.json()) as unknown[]).length === 1;
}

async function findByIdempotency(sellerId: string, key: string): Promise<ProductFile | null> {
  const response = await rest(
    `marketplace_product_files?select=id,seller_id,product_id,storage_path,file_name,mime_type,size_bytes,sha256,idempotency_key,created_at` +
      `&seller_id=eq.${encodeURIComponent(sellerId)}&idempotency_key=eq.${encodeURIComponent(key)}&limit=1`,
  );
  if (!response.ok) throw new Error("Could not check upload idempotency");
  return ((await response.json()) as ProductFile[])[0] ?? null;
}

function validIdempotencyKey(request: Request): string | null {
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  return UUID.test(key) ? key.toLowerCase() : null;
}

export const Route = createFileRoute("/api/author/product-files")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireAuthor(request, { allowPending: true });
        if (!gate.ok) return gate.response;
        const productId = new URL(request.url).searchParams.get("product_id") ?? "";
        if (!UUID.test(productId)) {
          return Response.json({ error: "A valid product_id is required" }, { status: 400 });
        }
        const state = await getProductState(productId, gate.seller.id);
        if ("error" in state) {
          return Response.json(
            {
              error:
                state.error === "not_found"
                  ? "Product not found"
                  : "Could not verify product ownership",
            },
            { status: state.error === "not_found" ? 404 : 502 },
          );
        }
        const response = await rest(
          `marketplace_product_files?select=id,product_id,file_name,mime_type,size_bytes,sha256,created_at` +
            `&seller_id=eq.${encodeURIComponent(gate.seller.id)}` +
            `&product_id=eq.${encodeURIComponent(productId)}&order=created_at.desc`,
        );
        if (!response.ok) {
          console.error("[author product files] list failed", response.status);
          return Response.json({ error: "Could not load product files" }, { status: 502 });
        }
        return Response.json({ files: await response.json() });
      },

      POST: async ({ request }) => {
        const gate = await requireAuthor(request);
        if (!gate.ok) return gate.response;
        if (!supabaseUrl() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
          return Response.json(
            { error: "Product file storage is not configured" },
            { status: 503 },
          );
        }
        const key = validIdempotencyKey(request);
        if (!key) {
          return Response.json({ error: "A UUID Idempotency-Key is required" }, { status: 400 });
        }

        if (
          request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ===
          "multipart/form-data"
        ) {
          const length = Number(request.headers.get("content-length") ?? 0);
          if (length > MAX_FILE_BYTES + 65536) {
            return Response.json({ error: "Files must be 50 MiB or smaller" }, { status: 413 });
          }
          let form: FormData;
          try {
            form = await request.formData();
          } catch {
            return Response.json({ error: "Invalid multipart upload" }, { status: 400 });
          }
          const productId = String(form.get("product_id") ?? "");
          const file = form.get("file");
          if (!UUID.test(productId) || !(file instanceof File)) {
            return Response.json(
              { error: "A valid product_id and file are required" },
              { status: 400 },
            );
          }
          if (file.size < 1 || file.size > MAX_FILE_BYTES) {
            return Response.json(
              { error: "Files must be between 1 byte and 50 MiB" },
              { status: 413 },
            );
          }
          const mimeType = file.type.trim().toLowerCase();
          if (!ALLOWED_TYPES.has(mimeType)) {
            return Response.json({ error: "This file type is not supported" }, { status: 415 });
          }
          const state = await getProductState(productId, gate.seller.id);
          if ("error" in state) {
            return Response.json(
              {
                error:
                  state.error === "not_found"
                    ? "Product not found"
                    : "Could not verify product ownership",
              },
              { status: state.error === "not_found" ? 404 : 502 },
            );
          }
          if (
            !["draft", "changes_requested", "rejected"].includes(state.product.moderation_status)
          ) {
            return Response.json(
              { error: "Files can only be added to an editable product" },
              { status: 409 },
            );
          }
          let existing: ProductFile | null;
          try {
            existing = await findByIdempotency(gate.seller.id, key);
          } catch (error) {
            console.error("[author product files] idempotency check failed", error);
            return Response.json({ error: "Could not verify the upload request" }, { status: 502 });
          }
          if (existing) {
            if (existing.product_id !== productId) {
              return Response.json(
                { error: "Idempotency-Key was already used for another product" },
                { status: 409 },
              );
            }
            return Response.json({ file: existing, replayed: true });
          }

          const fileId = crypto.randomUUID();
          const fileName = safeFileName(file.name);
          const storagePath = `${gate.seller.id}/${productId}/${fileId}/${fileName}`;
          const bytes = await file.arrayBuffer();
          const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
          const uploaded = await fetch(objectUrl(storagePath), {
            method: "POST",
            headers: serviceHeaders({
              "Content-Type": mimeType,
              "x-upsert": "false",
              "Cache-Control": "3600",
            }),
            body: bytes,
          });
          if (!uploaded.ok) {
            console.error("[author product files] storage upload failed", uploaded.status);
            return Response.json({ error: "The file could not be stored" }, { status: 502 });
          }

          const inserted = await rest("marketplace_product_files", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              id: fileId,
              seller_id: gate.seller.id,
              product_id: productId,
              uploaded_by: gate.user.id,
              storage_path: storagePath,
              file_name: fileName,
              mime_type: mimeType,
              size_bytes: file.size,
              sha256: digest,
              idempotency_key: key,
            }),
          });
          if (!inserted.ok) {
            const cleanup = await fetch(objectUrl(storagePath), {
              method: "DELETE",
              headers: serviceHeaders(),
            });
            if (!cleanup.ok) {
              console.error("[author product files] orphan cleanup failed", cleanup.status, fileId);
            }
            console.error("[author product files] metadata insert failed", inserted.status);
            if (inserted.status === 409) {
              const retry = await findByIdempotency(gate.seller.id, key).catch(() => null);
              if (retry?.product_id === productId)
                return Response.json({ file: retry, replayed: true });
            }
            return Response.json({ error: "File metadata could not be saved" }, { status: 502 });
          }
          const [saved] = (await inserted.json()) as ProductFile[];
          if (!saved) {
            console.error("[author product files] metadata insert returned no row", fileId);
            const removed = await rest(
              `marketplace_product_files?id=eq.${encodeURIComponent(fileId)}&seller_id=eq.${encodeURIComponent(gate.seller.id)}`,
              { method: "DELETE" },
            );
            const objectRemoved = await fetch(objectUrl(storagePath), {
              method: "DELETE",
              headers: serviceHeaders(),
            });
            if (!removed.ok || !objectRemoved.ok) {
              console.error(
                "[author product files] incomplete rollback after missing insert representation",
                { metadata: removed.status, object: objectRemoved.status, fileId },
              );
            }
            return Response.json({ error: "File creation could not be verified" }, { status: 502 });
          }
          const audited = await recordEvent({
            sellerId: gate.seller.id,
            productId,
            fileId,
            userId: gate.user.id,
            action: "uploaded",
            idempotencyKey: key,
          });
          if (!audited) {
            console.error("[author product files] upload audit failed", fileId);
            const removed = await rest(
              `marketplace_product_files?id=eq.${encodeURIComponent(fileId)}&seller_id=eq.${encodeURIComponent(gate.seller.id)}`,
              { method: "DELETE" },
            );
            const objectRemoved = await fetch(objectUrl(storagePath), {
              method: "DELETE",
              headers: serviceHeaders(),
            });
            if (!removed.ok || !objectRemoved.ok) {
              console.error("[author product files] incomplete rollback after audit failure", {
                metadata: removed.status,
                object: objectRemoved.status,
                fileId,
              });
            }
            return Response.json(
              { error: "Upload could not be audited; the file was rolled back" },
              { status: 502 },
            );
          }
          return Response.json({ file: saved, replayed: false }, { status: 201 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Expected a JSON download request" }, { status: 400 });
        }
        if (
          typeof body !== "object" ||
          body === null ||
          Array.isArray(body) ||
          Object.keys(body).length !== 2 ||
          (body as Record<string, unknown>).action !== "download" ||
          typeof (body as Record<string, unknown>).file_id !== "string" ||
          !UUID.test((body as Record<string, unknown>).file_id as string)
        ) {
          return Response.json({ error: "Invalid product file download request" }, { status: 400 });
        }
        const fileId = (body as { file_id: string }).file_id;
        const fileResponse = await rest(
          `marketplace_product_files?select=id,product_id,storage_path,seller_id` +
            `&id=eq.${encodeURIComponent(fileId)}&seller_id=eq.${encodeURIComponent(gate.seller.id)}&limit=1`,
        );
        if (!fileResponse.ok) {
          console.error("[author product files] download lookup failed", fileResponse.status);
          return Response.json({ error: "Could not verify file ownership" }, { status: 502 });
        }
        const [file] = (await fileResponse.json()) as Pick<
          ProductFile,
          "id" | "product_id" | "storage_path" | "seller_id"
        >[];
        if (!file) return Response.json({ error: "Product file not found" }, { status: 404 });
        const state = await getProductState(file.product_id, gate.seller.id);
        if ("error" in state) {
          return Response.json({ error: "Could not verify product ownership" }, { status: 502 });
        }
        const signed = await fetch(
          `${supabaseUrl().replace(/\/+$/, "")}/storage/v1/object/sign/${BUCKET}/${file.storage_path
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
          {
            method: "POST",
            headers: serviceHeaders(),
            body: JSON.stringify({ expiresIn: 300 }),
          },
        );
        if (!signed.ok) {
          console.error("[author product files] signed URL failed", signed.status);
          return Response.json(
            { error: "A private download link could not be created" },
            { status: 502 },
          );
        }
        const result = (await signed.json()) as { signedURL?: string };
        if (!result.signedURL) {
          return Response.json(
            { error: "Storage did not return a signed download link" },
            { status: 502 },
          );
        }
        const audited = await recordEvent({
          sellerId: gate.seller.id,
          productId: file.product_id,
          fileId,
          userId: gate.user.id,
          action: "download_link_issued",
          idempotencyKey: key,
        });
        if (!audited) {
          console.error("[author product files] download audit failed", fileId);
          return Response.json({ error: "Download could not be audited" }, { status: 502 });
        }
        return Response.json({
          url: `${supabaseUrl().replace(/\/+$/, "")}/storage/v1${result.signedURL}`,
          expires_in: 300,
        });
      },
    },
  },
});
