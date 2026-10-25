import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Demo Manager's reads and writes, against the database the platform actually
 * keeps its data in.
 *
 * This exists because of a split that is invisible from the screen. The browser
 * client in `integrations/supabase/client` is built from VITE_SUPABASE_URL and
 * talks to the hosted Supabase project directly. The server is configured
 * against the VPS gateway. They are two databases:
 *
 *     demo_categories   VPS 90 rows   hosted 0 rows
 *     demos             VPS  n rows   hosted 0 rows
 *
 * So Demo Manager's category dropdown was fetched from hosted, came back `200
 * []`, and every row of a bulk upload was refused with "category ... is not one
 * of the 0" - while ninety categories sat in the database the rest of the
 * platform reads. A demo created from the browser would have been written to
 * hosted, where nothing else looks for it.
 *
 * The VPS is the source of truth for this work, so the fix is to go through the
 * server rather than to copy data into hosted. Everything here runs on the
 * server, against `SUPABASE_URL`, and carries the operator's own token so row
 * level security decides what they may do - the service-role key is never used
 * to write on a browser's behalf.
 */

const BULK_LIMIT = 500;
const DEMO_STATUSES = ["active", "inactive", "maintenance", "down"] as const;
const DEMO_TECH_STACKS = [
  "php",
  "node",
  "java",
  "python",
  "react",
  "angular",
  "vue",
  "other",
] as const;
const DemoStatusSchema = z.enum(DEMO_STATUSES);
const DemoTechStackSchema = z.enum(DEMO_TECH_STACKS);

const DemoManagerRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  category: z.string(),
  url: z.string(),
  login_url: z.string().nullable(),
  demo_type: z.string(),
  status: DemoStatusSchema,
  description: z.string().nullable(),
  created_at: z.string(),
  expiry_date: z.string().nullable(),
  created_by: z.string().nullable(),
  tech_stack: DemoTechStackSchema,
  total_login_roles: z.number(),
  health_score: z.number(),
  uptime_percentage: z.number(),
});

export type DemoManagerRow = z.infer<typeof DemoManagerRowSchema>;

const DemoRequestSchema = z.object({
  id: z.string().uuid(),
  company: z.string().nullable(),
  requester_name: z.string(),
  product_id: z.string().uuid().nullable(),
  created_at: z.string(),
  status: z.string(),
});

const DemoProductSchema = z.object({ id: z.string().uuid(), name: z.string() });
const IdRowSchema = z.object({ id: z.string().uuid() });

function gateway(): string {
  const base = process.env.SUPABASE_URL?.trim() ?? "";
  if (!base) throw new Error("The database is not configured on this server.");
  return base.replace(/\/+$/, "");
}

/** The caller's own token. Their roles, not ours, decide what happens. */
function callerToken(): string {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");
  return token;
}

function asCaller(): Record<string, string> {
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  if (!publishable) {
    throw new Error("The database publishable key is not configured on this server.");
  }
  return {
    apikey: publishable,
    Authorization: `Bearer ${callerToken()}`,
    "Content-Type": "application/json",
  };
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${gateway()}/rest/v1/${path}`, {
    ...init,
    headers: { ...asCaller(), ...((init.headers as Record<string, string>) ?? {}) },
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* a non-JSON body is surfaced as text below */
  }
  return { ok: response.ok, status: response.status, json, text };
}

function restPath(resource: string, query: Record<string, string>): string {
  return `${resource}?${new URLSearchParams(query).toString()}`;
}

function assertOk(result: Awaited<ReturnType<typeof rest>>, action: string): void {
  if (!result.ok) {
    throw new Error(`${action} failed: ${result.status} ${result.text.slice(0, 200)}`);
  }
}

function parseRows<T>(
  result: Awaited<ReturnType<typeof rest>>,
  schema: z.ZodType<T>,
  action: string,
): T[] {
  assertOk(result, action);
  if (!Array.isArray(result.json)) throw new Error(`${action} returned an invalid response.`);
  return result.json.map((row: unknown) => schema.parse(row));
}

async function requireOneRow<T>(
  result: Awaited<ReturnType<typeof rest>>,
  schema: z.ZodType<T>,
  action: string,
): Promise<T> {
  const rows = parseRows(result, schema, action);
  if (rows.length !== 1) throw new Error(`${action} did not affect an available row.`);
  return rows[0];
}

async function requireActiveCategory(category: string): Promise<string> {
  const result = await rest("demo_categories?select=name&is_active=is.true");
  const rows = parseRows(
    result,
    z.object({ name: z.string() }),
    "Demo categories could not be read",
  );
  const selected = rows.find((row) => row.name.toLowerCase() === category.toLowerCase());
  if (!selected) throw new Error("Select an active demo category.");
  return selected.name;
}

async function callerUserId(): Promise<string> {
  const response = await fetch(`${gateway()}/auth/v1/user`, { headers: asCaller() });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `The signed-in user could not be verified: ${response.status} ${text.slice(0, 160)}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("The signed-in user lookup returned an invalid response.");
  }
  return z.object({ id: z.string().uuid() }).parse(json).id;
}

export type DemoCategory = { name: string; display_order: number };
const DemoCategorySchema = z.object({ name: z.string(), display_order: z.number() });

/** The categories a demo may be filed under, from the VPS. */
export const listDemoCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<DemoCategory[]> => {
    const result = await rest(
      "demo_categories?select=name,display_order&is_active=is.true&order=display_order",
    );
    return parseRows(result, DemoCategorySchema, "Categories could not be read");
  },
);

const DemoInput = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(2000),
  category: z.string().trim().min(1).max(200),
  demo_type: z.enum(["web", "mobile", "desktop", "api"]).default("web"),
  description: z.string().trim().max(4000).nullable().optional(),
  login_url: z.string().trim().max(2000).nullable().optional(),
});

const ManagedDemoInput = DemoInput.extend({
  url: z.string().trim().url().max(2000),
});

const CloneSourceSchema = z.object({
  title: z.string(),
  category: z.string(),
  url: z.string(),
  login_url: z.string().nullable(),
  demo_type: z.string(),
  description: z.string().nullable(),
  category_id: z.string().nullable(),
  technology_id: z.string().nullable(),
  tech_stack: DemoTechStackSchema,
  backup_url: z.string().nullable(),
  video_fallback_url: z.string().nullable(),
  demo_banner_text: z.string().nullable(),
  expiry_date: z.string().nullable(),
  renewal_date: z.string().nullable(),
  lifecycle_status: z.string(),
  verification_status: z.string(),
  is_bulk_created: z.boolean(),
  is_trending: z.boolean(),
  multi_login_enabled: z.boolean(),
  max_concurrent_logins: z.number(),
  total_login_roles: z.number(),
  disable_destructive: z.boolean(),
  disable_exports: z.boolean(),
});

const CloneSourceColumns = Object.keys(CloneSourceSchema.shape).join(",");

export type DemoRequestWithProduct = {
  request: z.infer<typeof DemoRequestSchema>;
  productName: string | null;
};

/** Lists the bounded set of demo rows needed by the management screens. */
export const listManagedDemos = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(1000).default(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<DemoManagerRow[]> => {
    const result = await rest(
      restPath("demos", {
        select:
          "id,title,category,url,login_url,demo_type,status,description,created_at,expiry_date,created_by,tech_stack,total_login_roles,health_score,uptime_percentage",
        order: "created_at.desc",
        limit: String(data.limit),
      }),
    );
    return parseRows(result, DemoManagerRowSchema, "Demos could not be read");
  });

/** Lists pending requests and resolves product names without querying the browser database. */
export const listPendingDemoRequests = createServerFn({ method: "GET" }).handler(
  async (): Promise<DemoRequestWithProduct[]> => {
    const requests = parseRows(
      await rest(
        restPath("demo_requests", {
          select: "id,company,requester_name,product_id,created_at,status",
          status: "eq.pending",
          order: "created_at.desc",
          limit: "100",
        }),
      ),
      DemoRequestSchema,
      "Demo requests could not be read",
    );

    const productIds = [
      ...new Set(requests.flatMap((row) => (row.product_id ? [row.product_id] : []))),
    ];
    const products = productIds.length
      ? parseRows(
          await rest(
            restPath("marketplace_products", {
              select: "id,name",
              id: `in.(${productIds.join(",")})`,
            }),
          ),
          DemoProductSchema,
          "Requested products could not be read",
        )
      : [];
    const productsById = new Map(products.map((product) => [product.id, product.name]));
    return requests.map((request) => ({
      request,
      productName: request.product_id ? (productsById.get(request.product_id) ?? null) : null,
    }));
  },
);

/** Creates one demo with caller identity and active-category validation. */
export const createManagedDemo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ManagedDemoInput.parse(input))
  .handler(async ({ data }): Promise<DemoManagerRow> => {
    const category = await requireActiveCategory(data.category);
    const createdBy = await callerUserId();
    const result = await rest(
      "demos?select=id,title,category,url,login_url,demo_type,status,description,created_at,expiry_date,created_by,tech_stack,total_login_roles,health_score,uptime_percentage",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          title: data.title,
          category,
          url: data.url,
          login_url: data.login_url ?? null,
          demo_type: data.demo_type,
          description: data.description ?? null,
          created_by: createdBy,
          status: "active",
          lifecycle_status: "live",
        }),
      },
    );
    return requireOneRow(result, DemoManagerRowSchema, "Demo could not be created");
  });

/** Updates only the editable fields exposed by DemoAddEdit. */
export const updateManagedDemo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), demo: ManagedDemoInput }).parse(input),
  )
  .handler(async ({ data }): Promise<DemoManagerRow> => {
    const category = await requireActiveCategory(data.demo.category);
    const result = await rest(
      restPath("demos", {
        id: `eq.${data.id}`,
        select:
          "id,title,category,url,login_url,demo_type,status,description,created_at,expiry_date,created_by,tech_stack,total_login_roles,health_score,uptime_percentage",
      }),
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          title: data.demo.title,
          category,
          url: data.demo.url,
          login_url: data.demo.login_url ?? null,
          demo_type: data.demo.demo_type,
          description: data.demo.description ?? null,
        }),
      },
    );
    return requireOneRow(result, DemoManagerRowSchema, "Demo could not be updated");
  });

/** Updates the demo status using the caller's normal PostgREST/RLS permissions. */
export const setManagedDemoStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: DemoStatusSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<void> => {
    const result = await rest(restPath("demos", { id: `eq.${data.id}`, select: "id" }), {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: data.status }),
    });
    await requireOneRow(result, IdRowSchema, "Demo status could not be updated");
  });

/** Extends from the current expiry date and refuses to overwrite a concurrent edit. */
export const extendManagedDemo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), days: z.number().int().min(1).max(365) }).parse(input),
  )
  .handler(async ({ data }): Promise<void> => {
    const currentRows = parseRows(
      await rest(restPath("demos", { id: `eq.${data.id}`, select: "expiry_date", limit: "1" })),
      z.object({ expiry_date: z.string().nullable() }),
      "Demo expiry could not be read",
    );
    const current = currentRows[0];
    if (!current) throw new Error("Demo could not be found or is not accessible.");
    const existingExpiry = current.expiry_date ? new Date(current.expiry_date) : null;
    if (existingExpiry && Number.isNaN(existingExpiry.getTime())) {
      throw new Error("Demo expiry date is invalid.");
    }
    const now = new Date();
    const base = existingExpiry && existingExpiry.getTime() > now.getTime() ? existingExpiry : now;
    const expiryDate = new Date(base.getTime() + data.days * 86_400_000).toISOString();
    const filters: Record<string, string> = {
      id: `eq.${data.id}`,
      select: "id",
    };
    filters.expiry_date = current.expiry_date ? `eq.${current.expiry_date}` : "is.null";
    const result = await rest(restPath("demos", filters), {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ expiry_date: expiryDate, status: "active" }),
    });
    await requireOneRow(result, IdRowSchema, "Demo expiry could not be updated");
  });

/** Clones the source configuration, but never accepts row fields from the client. */
export const cloneManagedDemo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<DemoManagerRow> => {
    const sourceRows = parseRows(
      await rest(
        restPath("demos", {
          id: `eq.${data.id}`,
          select: CloneSourceColumns,
          limit: "1",
        }),
      ),
      CloneSourceSchema,
      "Demo to clone could not be read",
    );
    const source = sourceRows[0];
    if (!source) throw new Error("Demo could not be found or is not accessible.");
    const createdBy = await callerUserId();
    const result = await rest(
      "demos?select=id,title,category,url,login_url,demo_type,status,description,created_at,expiry_date,created_by,tech_stack,total_login_roles,health_score,uptime_percentage",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          ...source,
          title: `${source.title} (Copy)`,
          created_by: createdBy,
          status: "inactive",
        }),
      },
    );
    return requireOneRow(result, DemoManagerRowSchema, "Demo could not be cloned");
  });

/** Deletes one demo; database foreign-key and RLS behavior remains authoritative. */
export const deleteManagedDemo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<void> => {
    const result = await rest(restPath("demos", { id: `eq.${data.id}`, select: "id" }), {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
    await requireOneRow(result, IdRowSchema, "Demo could not be deleted");
  });

/** Changes a pending request once; competing decisions cannot silently overwrite it. */
export const respondToDemoRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data }): Promise<void> => {
    const result = await rest(
      restPath("demo_requests", {
        id: `eq.${data.id}`,
        status: "eq.pending",
        select: "id",
      }),
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: data.status, updated_at: new Date().toISOString() }),
      },
    );
    await requireOneRow(
      result,
      IdRowSchema,
      "Demo request is no longer pending or is inaccessible",
    );
  });

export type BulkOutcome = {
  requested: number;
  inserted: number;
  alreadyThere: number;
  refused: { reason: string; count: number }[];
};

/**
 * Creates demos, refusing anything it cannot file properly.
 *
 * The category is checked against `demo_categories` on the server rather than
 * trusted from the browser: a category that is not in that list would put the
 * demo where the marketplace cannot see it, and the screen is not the place
 * that decision should be enforceable from.
 *
 * A URL already in the catalogue is skipped, not duplicated and not an error,
 * because a load of twelve thousand may have to be resumed after failing
 * part-way. That is the unique index on demos.normalized_url doing the work;
 * `resolution=ignore-duplicates` is how it is asked to skip rather than fail.
 *
 * The counts returned are counted from what the database gave back, never from
 * what was sent.
 */
export const createDemosBulk = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(DemoInput).min(1).max(BULK_LIMIT) }).parse(input),
  )
  .handler(async ({ data }): Promise<BulkOutcome> => {
    const allowed = await rest("demo_categories?select=name&is_active=is.true");
    if (!allowed.ok) {
      throw new Error(
        `Categories could not be read: ${allowed.status} ${allowed.text.slice(0, 160)}`,
      );
    }
    const categories = parseRows(
      allowed,
      z.object({ name: z.string() }),
      "Categories could not be read",
    );
    const known = new Map(categories.map((row) => [row.name.toLowerCase().trim(), row.name]));
    if (known.size === 0) {
      throw new Error(
        "No demo categories are configured, so a demo cannot be filed. Seed demo_categories before loading demos.",
      );
    }

    const refusals = new Map<string, number>();
    const refuse = (reason: string) => refusals.set(reason, (refusals.get(reason) ?? 0) + 1);

    const payload: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const row of data.rows) {
      const category = known.get(row.category.toLowerCase().trim());
      if (!category) {
        refuse(`category "${row.category.slice(0, 40)}" is not one of the ${known.size}`);
        continue;
      }
      // Two identical URLs in one statement would collide with each other
      // rather than with the table, so the batch is made distinct first.
      const key = row.url.toLowerCase().replace(/\/+$/, "");
      if (seen.has(key)) {
        refuse("repeated inside the same upload");
        continue;
      }
      seen.add(key);

      payload.push({
        title: row.title,
        url: row.url,
        category,
        demo_type: row.demo_type,
        description: row.description ?? null,
        login_url: row.login_url ?? null,
        status: "inactive",
        lifecycle_status: "pending",
        is_bulk_created: true,
      });
    }

    let inserted = 0;
    if (payload.length > 0) {
      const created = await rest("demos?on_conflict=normalized_url", {
        method: "POST",
        headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
        body: JSON.stringify(payload),
      });
      if (!created.ok) {
        throw new Error(
          `The demos could not be saved: ${created.status} ${created.text.slice(0, 200)}`,
        );
      }
      inserted = Array.isArray(created.json) ? created.json.length : 0;
    }

    return {
      requested: data.rows.length,
      inserted,
      alreadyThere: Math.max(0, payload.length - inserted),
      refused: [...refusals.entries()].map(([reason, count]) => ({ reason, count })),
    };
  });

/** How many demos exist, so a screen can say so without fetching them all. */
export const countDemos = createServerFn({ method: "GET" }).handler(async (): Promise<number> => {
  const response = await fetch(`${gateway()}/rest/v1/demos?select=id`, {
    headers: { ...asCaller(), Prefer: "count=exact", Range: "0-0" },
  });
  const range = response.headers.get("content-range") ?? "";
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Demo count could not be read: ${response.status} ${text.slice(0, 200)}`);
  }
  const total = range.match(/\/(\d+)$/)?.[1];
  if (total === undefined) throw new Error("Demo count response did not include an exact total.");
  return Number(total);
});
