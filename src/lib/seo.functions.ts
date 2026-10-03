import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { deleteRecord, insertRecord, updateRecord } from "./manager-data.functions";
import { generateSeo } from "./seo-ai.functions";
export { deleteRecord, insertRecord, updateRecord };

const aiSchema = z.object({
  task: z.enum(["suggestions", "content", "meta", "reel", "assistant"]).default("assistant"),
  // Bounded: every character goes to a paid AI gateway.
  prompt: z.string().min(1).max(4000),
  persist: z.boolean().optional(),
  context: z.string().max(8000).optional(),
});

/**
 * Every function below writes or runs work with the service role, which reads
 * and writes past every policy. They had no check of their own, so any caller -
 * a customer, or nobody signed in - could start a catalogue audit, insert
 * reports or rewrite crawl state. The SEO console's people are the operators
 * plus the seo and marketing staff the route gate admits.
 */
async function seoOperator(action: string) {
  const { requireOperator } = await import("@/lib/auth/require-operator.server");
  return requireOperator(action, { alsoAllow: ["seo", "marketing"] });
}

const automationSchema = z.object({ id: z.string().min(1) });
const recrawlSchema = z.object({ id: z.string().min(1) });
const searchConsoleSchema = z.object({
  siteUrl: z.string().min(1),
  days: z.number().int().min(1).max(3650).default(30),
});
const semrushSchema = z.object({
  domain: z.string().min(1),
  database: z.string().min(1).default("us"),
});

export const generateWithAi = createServerFn({ method: "POST" })
  .inputValidator((value) => aiSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    const generated = await generateSeo({
      data: {
        topic: data.prompt,
        type: "homepage",
        locale: data.context ?? "global/en",
      },
    });

    const suggestion = {
      task: data.task,
      title: generated.title,
      description: generated.description,
      h1: generated.h1,
      keywords: generated.keywords,
      hashtags: generated.hashtags,
      ogTitle: generated.ogTitle,
      ogDescription: generated.ogDescription,
      twitterTitle: generated.twitterTitle,
      twitterDescription: generated.twitterDescription,
      canonical: generated.canonical,
      schema: generated.schema,
      context: data.context ?? null,
      generatedAt: new Date().toISOString(),
      // Whether a model wrote this or the built-in template did, and why. It
      // travels with the suggestion so the screen showing it, and the row
      // stored below, both say which they are.
      source: generated.source,
      reason: generated.reason,
    };

    // This insert could never have succeeded. `seo_ai_suggestions` requires a
    // `title` and has no `task` column, so every write was rejected, swallowed
    // by the empty catch below it, and then reported back as `persisted: true`.
    // It now writes the columns the table actually has, and says whether the
    // row landed instead of assuming it did.
    let persisted = false;
    let persistError: string | null = null;
    if (data.persist) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("seo_ai_suggestions").insert({
          title: suggestion.title || data.prompt.slice(0, 120),
          suggestion: JSON.stringify(suggestion),
          target_type: "page",
          target_ref: data.context ?? null,
          status: "pending",
        });
        if (error) persistError = error.message;
        else persisted = true;
      } catch (problem) {
        // A generation that cannot be stored is still a useful generation, so
        // this does not fail the call — but the reason travels back with it.
        persistError = problem instanceof Error ? problem.message : "could not be stored";
      }
    }

    return {
      ok: true,
      task: data.task,
      suggestion,
      persisted,
      persistError,
      generatedAt: suggestion.generatedAt,
    };
  });

export const runAutomation = createServerFn({ method: "POST" })
  .inputValidator((value) => automationSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Running an SEO automation");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: automation, error: automationError } = await supabaseAdmin
      .from("seo_automations")
      .select("id,name")
      .eq("id", data.id)
      .maybeSingle();

    if (automationError) throw new Error(automationError.message);
    if (!automation) throw new Error("Automation not found");

    // This used to insert a run marked "completed", one item processed, with
    // no work done at all - a fabricated success in the run history. There is
    // no executor for seo_automations yet, so it says so instead.
    throw new Error(
      `"${automation.name}" has no executor yet, so nothing was run and no run was recorded.`,
    );
  });

/**
 * Run the catalogue audit and record it.
 *
 * This used to write `score: 94` with `pages_crawled: 0`, `issues_found: 0`
 * and a breakdown of seven invented percentages — a fabricated grade, into the
 * same `seo_audits` table that the real audit at
 * `POST /api/internal/seo-audit` writes to, indistinguishable from it once
 * stored. It now runs that same real audit: the counts are counts of rows in
 * the live catalogue, and the score is those counts weighted by severity.
 */
export const runSiteAudit = createServerFn({ method: "POST" }).handler(async () => {
  await seoOperator("Running the catalogue audit");
  const { runCatalogueAudit } = await import("@/lib/seo/catalogue-audit.server");
  const startedAt = new Date().toISOString();
  const result = await runCatalogueAudit();

  return {
    ok: true as const,
    score: result.score,
    pagesCrawled: result.pagesCrawled,
    issuesFound: result.issuesFound,
    message: `Audit complete — ${result.pagesCrawled} indexable page(s), ${result.issuesFound} issue(s)`,
    startedAt,
  };
});

export const runTechnicalChecks = createServerFn({ method: "POST" }).handler(async () => {
  await seoOperator("Running technical checks");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const counts = await supabaseAdmin
    .from("seo_technical_checks")
    .select("id", { count: "exact", head: true });
  if (counts.error) throw new Error(counts.error.message);
  const recorded = counts.count ?? 0;

  // Nothing is executed here: this counts the checks already recorded. It used
  // to say "N live technical checks completed" over a capped page of rows.
  return {
    ok: true,
    checked: recorded,
    message: `${recorded} technical check record(s) on file; this does not run new checks`,
  };
});

/**
 * Generate the monthly SEO report.
 *
 * The message this returns — "generated from live records" — used to sit on
 * top of a summary of eight hardcoded constants: clicks 0, impressions 0,
 * conversions 0, tracked_keywords 0, open_issues 0, and so on. Nothing was
 * read. The figures now come from `seo_report_summary`, which counts them in
 * SQL over `seo_keyword_rankings` and `seo_issues`, because a report is an
 * aggregate and an aggregate computed from a fetched page of rows is wrong as
 * soon as the table outgrows the page.
 */
export const generateSeoReport = createServerFn({ method: "POST" }).handler(async () => {
  await seoOperator("Generating the SEO report");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const date = new Date().toISOString();
  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const periodEnd = date.slice(0, 10);

  // `seo_report_summary` is not in src/integrations/supabase/types.ts: that
  // file is generated, and it only knows the functions that existed the last
  // time it was generated. Every other RPC caller in this codebase works
  // around it by hand-rolling an untyped client — there are twenty-three
  // copies of that helper. Rather than add a twenty-fourth, this narrows the
  // one call site.
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  const { data: summary, error: summaryError } = await rpc("seo_report_summary", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });
  if (summaryError) throw new Error(summaryError.message);

  const figures = (summary ?? {}) as Record<string, unknown>;
  const { error } = await supabaseAdmin.from("seo_reports").insert({
    name: `Monthly SEO report · ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
    report_type: "monthly",
    status: "ready",
    period_start: periodStart,
    period_end: periodEnd,
    generated_at: date,
    summary,
  });

  if (error) throw new Error(error.message);

  // A period with no ranking rows in it is said out loud, so nobody reads a
  // measured zero into a month that was never measured.
  const rows = Number(figures.ranking_rows ?? 0);
  const message = rows
    ? `SEO report generated — ${figures.clicks} click(s), ${figures.impressions} impression(s), ${figures.open_issues} open issue(s)`
    : `SEO report generated — no ranking data recorded between ${periodStart} and ${periodEnd}; ${figures.open_issues} open issue(s)`;

  return { ok: true, message, generatedAt: date, summary: figures };
});

export const recrawlUrl = createServerFn({ method: "POST" })
  .inputValidator((value) => recrawlSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Re-crawling a URL");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: record, error } = await supabaseAdmin
      .from("seo_indexing_records")
      .select("id,url")
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!record) throw new Error("Indexing record not found");

    // A real request. This used to decide the status from whether the URL
    // string contained "softwarevala.com" and record that as a crawl. Only the
    // site's own pages are fetched, so a record cannot point the server at
    // somewhere else.
    const { siteUrl } = await import("@/lib/seo/site-url");
    const site = siteUrl();
    let target: URL;
    try {
      target = new URL(String(record.url ?? ""), site);
    } catch {
      throw new Error("That indexing record does not hold a valid URL.");
    }
    if (target.origin !== new URL(site).origin) {
      throw new Error(`Only ${new URL(site).host} pages are re-crawled from here.`);
    }
    let status = 0;
    try {
      const response = await fetch(target, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      status = response.status;
    } catch {
      status = 0;
    }

    const { error: writeError } = await supabaseAdmin
      .from("seo_indexing_records")
      .update({
        crawl_status: status === 200 ? "crawled" : "error",
        index_state: status === 200 ? "eligible" : "excluded",
        http_status: status,
        last_crawled_at: new Date().toISOString(),
        notes:
          status === 200
            ? "Live URL check completed."
            : status === 0
              ? "The URL did not answer within 15 seconds."
              : `Live URL returned HTTP ${status}.`,
      })
      .eq("id", data.id);
    if (writeError) throw new Error(writeError.message);

    return { ok: true, httpStatus: status, status: status === 200 ? "crawled" : "error" };
  });

export const syncSearchConsole = createServerFn({ method: "POST" })
  .inputValidator((value) => searchConsoleSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Syncing Search Console");
    // There is no Search Console client in this codebase. This used to answer
    // "N day(s) synced" after reading one row, which a person reads as a sync.
    throw new Error(`Search Console is not connected, so nothing was synced for ${data.siteUrl}.`);
  });

export const syncSemrush = createServerFn({ method: "POST" })
  .inputValidator((value) => semrushSchema.parse(value ?? {}))
  .handler(async ({ data }) => {
    await seoOperator("Importing from Semrush");
    // No Semrush client exists here either; "N imported" was one row read.
    throw new Error(`Semrush is not connected, so nothing was imported for ${data.domain}.`);
  });
