import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SITE_ORIGINS = new Set(["softwarevala.com", "www.softwarevala.com"]);

function resolveSiteUrl(value: string): URL {
  const url = new URL(value.startsWith("http") ? value : `https://softwarevala.com${value.startsWith("/") ? value : `/${value}`}`);
  if (!SITE_ORIGINS.has(url.hostname)) throw new Error("Only Software Vala URLs can be checked.");
  return url;
}

async function fetchSite(url: URL): Promise<{ response: Response; html: string; elapsedMs: number }> {
  const started = performance.now();
  const response = await fetch(url, {
    headers: { "User-Agent": "SoftwareVala-SEO-Manager/1.0" },
    redirect: "follow",
  });
  const html = (response.headers.get("content-type") ?? "").includes("text/html")
    ? await response.text()
    : "";
  return { response, html, elapsedMs: Math.round(performance.now() - started) };
}

export async function recrawlIndexingRecord(id: string) {
  const { data: record, error } = await supabaseAdmin
    .from("seo_indexing_records")
    .select("id,url")
    .eq("id", id)
    .single();
  if (error || !record) throw new Error(error?.message ?? "Indexing record not found");

  const checkedAt = new Date().toISOString();
  try {
    const url = resolveSiteUrl(record.url);
    const { response } = await fetchSite(url);
    const crawlStatus = response.ok ? "crawled" : "error";
    const indexState = response.ok ? "eligible" : "excluded";
    const { error: updateError } = await supabaseAdmin
      .from("seo_indexing_records")
      .update({
        crawl_status: crawlStatus,
        index_state: indexState,
        http_status: response.status,
        last_crawled_at: checkedAt,
        notes: response.ok ? "Live URL check completed." : `Live URL returned HTTP ${response.status}.`,
      })
      .eq("id", id);
    if (updateError) throw updateError;
    return { status: crawlStatus, httpStatus: response.status };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await supabaseAdmin
      .from("seo_indexing_records")
      .update({ crawl_status: "error", last_crawled_at: checkedAt, notes: message.slice(0, 500) })
      .eq("id", id);
    throw new Error(`Live crawl failed: ${message}`);
  }
}

export async function runLiveTechnicalChecks() {
  const home = resolveSiteUrl("https://softwarevala.com/");
  const robots = resolveSiteUrl("https://softwarevala.com/robots.txt");
  const sitemap = resolveSiteUrl("https://softwarevala.com/sitemap.xml");
  const [homeResult, robotsResult, sitemapResult] = await Promise.all([
    fetchSite(home),
    fetchSite(robots),
    fetchSite(sitemap),
  ]);

  const canonical = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(homeResult.html);
  const schema = /<script[^>]+type=["']application\/ld\+json["']/i.test(homeResult.html);
  const now = new Date().toISOString();
  const checks = [
    { name: "Homepage response", category: "crawlability", status: homeResult.response.ok ? "pass" : "fail", detail: `HTTP ${homeResult.response.status} in ${homeResult.elapsedMs}ms` },
    { name: "robots.txt", category: "crawlability", status: robotsResult.response.ok ? "pass" : "fail", detail: `HTTP ${robotsResult.response.status}` },
    { name: "XML sitemap", category: "crawlability", status: sitemapResult.response.ok ? "pass" : "fail", detail: `HTTP ${sitemapResult.response.status}` },
    { name: "Canonical tag", category: "on-page", status: canonical ? "pass" : "warning", detail: canonical ? "Canonical tag found on homepage" : "Canonical tag not found on homepage" },
    { name: "Structured data", category: "schema", status: schema ? "pass" : "warning", detail: schema ? "JSON-LD found on homepage" : "JSON-LD not found on homepage" },
  ];

  for (const check of checks) {
    const { data: existing } = await supabaseAdmin
      .from("seo_technical_checks")
      .select("id")
      .eq("name", check.name)
      .limit(1)
      .maybeSingle();
    const values = { ...check, affected_urls: check.status === "pass" ? 0 : 1, last_checked_at: now };
    if (existing) await supabaseAdmin.from("seo_technical_checks").update(values).eq("id", existing.id);
    else await supabaseAdmin.from("seo_technical_checks").insert(values);
  }
  return { checked: checks.length, failing: checks.filter((item) => item.status !== "pass").length };
}

export async function runSiteAuditOperation() {
  const startedAt = new Date().toISOString();
  const { data: audit, error: createError } = await supabaseAdmin
    .from("seo_audits")
    .insert({ name: `Live audit · ${new Date().toLocaleDateString("en-US")}`, status: "running", score: 0, pages_crawled: 0, issues_found: 0, started_at: startedAt })
    .select("id")
    .single();
  if (createError || !audit) throw new Error(createError?.message ?? "Could not start audit");

  try {
    // Counted by the database, not worked out from a fetched list. Every
    // figure below used to be a percentage or an average of whatever rows
    // happened to arrive, and a REST read here stops at 10,000 without
    // saying so — so past that the audit would measure the first ten thousand
    // pages and present the result as the coverage of the site.
    const [{ data: snapshot, error: snapError }, live] = await Promise.all([
      supabaseAdmin.rpc("mm_seo_audit_snapshot"),
      fetchSite(resolveSiteUrl("https://softwarevala.com/")),
    ]);
    if (snapError) throw new Error(snapError.message);

    const s = (snapshot ?? {}) as Record<string, number>;
    const num = (key: string) => Number(s[key] ?? 0);

    const liveAvailability = live.response.ok ? 100 : 0;
    const breakdown = {
      on_page: num("on_page"),
      metadata: Math.round((num("meta_title") + num("meta_description")) / 2),
      headings: num("h1"),
      canonicals: num("canonical_url"),
      indexability: num("indexability"),
      technical: num("technical"),
      availability: liveAvailability,
    };
    const score = Math.round(
      Object.values(breakdown).reduce((sum, value) => sum + value, 0) /
        Object.keys(breakdown).length,
    );
    const pagesCrawled = num("pages");
    const issuesFound = num("issues");

    const { error } = await supabaseAdmin
      .from("seo_audits")
      .update({
        status: "completed",
        score,
        pages_crawled: pagesCrawled,
        issues_found: issuesFound,
        breakdown,
        completed_at: new Date().toISOString(),
      })
      .eq("id", audit.id);
    if (error) throw error;
    return { auditId: audit.id, score, pages: pagesCrawled, issues: issuesFound };
  } catch (cause) {
    await supabaseAdmin.from("seo_audits").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", audit.id);
    throw cause;
  }
}

export async function generateSeoReportOperation() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86_400_000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  // Summed in SQL. These were totals and averages of a fetched page of rows,
  // which a REST read caps at 10,000 without reporting it — so a busy month
  // would have been reported as the sum of the first ten thousand days.
  const { data: summaryRow, error } = await supabaseAdmin.rpc("mm_seo_report_summary", {
    p_start: startDate,
    p_end: endDate,
  });
  if (error) throw new Error(error.message);
  const summary = (summaryRow ?? {}) as Record<string, number | null>;
  const { data: report, error: insertError } = await supabaseAdmin.from("seo_reports").insert({ name: `Monthly SEO report · ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`, report_type: "monthly", period_start: startDate, period_end: endDate, status: "ready", summary, generated_at: new Date().toISOString() }).select("*").single();
  if (insertError || !report) throw new Error(insertError?.message ?? "Could not save report");
  return report;
}