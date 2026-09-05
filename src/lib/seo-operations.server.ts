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
    const [{ data: pages }, { data: issues }, live] = await Promise.all([
      supabaseAdmin.from("seo_pages").select("id,meta_title,meta_description,h1,canonical_url,index_status,seo_score"),
      supabaseAdmin.from("seo_issues").select("id,severity,status").neq("status", "resolved"),
      fetchSite(resolveSiteUrl("https://softwarevala.com/")),
    ]);
    const pageRows = pages ?? [];
    const issueRows = issues ?? [];
    const coverage = (field: "meta_title" | "meta_description" | "h1" | "canonical_url") =>
      pageRows.length ? Math.round((pageRows.filter((page) => Boolean(page[field])).length / pageRows.length) * 100) : 0;
    const onPage = pageRows.length ? Math.round(pageRows.reduce((sum, page) => sum + page.seo_score, 0) / pageRows.length) : 0;
    const indexability = pageRows.length ? Math.round((pageRows.filter((page) => page.index_status === "indexed").length / pageRows.length) * 100) : 0;
    const technical = Math.max(0, 100 - issueRows.reduce((sum, issue) => sum + (issue.severity === "critical" ? 12 : issue.severity === "high" ? 7 : 3), 0));
    const liveAvailability = live.response.ok ? 100 : 0;
    const breakdown = { on_page: onPage, metadata: Math.round((coverage("meta_title") + coverage("meta_description")) / 2), headings: coverage("h1"), canonicals: coverage("canonical_url"), indexability, technical, availability: liveAvailability };
    const score = Math.round(Object.values(breakdown).reduce((sum, value) => sum + value, 0) / Object.keys(breakdown).length);
    const { error } = await supabaseAdmin.from("seo_audits").update({ status: "completed", score, pages_crawled: pageRows.length, issues_found: issueRows.length, breakdown, completed_at: new Date().toISOString() }).eq("id", audit.id);
    if (error) throw error;
    return { auditId: audit.id, score, pages: pageRows.length, issues: issueRows.length };
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
  const [{ data: metrics, error }, { data: keywords }, { data: issues }] = await Promise.all([
    supabaseAdmin.from("seo_performance_metrics").select("clicks,impressions,conversions,avg_position").gte("recorded_on", startDate).lte("recorded_on", endDate),
    supabaseAdmin.from("seo_keywords").select("position,previous_position,status"),
    supabaseAdmin.from("seo_issues").select("severity,status"),
  ]);
  if (error) throw new Error(error.message);
  const rows = metrics ?? [];
  const summary = {
    clicks: rows.reduce((sum, row) => sum + row.clicks, 0),
    impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    average_position: rows.length ? Number((rows.reduce((sum, row) => sum + Number(row.avg_position), 0) / rows.length).toFixed(2)) : null,
    tracked_keywords: (keywords ?? []).filter((row) => row.status === "tracking").length,
    improved_keywords: (keywords ?? []).filter((row) => row.position != null && row.previous_position != null && row.position < row.previous_position).length,
    open_issues: (issues ?? []).filter((row) => row.status !== "resolved").length,
    critical_issues: (issues ?? []).filter((row) => row.status !== "resolved" && ["critical", "high"].includes(row.severity)).length,
  };
  const { data: report, error: insertError } = await supabaseAdmin.from("seo_reports").insert({ name: `Monthly SEO report · ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`, report_type: "monthly", period_start: startDate, period_end: endDate, status: "ready", summary, generated_at: new Date().toISOString() }).select("*").single();
  if (insertError || !report) throw new Error(insertError?.message ?? "Could not save report");
  return report;
}