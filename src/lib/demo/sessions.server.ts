import postgres, { type Sql, type TransactionSql } from "postgres";
import { randomUUID } from "node:crypto";
import { deploymentSetting } from "@/lib/seo/seo-store.server";

const PLATFORM_DATABASE = "sv_platform";
const SESSION_TTL_MINUTES = 30;

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

async function pruneSessions(tx: TransactionSql) {
  await tx`
    delete from public.demo_visitor_sessions
     where visitor_session_id in (
       select visitor_session_id
         from public.demo_visitor_sessions
        where expires_at <= now() or ended_at is not null
        order by coalesce(ended_at, expires_at)
        limit 500
     )
  `;
}

export async function createDemoVisitorSession(slug: string): Promise<DemoSession> {
  const sessionId = randomUUID();
  return database().begin(async (tx) => {
    const [demo] = await tx<DemoSession[]>`
      select p.id as "productId",
             d.id as "demoId",
             p.category_id as "categoryId",
             p.slug as "productSlug",
             p.name as "productName",
             d.demo_name as "demoName"
        from public.marketplace_products p
        join public.marketplace_categories c
          on c.id = p.category_id and c.is_hidden = false
        join public.product_demo_urls d
          on d.product_id = p.id
         and d.status = 'active'
         and nullif(btrim(d.url), '') is not null
         and d.detected_category_id = p.category_id
       where p.slug = ${slug}
         and p.visible = true
         and p.moderation_status = 'approved'
         and coalesce(p.content_status, 'published') = 'published'
         and (p.publish_at is null or p.publish_at <= now())
         and (p.unpublish_at is null or p.unpublish_at > now())
         and p.category_id is not null
       order by d.sort_order asc, d.created_at desc
       limit 1
       for share of p, c, d
    `;
    if (!demo) throw new DemoUnavailableError();

    await pruneSessions(tx);
    const [session] = await tx<{ expiresAt: string }[]>`
      insert into public.demo_visitor_sessions
        (visitor_session_id, product_id, demo_url_id, category_id, expires_at)
      values
        (${sessionId}::uuid, ${demo.productId}::uuid, ${demo.demoId}::uuid,
         ${demo.categoryId}::uuid, now() + (${SESSION_TTL_MINUTES} * interval '1 minute'))
      returning expires_at::text as "expiresAt"
    `;
    if (!session) throw new Error("The demo session could not be stored.");
    return { ...demo, sessionId, expiresAt: session.expiresAt };
  });
}

export async function findDemoVisitorSession(
  sessionId: string,
  slug: string,
): Promise<DemoSession | null> {
  const [session] = await database()<DemoSession[]>`
    select s.visitor_session_id as "sessionId",
           s.product_id as "productId",
           s.demo_url_id as "demoId",
           s.category_id as "categoryId",
           p.slug as "productSlug",
           p.name as "productName",
           d.demo_name as "demoName",
           s.expires_at::text as "expiresAt"
      from public.demo_visitor_sessions s
      join public.marketplace_products p on p.id = s.product_id
      join public.marketplace_categories c
        on c.id = s.category_id and c.is_hidden = false
      join public.product_demo_urls d
        on d.id = s.demo_url_id and d.product_id = s.product_id
     where s.visitor_session_id = ${sessionId}::uuid
       and p.slug = ${slug}
       and p.category_id = s.category_id
       and p.visible = true
       and p.moderation_status = 'approved'
       and coalesce(p.content_status, 'published') = 'published'
       and (p.publish_at is null or p.publish_at <= now())
       and (p.unpublish_at is null or p.unpublish_at > now())
       and d.status = 'active'
       and nullif(btrim(d.url), '') is not null
       and d.detected_category_id = p.category_id
       and s.expires_at > now()
       and s.ended_at is null
     limit 1
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
    {
      url: string;
      demoName: string;
      productName: string;
    }[]
  >`
    select d.url,
           d.demo_name as "demoName",
           p.name as "productName"
      from public.demo_visitor_sessions s
      join public.marketplace_products p on p.id = s.product_id
      join public.marketplace_categories c
        on c.id = s.category_id and c.is_hidden = false
      join public.product_demo_urls d
        on d.id = s.demo_url_id and d.product_id = s.product_id
     where s.visitor_session_id = ${sessionId}::uuid
       and p.slug = ${slug}
       and s.demo_url_id = ${demoId}::uuid
       and s.category_id = ${categoryId}::uuid
       and p.category_id = s.category_id
       and p.visible = true
       and p.moderation_status = 'approved'
       and coalesce(p.content_status, 'published') = 'published'
       and (p.publish_at is null or p.publish_at <= now())
       and (p.unpublish_at is null or p.unpublish_at > now())
       and d.status = 'active'
       and nullif(btrim(d.url), '') is not null
       and d.detected_category_id = p.category_id
       and s.expires_at > now()
       and s.ended_at is null
     limit 1
  `;
  return demo ? { url: demo.url, name: demo.demoName || demo.productName } : null;
}

export async function endDemoVisitorSession(sessionId: string): Promise<void> {
  await database()`
    update public.demo_visitor_sessions
       set ended_at = now()
     where visitor_session_id = ${sessionId}::uuid
       and ended_at is null
  `;
}
