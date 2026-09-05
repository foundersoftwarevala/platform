// Demo URL Manager — CRUD + live health-check server functions.
// Admin-only. RLS restricts to boss/admin roles.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function audit(
  context: any,
  action: string,
  demoUrlId: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    await (context.supabase as any).from("demo_url_audit_log").insert({
      demo_url_id: demoUrlId,
      action,
      actor_id: context.userId ?? null,
      actor_email: context.claims?.email ?? null,
      metadata,
    });
  } catch (e) {
    console.warn("[demo-audit] failed", action, e);
  }
}

export type DemoAuditEntry = {
  id: string;
  demo_url_id: string | null;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  metadata: any;
  created_at: string;
};


export type DemoUrl = {
  id: string;
  product_id: string | null;
  demo_name: string;
  role_name: string;
  url: string;
  username: string | null;
  password: string | null;
  description: string | null;
  environment: "production" | "staging" | "testing";
  status: "active" | "inactive";
  sort_order: number;
  last_checked_at: string | null;
  last_response_ms: number | null;
  last_http_status: number | null;
  last_result: "working" | "slow" | "offline" | "unknown";
  ssl_valid: boolean | null;
  created_at: string;
  updated_at: string;
};

export type CentralDemoRow = DemoUrl & {
  product_name: string | null;
  product_slug: string | null;
  category_id: string | null;
  category_name: string | null;
  product_visible: boolean | null;
};

export type CentralDemoPage = {
  rows: CentralDemoRow[];
  total: number;
  page: number;
  pageSize: number;
};

const demoSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable().optional(),
  demo_name: z.string().min(1).max(120),
  role_name: z.string().min(1).max(80),
  url: z.string().url().max(1024),
  username: z.string().max(200).nullable().optional(),
  password: z.string().max(400).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  environment: z.enum(["production", "staging", "testing"]).default("production"),
  status: z.enum(["active", "inactive"]).default("active"),
  sort_order: z.number().int().default(0),
});

function mapDemoUrlRecord(row: any): DemoUrl {
  return {
    id: row.id,
    product_id: row.product_id ?? null,
    demo_name: row.demo_name ?? row.name ?? "Live demo",
    role_name: row.role_name ?? "Public",
    url: row.url ?? "",
    username: row.username ?? null,
    password: row.password ?? null,
    description: row.description ?? null,
    environment: (row.environment ?? "production") as DemoUrl["environment"],
    status: ((row.status ?? (String(row.health_status ?? "").toLowerCase() === "offline" ? "inactive" : "active")) as DemoUrl["status"]),
    sort_order: Number(row.sort_order ?? 0),
    last_checked_at: row.last_checked_at ?? null,
    last_response_ms: row.last_response_ms ?? null,
    last_http_status: row.last_http_status ?? null,
    last_result: (row.last_result ?? "unknown") as DemoUrl["last_result"],
    ssl_valid: row.ssl_valid ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

export const listDemoUrls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("product_demo_urls")
      .select("*")
      .order("sort_order")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return (data as any[]).map(mapDemoUrlRecord);
    }

    const { data: platformRows, error: platformError } = await (context.supabase as any)
      .from("platform_demos")
      .select("id, name, url, product_id, health_status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (platformError) {
      throw new Error(error?.message ?? platformError.message);
    }

    return ((platformRows ?? []) as any[]).map(mapDemoUrlRecord);
  });

export const listCentralDemosServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(10).max(100).default(25),
    search: z.string().max(120).default(""),
    categoryId: z.string().uuid().optional(),
    status: z.enum(["all", "active", "inactive"]).default("all"),
  }).parse(value ?? {}))
  .handler(async ({ data, context }): Promise<CentralDemoPage> => {
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const searchTerm = data.search.trim().toLowerCase();
    let query = (context.supabase as any)
      .from("product_demo_urls")
      .select("*, marketplace_products!inner(id, name, slug, category_id, visible)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.categoryId) query = query.eq("marketplace_products.category_id", data.categoryId);
    if (!searchTerm) query = query.range(from, to);

    const { data: joinedRows, error, count } = await query;
    if (error) throw new Error(error.message);

    const matchingRows = searchTerm
      ? (joinedRows ?? []).filter((row: any) => {
          const product = Array.isArray(row.marketplace_products)
            ? row.marketplace_products[0] ?? {}
            : row.marketplace_products ?? {};
          return [row.demo_name, row.url, row.role_name, product.name, product.slug]
            .some((value) => String(value ?? "").toLowerCase().includes(searchTerm));
        })
      : (joinedRows ?? []);
    const pagedRows = searchTerm ? matchingRows.slice(from, to + 1) : matchingRows;

    const categoryIds = Array.from(new Set((joinedRows ?? [])
      .map((row: any) => row.marketplace_products?.category_id)
      .filter(Boolean)));
    const { data: categories, error: categoryError } = categoryIds.length
      ? await (context.supabase as any).from("marketplace_categories").select("id, name").in("id", categoryIds)
      : { data: [], error: null };
    if (categoryError) throw new Error(categoryError.message);
    const categoryNames = new Map((categories ?? []).map((category: any) => [category.id, category.name]));

    return {
      rows: pagedRows.map((row: any) => {
        const demo = mapDemoUrlRecord(row);
        const product = Array.isArray(row.marketplace_products)
          ? row.marketplace_products[0]
          : row.marketplace_products;
        return {
          ...demo,
          product_name: product?.name ?? null,
          product_slug: product?.slug ?? null,
          category_id: product?.category_id ?? null,
          category_name: categoryNames.get(product?.category_id) ?? null,
          product_visible: product?.visible ?? null,
        };
      }),
      total: searchTerm ? matchingRows.length : count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const upsertDemoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => demoSchema.parse(v))
  .handler(async ({ data, context }) => {
    const isUpdate = !!(data as any).id;
    const { error, data: row } = await (context.supabase as any)
      .from("product_demo_urls")
      .upsert(data as any)
      .select()
      .single();
    if (error) {
      const platformPayload = {
        ...(data.id ? { id: data.id } : {}),
        product_id: data.product_id ?? null,
        name: data.demo_name,
        url: data.url,
        health_status: data.status === "active" ? "active" : "offline",
      };
      const platformResult = await (context.supabase as any)
        .from("platform_demos")
        .upsert(platformPayload)
        .select()
        .single();
      if (platformResult.error) throw new Error(error.message);
      return mapDemoUrlRecord(platformResult.data);
    }
    await audit(context, isUpdate ? "demo_url.update" : "demo_url.create", (row as any).id, {
      demo_name: (row as any).demo_name,
      role_name: (row as any).role_name,
      url: (row as any).url,
      environment: (row as any).environment,
      status: (row as any).status,
    });
    return row as DemoUrl;
  });

const intakeSchema = z.object({
  project_name: z.string().min(1).max(120),
  category: z.string().min(1).max(120),
  demo_url: z.string().url().max(1024),
  role_name: z.string().min(1).max(80).default("Public"),
  public_repo_url: z.string().url().regex(/^https:\/\/(www\.)?(github\.com|gitlab\.com)\//).max(500).optional(),
  description: z.string().max(2000).optional(),
  thumbnail_url: z.string().url().max(1024).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
  tech_stack: z.array(z.string().min(1).max(80)).max(20).default([]),
  features: z.array(z.string().min(1).max(120)).max(30).default([]),
});

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "product";

/** Fast intake for the existing Product -> Demo URL relationship. */
export const createProductWithDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => intakeSchema.parse(v))
  .handler(async ({ data, context }) => {
    const normalizedUrl = new URL(data.demo_url).toString();
    const { data: duplicate } = await (context.supabase as any)
      .from("product_demo_urls")
      .select("id, product_id")
      .in("url", [data.demo_url, normalizedUrl])
      .maybeSingle();
    if (duplicate) throw new Error("A demo with this URL already exists.");

    const categorySlug = slugify(data.category);
    const { data: category, error: categoryError } = await (context.supabase as any)
      .from("marketplace_categories")
      .upsert({ slug: categorySlug, name: data.category, icon: "MonitorPlay", is_hidden: false }, { onConflict: "slug" })
      .select("id")
      .single();
    if (categoryError) throw new Error(categoryError.message);

    const { data: product, error: productError } = await (context.supabase as any)
      .from("marketplace_products")
      .upsert({
        slug: slugify(data.project_name),
        name: data.project_name,
        industry_label: data.category,
        icon: "MonitorPlay",
        price_label: "Custom",
        price_period: "lifetime",
        category_id: category.id,
        visible: true,
        description: data.description ?? null,
        thumbnail_url: data.thumbnail_url ?? null,
        public_repo_url: data.public_repo_url ?? null,
        tags: data.tags,
        tech_stack: data.tech_stack,
        features: data.features,
        content_status: "draft",
      }, { onConflict: "slug" })
      .select("id")
      .single();
    if (productError) throw new Error(productError.message);

    const { data: demo, error: demoError } = await (context.supabase as any)
      .from("product_demo_urls")
      .insert({
        product_id: product.id,
        demo_name: "Live Demo",
        role_name: data.role_name,
        url: normalizedUrl,
        environment: "production",
        status: "active",
        sort_order: 1,
      })
      .select()
      .single();
    if (demoError) throw new Error(demoError.message);
    await audit(context, "demo_url.intake", demo.id, { product_id: product.id, project_name: data.project_name, category: data.category });
    return { productId: product.id, demo: mapDemoUrlRecord(demo) };
  });

export const deleteDemoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: prev } = await (context.supabase as any)
      .from("product_demo_urls").select("demo_name, url").eq("id", data.id).single();
    const { error } = await (context.supabase as any)
      .from("product_demo_urls").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, "demo_url.delete", data.id, prev ?? {});
    return { ok: true };
  });

export const duplicateDemoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: src, error: e1 } = await (context.supabase as any)
      .from("product_demo_urls").select("*").eq("id", data.id).single();
    if (e1 || !src) throw new Error(e1?.message ?? "Not found");
    const { id: _i, created_at: _c, updated_at: _u, ...copy } = src as any;
    copy.demo_name = `${copy.demo_name} (copy)`;
    const { data: row, error } = await (context.supabase as any)
      .from("product_demo_urls").insert(copy).select().single();
    if (error) throw new Error(error.message);
    await audit(context, "demo_url.duplicate", (row as any).id, {
      source_id: data.id,
      demo_name: (row as any).demo_name,
    });
    return row as DemoUrl;
  });

export const toggleDemoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("product_demo_urls").update({ status: data.status }).eq("id", data.id);
    if (error) {
      const platformResult = await (context.supabase as any)
        .from("platform_demos")
        .update({ health_status: data.status === "active" ? "active" : "offline" })
        .eq("id", data.id);
      if (platformResult.error) throw new Error(error.message);
    }
    await audit(context, data.status === "active" ? "demo_url.enable" : "demo_url.disable", data.id, {
      status: data.status,
    });
    return { ok: true };
  });


async function checkOnce(url: string) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
      if (res.status >= 400) {
        res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
      }
    } finally {
      clearTimeout(timer);
    }
    const ms = Date.now() - start;
    const ok = res.status >= 200 && res.status < 400;
    const result: DemoUrl["last_result"] = !ok ? "offline" : ms > 2500 ? "slow" : "working";
    return {
      ok,
      status: res.status,
      ms,
      result,
      ssl: url.startsWith("https://") ? ok : null,
    };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - start, result: "offline" as const, ssl: null };
  }
}

export const testDemoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    // NOTE: overrides earlier declaration was replaced above; keep single testDemoUrl block
    const { data: row, error } = await (context.supabase as any)
      .from("product_demo_urls").select("id, url").eq("id", data.id).single();
    if (error || !row) throw new Error(error?.message ?? "Not found");
    const r = await checkOnce(row.url);
    const patch = {
      last_checked_at: new Date().toISOString(),
      last_response_ms: r.ms,
      last_http_status: r.status,
      last_result: r.result,
      ssl_valid: r.ssl,
    };
    await (context.supabase as any).from("product_demo_urls").update(patch).eq("id", data.id);
    await audit(context, "demo_url.test", data.id, {
      http_status: r.status,
      response_ms: r.ms,
      result: r.result,
      ssl_valid: r.ssl,
    });
    return { id: data.id, ...patch };
  });

export const testAllDemoUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("product_demo_urls").select("id, url").eq("status", "active");
    if (error) throw new Error(error.message);
    const results = await Promise.all(
      ((rows ?? []) as { id: string; url: string }[]).map(async (r) => {
        const c = await checkOnce(r.url);
        const patch = {
          last_checked_at: new Date().toISOString(),
          last_response_ms: c.ms,
          last_http_status: c.status,
          last_result: c.result,
          ssl_valid: c.ssl,
        };
        await (context.supabase as any).from("product_demo_urls").update(patch).eq("id", r.id);
        await audit(context, "demo_url.test", r.id, {
          http_status: c.status,
          response_ms: c.ms,
          result: c.result,
          ssl_valid: c.ssl,
          batch: true,
        });
        return { id: r.id, ...patch };
      })
    );
    await audit(context, "demo_url.test_all", null, { count: results.length });
    return results;
  });

export const listDemoAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      demo_url_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(500).default(100),
    }).parse(v ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any)
      .from("demo_url_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.demo_url_id) q = q.eq("demo_url_id", data.demo_url_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as DemoAuditEntry[];
  });

