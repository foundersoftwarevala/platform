import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";

/**
 * The Media Library, over the media this platform actually has.
 *
 * Section 12 asks not to create duplicate media tables and section 10 asks to
 * reuse the existing storage. Both point the same way once you look: there is
 * no marketplace-wide media table here, and there is no path to create one -
 * the Supabase management token still answers 401, so DDL is unavailable. What
 * there is: three private Storage buckets, a brand_assets table with checksums
 * and dimensions, and a handful of module-owned document tables that each
 * belong to their own manager.
 *
 * So this is a catalogue across those, not a ninth store beside them. Every row
 * says which table or bucket it came from, and the module that owns a row keeps
 * its authority over it - section 54's point about legal documents is enforced
 * by never serving their content here at all, only the fact that they exist.
 *
 * Two things this reports that are uncomfortable and true. Six of the seven
 * brand asset rows have no file behind them: null size, null checksum, null
 * dimensions. And all four hundred products have an icon *name* rather than an
 * image, so the catalogue has no product imagery whatsoever. Both are shown as
 * findings rather than smoothed into a total.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows<T = Record<string, unknown>>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------- storage */

type StorageObject = {
  name: string;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: { size?: number; mimetype?: string; cacheControl?: string } | null;
};

async function listBucket(bucket: string, prefix = ""): Promise<StorageObject[]> {
  try {
    const response = await fetch(`${url()}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: admin(),
      body: JSON.stringify({ prefix, limit: 200, sortBy: { column: "name", order: "asc" } }),
    });
    if (!response.ok) return [];
    return (await response.json()) as StorageObject[];
  } catch {
    return [];
  }
}

/**
 * Objects, one level of folders deep.
 *
 * Supabase returns folders as entries with no metadata, so a flat listing of a
 * bucket organised by id shows folders and no files. Bounded at one level and
 * at a fixed number of prefixes, because section 46 is right that a media
 * library must not try to load everything.
 */
async function walkBucket(bucket: string): Promise<{ path: string; object: StorageObject }[]> {
  const top = await listBucket(bucket);
  const out: { path: string; object: StorageObject }[] = [];
  const folders: string[] = [];
  for (const entry of top) {
    if (entry.metadata && entry.metadata.size !== undefined) {
      out.push({ path: entry.name, object: entry });
    } else {
      folders.push(entry.name);
    }
  }
  for (const folder of folders.slice(0, 25)) {
    const inner = await listBucket(bucket, `${folder}/`);
    for (const entry of inner) {
      if (entry.metadata && entry.metadata.size !== undefined) {
        out.push({ path: `${folder}/${entry.name}`, object: entry });
      }
    }
  }
  return out;
}

/* ----------------------------------------------------------------- model */

type Kind = "image" | "video" | "document" | "archive" | "icon" | "other";

type Asset = {
  asset_id: string;
  source: string;
  /** The manager that owns it. Media Library never overrides this. */
  authority: string;
  filename: string;
  display_name: string;
  mime_type: string | null;
  extension: string | null;
  kind: Kind;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  checksum: string | null;
  storage_path: string | null;
  /** True only where the asset is deliberately public. */
  is_public: boolean;
  status: string;
  uploaded_at: string | null;
  /** Set when the row exists but no file was ever uploaded behind it. */
  missing_file: boolean;
  references: number;
};

function extensionOf(name: string): string | null {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return match ? match[1].toLowerCase() : null;
}

function kindOf(mime: string | null, extension: string | null): Kind {
  const m = (mime ?? "").toLowerCase();
  const e = (extension ?? "").toLowerCase();
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(e)) {
    return m.includes("icon") || ["ico", "svg"].includes(e) ? "icon" : "image";
  }
  if (m.startsWith("video/") || ["mp4", "mov", "webm", "mkv"].includes(e)) return "video";
  if (m === "application/pdf" || e === "pdf") return "document";
  if (["doc", "docx", "txt", "csv", "xls", "xlsx", "ppt", "pptx", "md"].includes(e)) return "document";
  if (m.includes("zip") || ["zip", "tar", "gz", "7z", "rar"].includes(e)) return "archive";
  if (m.startsWith("application/") && m.includes("json")) return "document";
  return "other";
}

/**
 * Every asset this platform holds, from every place that holds one.
 *
 * Nothing is invented to fill a category out. A category with no assets shows
 * as a category with no assets.
 */
async function collect(): Promise<{ assets: Asset[]; buckets: string[]; notes: string[] }> {
  const notes: string[] = [];

  const bucketList = await fetch(`${url()}/storage/v1/bucket`, { headers: admin() })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []) as { name: string; public: boolean }[];

  const assets: Asset[] = [];

  // 1. Real files in real buckets.
  for (const bucket of bucketList) {
    const objects = await walkBucket(bucket.name);
    for (const { path, object } of objects) {
      const extension = extensionOf(path);
      const mime = object.metadata?.mimetype ?? null;
      assets.push({
        asset_id: `storage:${bucket.name}:${path}`,
        source: `storage/${bucket.name}`,
        authority:
          bucket.name === "legal-documents" ? "Legal Manager"
            : bucket.name === "franchise-documents" ? "Franchise Manager"
              : bucket.name === "developer-task-files" ? "Task Manager"
                : "Marketplace Manager",
        filename: path.split("/").pop() ?? path,
        display_name: path,
        mime_type: mime,
        extension,
        kind: kindOf(mime, extension),
        size_bytes: object.metadata?.size ?? null,
        width: null, height: null,
        checksum: null,
        storage_path: `${bucket.name}/${path}`,
        is_public: Boolean(bucket.public),
        status: "stored",
        uploaded_at: object.created_at ?? object.updated_at ?? null,
        missing_file: false,
        references: 0,
      });
    }
  }

  // 2. brand_assets - the one table here that already looks like a media
  //    table, checksum and dimensions included.
  const brand = await rows<Record<string, unknown>>(
    "brand_assets?select=key,name,asset_type,mime_type,size_bytes,width,height,public_path,sha256,approved,active,created_at",
  );
  for (const b of brand) {
    const extension = extensionOf(String(b.public_path ?? b.key ?? ""));
    const size = b.size_bytes === null || b.size_bytes === undefined ? null : Number(b.size_bytes);
    assets.push({
      asset_id: `brand:${String(b.key)}`,
      source: "brand_assets",
      authority: "Brand Protection",
      filename: String(b.public_path ?? b.key),
      display_name: String(b.name ?? b.key),
      mime_type: (b.mime_type as string) ?? null,
      extension,
      kind: kindOf((b.mime_type as string) ?? null, extension),
      size_bytes: size,
      width: b.width === null || b.width === undefined ? null : Number(b.width),
      height: b.height === null || b.height === undefined ? null : Number(b.height),
      checksum: (b.sha256 as string) ?? null,
      storage_path: (b.public_path as string) ?? null,
      // Brand assets are the storefront's own marks; they are meant to be seen.
      is_public: true,
      status: b.active ? "active" : b.approved ? "approved" : "declared",
      uploaded_at: (b.created_at as string) ?? null,
      // The honest part: a row with no size and no checksum has no file.
      missing_file: size === null && !b.sha256,
      references: 0,
    });
  }

  // 3. Module documents. Metadata only - the file itself stays with the
  //    manager that owns it, which is section 54's rule generalised.
  const franchise = await rows<Record<string, unknown>>(
    "franchise_documents?select=id,name,doc_type,file_url,status,uploaded_at,created_at",
  );
  for (const f of franchise) {
    const extension = extensionOf(String(f.file_url ?? f.name ?? ""));
    assets.push({
      asset_id: `franchise_documents:${String(f.id)}`,
      source: "franchise_documents",
      authority: "Franchise Manager",
      filename: String(f.name ?? f.id),
      display_name: `${f.name ?? f.id}${f.doc_type ? ` (${f.doc_type})` : ""}`,
      mime_type: null, extension,
      kind: kindOf(null, extension) === "other" ? "document" : kindOf(null, extension),
      size_bytes: null, width: null, height: null, checksum: null,
      storage_path: null,
      is_public: false,
      status: String(f.status ?? "unknown"),
      uploaded_at: (f.uploaded_at as string) ?? (f.created_at as string) ?? null,
      missing_file: !f.file_url,
      references: 0,
    });
  }

  const legal = await rows<Record<string, unknown>>("legal_documents?select=id");
  if (legal.length) {
    notes.push(
      `${legal.length} legal document(s) exist. They are counted and not listed: the Legal Manager is authoritative for them and this screen must not become a second way to reach their content.`,
    );
  }

  const training = await rows<Record<string, unknown>>(
    "bot_training_documents?select=id,title,source_type,status,created_at",
  );
  for (const t of training) {
    assets.push({
      asset_id: `bot_training_documents:${String(t.id)}`,
      source: "bot_training_documents",
      authority: "Chatbot Manager",
      filename: String(t.title ?? t.id),
      display_name: String(t.title ?? t.id),
      mime_type: null, extension: null, kind: "document",
      size_bytes: null, width: null, height: null, checksum: null,
      storage_path: null, is_public: false,
      status: String(t.status ?? "unknown"),
      uploaded_at: (t.created_at as string) ?? null,
      missing_file: false,
      references: 0,
    });
  }

  return { assets, buckets: bucketList.map((b) => b.name), notes };
}

/* ------------------------------------------------- references and orphans */

/**
 * Sections 57 and 58, both directions.
 *
 * What references an asset, so a delete can be refused before it breaks a
 * page; and which products have no image at all, which is the gap that
 * actually exists on this catalogue.
 */
async function referenceReport(assets: Asset[]) {
  const products = await rows<Record<string, unknown>>(
    "marketplace_products?select=id,name,slug,cover_image,icon,logo,thumbnail_url,favicon,visible,content_status&limit=1000",
  );

  const referenced = new Set<string>();
  let withImage = 0;
  let iconNameOnly = 0;

  for (const p of products) {
    let hasImage = false;
    for (const field of ["cover_image", "logo", "thumbnail_url", "favicon"] as const) {
      const value = p[field];
      if (typeof value === "string" && value.trim()) {
        hasImage = true;
        for (const a of assets) {
          if (a.storage_path && value.includes(a.storage_path)) referenced.add(a.asset_id);
          else if (a.filename && value.includes(a.filename)) referenced.add(a.asset_id);
        }
      }
    }
    // icon holds a Lucide component name, not a file. Counting it as imagery
    // would be the single most misleading number this screen could show.
    const icon = p.icon;
    if (typeof icon === "string" && icon.trim() && !icon.includes("/") && !icon.includes(".")) {
      iconNameOnly += 1;
    }
    if (hasImage) withImage += 1;
  }

  for (const a of assets) {
    if (referenced.has(a.asset_id)) a.references = 1;
  }

  const published = products.filter((p) => String(p.content_status) === "published");

  return {
    products: products.length,
    products_with_image: withImage,
    products_without_image: products.length - withImage,
    products_with_icon_name_only: iconNameOnly,
    published_without_image: published.filter(
      (p) => !["cover_image", "logo", "thumbnail_url"].some((f) => {
        const v = p[f as keyof typeof p];
        return typeof v === "string" && v.trim();
      }),
    ).length,
    orphan_candidates: assets.filter((a) => a.references === 0 && !a.missing_file).length,
    referenced: assets.filter((a) => a.references > 0).length,
  };
}

/* ---------------------------------------------------------------- audit */

async function audit(
  request: Request, action: string, after: unknown, reason: string,
): Promise<void> {
  try {
    const authorization = request.headers.get("authorization");
    const anon =
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? "";
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    const asOperator = Boolean(authorization && anon);
    await fetch(`${url()}/rest/v1/rpc/mm_audit`, {
      method: "POST",
      headers: asOperator
        ? { apikey: anon, Authorization: authorization!, "Content-Type": "application/json" }
        : { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_action: action, p_entity_type: "media", p_entity_id: null,
        p_before: null, p_after: after, p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[media] audit failed", error);
  }
}

const SORTS: Record<string, (a: Asset, b: Asset) => number> = {
  newest: (a, b) => Date.parse(b.uploaded_at ?? "0") - Date.parse(a.uploaded_at ?? "0"),
  oldest: (a, b) => Date.parse(a.uploaded_at ?? "0") - Date.parse(b.uploaded_at ?? "0"),
  name_asc: (a, b) => a.display_name.localeCompare(b.display_name),
  name_desc: (a, b) => b.display_name.localeCompare(a.display_name),
  largest: (a, b) => (b.size_bytes ?? -1) - (a.size_bytes ?? -1),
  smallest: (a, b) => (a.size_bytes ?? Number.MAX_SAFE_INTEGER) - (b.size_bytes ?? Number.MAX_SAFE_INTEGER),
};

export const Route = createFileRoute("/api/marketplace/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const params = new URL(request.url).searchParams;
        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const may = (action: string) => {
          const d = resolveAction({ roles: caller.roles, action, permissions: matrix });
          return d.visible && d.enabled;
        };
        if (!may("media_view")) {
          await recordDenial(request, {
            action: "media_view", permission: "marketplace.media.view",
            roles: caller.roles, entityType: "media", recordId: null,
            why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: "Permission marketplace.media.view is required." },
            { status: 403 },
          );
        }

        const { assets, buckets, notes } = await collect();
        const references = await referenceReport(assets);

        // Section 28. Metadata only; no storage credential and no signed URL
        // is ever put in an export.
        if (params.get("format") === "csv") {
          if (!may("export")) {
            await recordDenial(request, {
              action: "media_export", permission: "marketplace.export",
              roles: caller.roles, entityType: "media", recordId: null,
              why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
            });
            return Response.json({ ok: false, reason: "permission_denied" }, { status: 403 });
          }
          const cell = (v: unknown) => {
            const text = v === null || v === undefined ? "" : String(v);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          };
          const lines = ["asset_id,source,authority,filename,kind,mime,size_bytes,checksum,status,public,references,uploaded_at"];
          for (const a of assets) {
            lines.push([
              a.asset_id, a.source, a.authority, a.filename, a.kind, a.mime_type ?? "",
              a.size_bytes ?? "", a.checksum ?? "", a.status, a.is_public, a.references,
              a.uploaded_at ?? "",
            ].map(cell).join(","));
          }
          await audit(request, "Media metadata exported", { rows: assets.length },
            "Media library metadata exported as CSV from the Marketplace Manager.");
          return new Response(lines.join("\n"), {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="media-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
          });
        }

        // Sections 5, 6, 7 and 46: filtered, sorted and paged on the server.
        const q = (params.get("q") ?? "").trim().toLowerCase();
        const kind = params.get("kind") ?? "all";
        const source = params.get("source") ?? "all";
        const sort = params.get("sort") ?? "newest";
        const page = Math.max(1, Number(params.get("page") ?? 1));
        const size = Math.min(100, Math.max(10, Number(params.get("size") ?? 25)));

        let filtered = assets;
        if (kind !== "all") filtered = filtered.filter((a) => a.kind === kind);
        if (source !== "all") filtered = filtered.filter((a) => a.source === source);
        if (q) {
          filtered = filtered.filter((a) =>
            [a.display_name, a.filename, a.asset_id, a.mime_type, a.extension, a.source, a.status]
              .some((v) => String(v ?? "").toLowerCase().includes(q)));
        }
        filtered = [...filtered].sort(SORTS[sort] ?? SORTS.newest);

        const totalBytes = assets.reduce((sum, a) => sum + (a.size_bytes ?? 0), 0);
        const bytesByKind: Record<string, number> = {};
        const countByKind: Record<string, number> = {};
        for (const a of assets) {
          bytesByKind[a.kind] = (bytesByKind[a.kind] ?? 0) + (a.size_bytes ?? 0);
          countByKind[a.kind] = (countByKind[a.kind] ?? 0) + 1;
        }

        return Response.json({
          ok: true,
          total: assets.length,
          matched: filtered.length,
          page, size,
          assets: filtered.slice((page - 1) * size, page * size),
          sources: [...new Set(assets.map((a) => a.source))].sort(),
          buckets,
          notes,
          storage: {
            used_bytes: totalBytes,
            by_kind_bytes: bytesByKind,
            by_kind_count: countByKind,
            // Section 47, exactly as it asks.
            quota_bytes: null,
            quota_note: "Provider quota unavailable — Supabase does not expose a storage quota through its API, so no total or remaining figure is shown rather than an invented one.",
            files_missing: assets.filter((a) => a.missing_file).length,
          },
          references,
          capabilities: {
            upload: {
              available: false,
              reason:
                "There is no marketplace media table on this database and no way to create one from here — the Supabase management token answers 401, so DDL is unavailable. An upload would put a file in a bucket with nothing recording that it exists. Brand assets are the exception and already have a working upload path in Brand Protect.",
            },
            versions: {
              available: false,
              reason:
                "brand_asset_versions exists and is empty; every other source has no version table. Replacement history can be recorded for brand assets and nowhere else.",
            },
            signed_download: { available: true, reason: null },
            delete: {
              available: false,
              reason:
                "Each asset belongs to the manager that owns its table. Deleting from here would take a file out from under Legal, Franchise or Task Manager without their rules running.",
            },
          },
          permissions: {
            view: true,
            upload: may("media_upload"),
            manage: may("media_manage"),
            download: may("media_download"),
            export: may("export"),
          },
        });
      },

      /** Section 26: an authorised, audited, time-limited link. Never a public one. */
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: { asset_id?: string; reason?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const decision = resolveAction({
          roles: caller.roles, action: "media_download", permissions: matrix,
        });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action: "media_download", permission: "marketplace.media.download",
            roles: caller.roles, entityType: "media", recordId: body.asset_id ?? null,
            why: `${decision.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: decision.reason },
            { status: 403 },
          );
        }

        const assetId = String(body.asset_id ?? "");
        if (!assetId.startsWith("storage:")) {
          return Response.json(
            {
              ok: false, reason: "not_downloadable",
              message: "Only a file that actually sits in storage can be signed for. Rows from a module table are metadata; that module serves its own file.",
            },
            { status: 400 },
          );
        }
        const [, bucket, ...rest] = assetId.split(":");
        const path = rest.join(":");
        // Section 11: a path that tries to climb out is refused, not cleaned up
        // and followed anyway.
        if (!bucket || !path || path.includes("..") || path.startsWith("/")) {
          return Response.json({ ok: false, reason: "invalid_path" }, { status: 400 });
        }
        if (bucket === "legal-documents") {
          await audit(request, "Legal document download refused", { asset_id: assetId },
            "Media Library will not sign a legal document; the Legal Manager is authoritative for those.");
          return Response.json(
            {
              ok: false, reason: "legal_authority",
              message: "This document belongs to the Legal Manager. Its access rules are authoritative and this screen does not go around them.",
            },
            { status: 403 },
          );
        }

        const response = await fetch(`${url()}/storage/v1/object/sign/${bucket}/${path}`, {
          method: "POST", headers: admin(), body: JSON.stringify({ expiresIn: 300 }),
        });
        if (!response.ok) {
          return Response.json(
            { ok: false, reason: "sign_failed", message: "That file could not be signed for download." },
            { status: 502 },
          );
        }
        const signed = (await response.json()) as { signedURL?: string };
        await audit(request, "Media download signed", { asset_id: assetId, expires_in: 300 },
          String(body.reason ?? "").slice(0, 300) ||
            `A five-minute download link was issued for ${assetId}.`);
        return Response.json({
          ok: true,
          asset_id: assetId,
          url: `${url()}/storage/v1${signed.signedURL ?? ""}`,
          expires_in: 300,
        });
      },
    },
  },
});
