import postgres, { type Sql } from "postgres";
import { deploymentSetting } from "@/lib/seo/seo-store.server";

const PLATFORM_DATABASE = "sv_platform";

let pool: Sql | undefined;

function databaseUrl(): string {
  const explicit =
    deploymentSetting("SV_PLATFORM_DATABASE_URL") || deploymentSetting("I18N_DATABASE_URL");
  const configured = explicit || deploymentSetting("VPS_DATABASE_URL");
  if (!configured) throw new Error("The VPS platform database is not configured.");

  const url = new URL(configured);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("The demo session store must use PostgreSQL.");
  }
  if (explicit && decodeURIComponent(url.pathname.slice(1)) !== PLATFORM_DATABASE) {
    throw new Error("The demo session store must use sv_platform.");
  }
  if (!explicit) url.pathname = `/${PLATFORM_DATABASE}`;
  return url.toString();
}

function database(): Sql {
  if (!pool) {
    pool = postgres(databaseUrl(), {
      max: 4,
      idle_timeout: 30,
      connect_timeout: 10,
      connection: { statement_timeout: 10_000, application_name: "sv-demo-sessions" },
      onnotice: () => {},
    });
  }
  return pool;
}

export type DemoSession = {
  sessionId: string;
  productId: string;
  demoId: string;
  categoryId: string;
  productSlug: string;
  productName: string;
  demoName: string;
  expiresAt: string;
};

export class DemoUnavailableError extends Error {
  constructor(message = "This product has no category-matched live demo.") {
    super(message);
    this.name = "DemoUnavailableError";
  }
}

export async function createDemoVisitorSession(slug: string): Promise<DemoSession> {
  const [session] = await database()<DemoSession[]>`
    select session_id as "sessionId",
           product_id as "productId",
           demo_id as "demoId",
           category_id as "categoryId",
           product_slug as "productSlug",
           product_name as "productName",
           demo_name as "demoName",
           expires_at::text as "expiresAt"
      from public.sv_demo_session_create(${slug})
  `;
  if (!session) throw new DemoUnavailableError();
  return session;
}

export async function findDemoVisitorSession(
  sessionId: string,
  slug: string,
): Promise<DemoSession | null> {
  const [session] = await database()<DemoSession[]>`
    select session_id as "sessionId",
           product_id as "productId",
           demo_id as "demoId",
           category_id as "categoryId",
           product_slug as "productSlug",
           product_name as "productName",
           demo_name as "demoName",
           expires_at::text as "expiresAt"
      from public.sv_demo_session_resolve(${sessionId}::uuid, ${slug})
  `;
  return session ?? null;
}

export async function originalDemoForSession(
  sessionId: string,
  slug: string,
  demoId: string,
  categoryId: string,
): Promise<{ url: string; name: string } | null> {
  const [demo] = await database()<
    { url: string; name: string }[]
  >`
    select url, name
      from public.sv_demo_session_original(
        ${sessionId}::uuid,
        ${slug},
        ${demoId}::uuid,
        ${categoryId}::uuid
      )
  `;
  return demo ?? null;
}

export async function endDemoVisitorSession(sessionId: string): Promise<void> {
  await database()`
    select public.sv_demo_session_end(${sessionId}::uuid)
  `;
}
