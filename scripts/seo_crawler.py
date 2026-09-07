#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SEO crawler for softwarevala.net.

The SEO Center holds 3,689 keywords and 2,160 rankings, and none of it can be
refreshed: every provider — Google Search Console, GA4, Semrush, Google Ads —
is disconnected, with last_sync_at of never, and no credential for any of them
exists in this environment. Those 2,160 ranking rows were inserted inside a
single minute, so they are a bulk import rather than anything tracked.

This does not need a provider. It fetches our own pages and records what is
actually there: the status line, the title, the meta description, the H1s, the
canonical, the word count and the images without alt text. Every issue it
writes is something a person can go and look at.

It respects robots.txt, keeps to one host, rate limits itself, and only ever
touches softwarevala.net — the property we own.

Findings go to seo_pages and seo_issues, the tables that already exist, using
the issue types already in use. Issues it no longer finds are resolved rather
than deleted, so the history of what was fixed survives.
"""

import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

SITE = "https://softwarevala.net"
UA = "SoftwareVala-SEOCrawler/1.0 (+https://softwarevala.net)"
TIMEOUT = 20
DELAY_S = 0.4          # be gentle with our own server
MAX_PAGES = int(os.environ.get("SEO_CRAWL_MAX", "40"))

# Thresholds. Stated here rather than buried, because they decide what counts
# as an issue and somebody should be able to argue with them.
TITLE_MIN, TITLE_MAX = 15, 65
DESC_MIN, DESC_MAX = 70, 160
THIN_WORDS = 250


def rest(path, method="GET", body=None, extra_headers=None):
    url = "%s/rest/v1/%s" % (SUPABASE_URL, path)
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": "Bearer %s" % SERVICE_KEY,
        "Content-Type": "application/json",
        "User-Agent": UA,
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else []
    except urllib.error.HTTPError as exc:
        # Say what the database objected to, rather than a bare 400.
        detail = exc.read().decode("utf-8", "replace")[:400]
        raise RuntimeError("%s %s -> HTTP %s: %s" % (method, path, exc.code, detail)) from None


def text_of(html, pattern, flags=re.I | re.S):
    m = re.search(pattern, html, flags)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else None


def crawl_one(url):
    """Fetch one page and read what is actually in it."""
    started = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            status = res.status
            html = res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return {"url": url, "status": exc.code, "error": "HTTP %s" % exc.code, "html": ""}
    except Exception as exc:                                   # noqa: BLE001
        return {"url": url, "status": 0, "error": str(exc)[:200], "html": ""}

    ms = int((time.time() - started) * 1000)

    title = text_of(html, r"<title[^>]*>(.*?)</title>")
    desc = text_of(html, r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']')
    if not desc:
        desc = text_of(html, r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']')
    canonical = text_of(html, r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\'](.*?)["\']')
    h1s = re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    h1s = [re.sub(r"<[^>]+>", "", h).strip() for h in h1s]
    h1s = [h for h in h1s if h]

    # Visible words, roughly: strip script/style then tags.
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.I | re.S)
    body = re.sub(r"<[^>]+>", " ", body)
    words = len(re.findall(r"[A-Za-z']+", body))

    imgs = re.findall(r"<img\b[^>]*>", html, re.I)
    no_alt = [i for i in imgs if not re.search(r'\balt\s*=\s*["\'][^"\']', i, re.I)]

    has_schema = bool(re.search(r'application/ld\+json', html, re.I))
    noindex = bool(re.search(r'<meta[^>]+name=["\']robots["\'][^>]*noindex', html, re.I))

    links = set()
    for href in re.findall(r'<a\b[^>]+href=["\']([^"\'#?]+)', html, re.I):
        joined = urllib.parse.urljoin(url, href)
        # /cdn-cgi/ is Cloudflare's own infrastructure, not a page of ours.
        if "/cdn-cgi/" in joined:
            continue
        if joined.startswith(SITE):
            links.add(joined.split("#")[0].rstrip("/") or SITE)

    return {
        "url": url, "status": status, "ms": ms, "html": html,
        "title": title, "description": desc, "canonical": canonical,
        "h1s": h1s, "words": words, "images": len(imgs), "images_no_alt": len(no_alt),
        "has_schema": has_schema, "noindex": noindex, "links": links, "error": None,
    }


def issues_for(page):
    """Every issue is something a person could open the page and confirm."""
    out = []

    def add(kind, severity, category, description, fix):
        out.append({
            "page_url": page["url"], "issue_type": kind, "category": category,
            "severity": severity, "description": description, "fix_suggestion": fix,
            "status": "open",
        })

    if page["status"] == 0 or page["status"] >= 500:
        add("broken_internal_link", "high", "technical",
            "The page did not respond (%s)." % (page.get("error") or page["status"]),
            "Check the server and the route.")
        return out
    if page["status"] == 404:
        add("broken_internal_link", "high", "technical",
            "The page returns 404.", "Restore the page or redirect it.")
        return out

    title = page.get("title") or ""
    if not title:
        add("duplicate_title", "high", "on_page",
            "The page has no <title>.", "Give the page a unique title.")
    elif len(title) < TITLE_MIN:
        add("duplicate_title", "medium", "on_page",
            "The title is %d characters, under the %d-character guide."
            % (len(title), TITLE_MIN), "Lengthen the title.")
    elif len(title) > TITLE_MAX:
        add("duplicate_title", "low", "on_page",
            "The title is %d characters and will be truncated in results."
            % len(title), "Shorten the title to about %d characters." % TITLE_MAX)

    desc = page.get("description") or ""
    if not desc:
        add("missing_meta_description", "high", "on_page",
            "The page has no meta description.",
            "Write a description of %d-%d characters." % (DESC_MIN, DESC_MAX))
    elif len(desc) < DESC_MIN:
        add("thin_description", "medium", "on_page",
            "The meta description is %d characters, under the %d-character guide."
            % (len(desc), DESC_MIN), "Expand the description.")

    if not page.get("h1s"):
        add("missing_image", "high", "on_page",
            "The page has no H1.", "Add a single H1 describing the page.")
    elif len(page["h1s"]) > 1:
        add("duplicate_title", "medium", "on_page",
            "The page has %d H1 elements." % len(page["h1s"]),
            "Keep one H1 and demote the rest to H2.")

    if page.get("images_no_alt"):
        add("missing_alt_text", "medium", "accessibility",
            "%d of %d images have no alt text."
            % (page["images_no_alt"], page["images"]),
            "Describe each image, or mark it decorative with alt=\"\".")

    if not page.get("canonical"):
        add("schema_missing", "low", "technical",
            "The page declares no canonical URL.",
            "Add a canonical link so duplicates resolve to one address.")

    if not page.get("has_schema"):
        add("schema_missing", "medium", "technical",
            "The page carries no JSON-LD structured data.",
            "Add schema appropriate to the page type.")

    if page.get("words", 0) < THIN_WORDS:
        add("thin_content", "medium", "content",
            "The page has about %d words, under the %d-word guide."
            % (page.get("words", 0), THIN_WORDS),
            "Expand the page, or mark it as intentionally short.")

    if page.get("ms", 0) > 3000:
        add("slow_lcp", "high", "performance",
            "The page took %d ms to respond." % page["ms"],
            "Investigate the server render time for this route.")

    return out


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("seo-crawler: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        return 1

    # robots.txt is honoured, on our own site as much as anywhere.
    robots = urllib.robotparser.RobotFileParser()
    robots.set_url(SITE + "/robots.txt")
    try:
        robots.read()
    except Exception:                                          # noqa: BLE001
        robots = None

    seen, queue, pages = set(), [SITE], []

    while queue and len(pages) < MAX_PAGES:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        if robots and not robots.can_fetch(UA, url):
            print("  skipped by robots.txt: %s" % url)
            continue

        page = crawl_one(url)
        pages.append(page)
        print("  %-58s %s  %sms  %s words" % (
            url[:58], page["status"], page.get("ms", "-"), page.get("words", "-")))

        for link in sorted(page.get("links") or []):
            if link not in seen and len(seen) + len(queue) < MAX_PAGES * 3:
                queue.append(link)
        time.sleep(DELAY_S)

    # Record the pages.
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    found_issues = []
    for p in pages:
        issues = issues_for(p)
        found_issues.extend(issues)

        # A score out of 100 from the checks that actually ran, not a constant.
        penalty = sum({"high": 15, "medium": 7, "low": 3}.get(i["severity"], 5) for i in issues)
        score = max(0, 100 - penalty)

        rest("seo_pages?on_conflict=url", method="POST", body=[{
            "url": p["url"],
            # title is NOT NULL. A page without one is exactly what we want to
            # record, so it is stored with a marker rather than dropped.
            "title": (p.get("title") or "")[:300] or "(no title)",
            "meta_title": (p.get("title") or "")[:300] or None,
            "meta_description": (p.get("description") or "")[:500] or None,
            "h1": (p.get("h1s") or [None])[0],
            "canonical_url": p.get("canonical"),
            "word_count": p.get("words") or 0,
            "seo_score": score,
            "index_status": "noindex" if p.get("noindex") else (
                "indexable" if p["status"] == 200 else "error"),
            "issues_count": len(issues),
            "last_crawled_at": now,
        }], extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"})

    # Issues this crawl found, replacing what the crawler said last time for
    # these URLs. Anything it no longer finds is resolved, not deleted.
    crawled_urls = [p["url"] for p in pages]
    for url in crawled_urls:
        rest("seo_issues?page_url=eq.%s&status=eq.open" % urllib.parse.quote(url, safe=""),
             method="PATCH",
             body={"status": "resolved", "resolved_at": now},
             extra_headers={"Prefer": "return=minimal"})

    if found_issues:
        for i in range(0, len(found_issues), 100):
            batch = found_issues[i:i + 100]
            for row in batch:
                row["detected_at"] = now
            rest("seo_issues", method="POST", body=batch,
                 extra_headers={"Prefer": "return=minimal"})

    by_sev = {}
    for i in found_issues:
        by_sev[i["severity"]] = by_sev.get(i["severity"], 0) + 1

    avg = int(sum(max(0, 100 - sum({"high": 15, "medium": 7, "low": 3}.get(x["severity"], 5)
                                   for x in issues_for(p))) for p in pages) / max(len(pages), 1))

    rest("seo_audits", method="POST", body=[{
        "name": "Crawl of %s" % SITE,
        "status": "completed",
        "score": avg,
        "pages_crawled": len(pages),
        "issues_found": len(found_issues),
        "breakdown": by_sev,
        "started_at": now,
        "completed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }], extra_headers={"Prefer": "return=minimal"})

    print("crawler: %d pages, %d issues (%s), average score %d" % (
        len(pages), len(found_issues),
        ", ".join("%s %s" % (v, k) for k, v in sorted(by_sev.items())) or "none", avg))
    return 0


if __name__ == "__main__":
    sys.exit(main())
