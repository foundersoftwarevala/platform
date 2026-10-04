import { createHash, randomUUID } from "node:crypto";

import { documentFields, extensionFor, MAX_DOCUMENT_BYTES, sniffDocumentType } from "./documents";
import { serviceRest } from "./gateway.server";
import type { ApplicationKind } from "./registry.server";

/**
 * Application documents: stored as files, recorded as rows, handed out only to
 * the people entitled to them.
 *
 * The files live in a private bucket in Storage (the hosted project, where the
 * platform's other private buckets are). The server writes and reads them with
 * a storage key of its own; no browser ever gets a lasting link to one. A
 * download is streamed through the server after it has checked who is asking.
 */

export const DOCUMENT_BUCKET = "application-documents";

function storageBase(): string {
  return (process.env.SUPABASE_STORAGE_URL ?? process.env.SUPABASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
}

function storageKey(): string {
  return process.env.SUPABASE_STORAGE_SERVICE_KEY?.trim() ?? "";
}

export function storageConfigured(): boolean {
  return Boolean(storageBase() && storageKey());
}

function storageHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = storageKey();
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

export type StoredDocument = {
  id: string;
  field: string;
  name: string;
  mime: string;
  size: number;
};

export type DocumentFailure = { error: string; status: number };

/** A file name kept for display: the base name only, printable, bounded. */
function cleanName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  const printable = base.replace(/[^\p{L}\p{N}._ ()-]+/gu, "_").trim();
  return (printable || "document").slice(0, 160);
}

export async function storeDocument(input: {
  kind: ApplicationKind;
  applicationId: string;
  ownerUserId: string;
  field: string;
  file: File;
}): Promise<StoredDocument | DocumentFailure> {
  if (!storageConfigured()) {
    return { error: "Document storage is not configured on this server.", status: 503 };
  }
  if (!documentFields(input.kind).some((f) => f.name === input.field)) {
    return { error: "That is not a document this application asks for.", status: 400 };
  }
  if (input.file.size <= 0) return { error: "The file is empty.", status: 400 };
  if (input.file.size > MAX_DOCUMENT_BYTES)
    return { error: "The file is larger than 5 MB.", status: 413 };

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  // What the file is, from its content - not from its name or the type the
  // browser reported.
  const mime = sniffDocumentType(bytes.subarray(0, 16));
  if (!mime) return { error: "Upload a PDF, JPEG, PNG or WebP file.", status: 415 };

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const path = `${input.kind}/${input.applicationId}/${input.field}-${randomUUID()}.${extensionFor(mime)}`;

  const upload = await fetch(`${storageBase()}/storage/v1/object/${DOCUMENT_BUCKET}/${path}`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": mime, "x-upsert": "false" }),
    body: bytes,
  });
  if (!upload.ok) {
    const detail = await upload.text().catch(() => "");
    console.error("[application-documents] upload failed", upload.status, detail.slice(0, 200));
    return { error: "The document could not be stored. Please try again.", status: 502 };
  }

  const recorded = await serviceRest("application_documents", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      application_kind: input.kind,
      application_id: input.applicationId,
      owner_user_id: input.ownerUserId,
      field: input.field,
      original_name: cleanName(input.file.name),
      mime_type: mime,
      size_bytes: bytes.byteLength,
      sha256,
      bucket: DOCUMENT_BUCKET,
      storage_path: path,
    }),
  });
  if (!recorded.ok) {
    // A file with no record is unreachable; take it back out rather than leave it.
    await fetch(`${storageBase()}/storage/v1/object/${DOCUMENT_BUCKET}/${path}`, {
      method: "DELETE",
      headers: storageHeaders(),
    }).catch(() => undefined);
    return { error: "The document could not be recorded. Please try again.", status: 502 };
  }
  const [row] = (await recorded.json()) as { id: string }[];
  return {
    id: row.id,
    field: input.field,
    name: cleanName(input.file.name),
    mime,
    size: bytes.byteLength,
  };
}

export type DocumentRow = {
  id: string;
  application_kind: ApplicationKind;
  application_id: string;
  owner_user_id: string | null;
  original_name: string;
  mime_type: string;
  bucket: string;
  storage_path: string;
};

export async function documentRow(id: string): Promise<DocumentRow | null> {
  const response = await serviceRest(
    `application_documents?select=id,application_kind,application_id,owner_user_id,original_name,mime_type,bucket,storage_path` +
      `&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (!response.ok) return null;
  const [row] = (await response.json()) as DocumentRow[];
  return row ?? null;
}

/** The file itself, streamed from the private bucket. */
export async function openDocument(row: DocumentRow): Promise<Response> {
  const file = await fetch(`${storageBase()}/storage/v1/object/${row.bucket}/${row.storage_path}`, {
    headers: storageHeaders(),
  });
  if (!file.ok || !file.body) {
    return Response.json(
      { error: "The document could not be read from storage." },
      { status: 502 },
    );
  }
  // A header value must be Latin-1; a name in any other script would throw
  // here. The plain-ASCII form is the fallback, the encoded form the real name.
  const ascii = row.original_name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return new Response(file.body, {
    headers: {
      "Content-Type": row.mime_type,
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
      // A person's identity document is not something a proxy should keep.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
