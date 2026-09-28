/**
 * Brings the business's own YouTube films into Vala TV, and keeps them coming.
 *
 * vala_tv_videos was empty, so /vala-tv and the homepage's Vala TV section had
 * nothing to show while fifteen real films sat on youtube.com/@softwarevala.
 * This closes that gap and keeps it closed: a new upload appears on the site by
 * itself, without anybody remembering to copy it across.
 *
 * It reads YouTube's per-channel Atom feed:
 *
 *     https://www.youtube.com/feeds/videos.xml?channel_id=UC...
 *
 * That feed is public. It needs no API key, no OAuth and no quota, which is
 * why it is used in preference to the YouTube Data API service sitting
 * inactive in AI API Manager - there is nothing to configure and nothing to
 * expire. The trade is that the feed carries only the most recent uploads and
 * no duration; duration is therefore left null rather than guessed at.
 *
 * Which channel is not configured here. It is read from
 * storefront_social_links, where the business's YouTube channel is already
 * recorded and already shown in the footer, so there is one answer to "which
 * channel is ours" rather than two that can drift apart.
 *
 * What it will and will not do:
 *
 *   * It only ever inserts a film it has not seen, and refreshes the title,
 *     description and thumbnail of one it has. The unique index on
 *     (source, external_id) means running it twice changes nothing.
 *   * It never deletes. A film taken down on YouTube is reported and left in
 *     place for an operator to decide about, because removing a published page
 *     is not a script's decision to make.
 *   * It never touches a film an operator created by hand: those are
 *     source='manual' and are not in its scope.
 *   * It invents nothing. No duration, no view count, no description that did
 *     not come from the feed.
 *
 *   node scripts/ops/vala-tv-youtube-sync.mjs [--apply]
 *
 * Without --apply it reports what it would change and writes nothing.
 */

const BASE = (process.env.SUPABASE_URL ?? "").trim();
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const APPLY = process.argv.includes("--apply");
const AGENT_KEY = "mon-social";

if (!BASE || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const response = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* a non-JSON body is reported as text below */
  }
  return { ok: response.ok, status: response.status, json, text };
}

// ---------------------------------------------------------------- agent run

async function openRun(action) {
  const answer = await rest("rpc/fa_agent_run_open", {
    method: "POST",
    body: JSON.stringify({
      p_agent_key: AGENT_KEY,
      p_scope: "vala-tv",
      // mon-social holds READ, ANALYZE, RECOMMEND and CREATE. Creating video
      // records is CREATE; a dry run only looks, so it is READ. The database
      // refuses a permission the agent does not hold, which is the point.
      p_permission: APPLY ? "CREATE" : "READ",
      p_input_source: "youtube-channel-feed",
      p_action: action,
    }),
  });
  const id = answer.json?.run_id ?? answer.json?.id ?? null;
  if (!id) console.log(`  (no agent run recorded: ${answer.json?.reason ?? answer.status})`);
  return id;
}

async function closeRun(id, state, result, error) {
  if (!id) return;
  await rest("rpc/fa_agent_run_close", {
    method: "POST",
    body: JSON.stringify({ p_run: id, p_state: state, p_result: result, p_error: error ?? null }),
  }).catch(() => {});
}

// ---------------------------------------------------------------- the channel

/** The business's YouTube channel, from where the business already records it. */
async function channelFromSocialLinks() {
  const rows = await rest("storefront_social_links?select=platform,url,handle&enabled=is.true");
  const youtube = (rows.json ?? []).find((r) => String(r.platform).toLowerCase() === "youtube");
  if (!youtube?.url) return null;
  return { url: String(youtube.url), handle: youtube.handle ? String(youtube.handle) : null };
}

/**
 * A channel id, from whichever form of the URL the business recorded.
 *
 * A /channel/UC... URL already carries it. A /@handle URL does not, so the
 * channel page is read once and the id taken from it - the same id YouTube
 * puts in its own markup, not one this script makes up.
 */
async function resolveChannelId(channelUrl) {
  const direct = channelUrl.match(/channel\/(UC[A-Za-z0-9_-]{22})/);
  if (direct) return direct[1];

  const response = await fetch(channelUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SoftwareVala/1.0)" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`the channel page answered ${response.status}`);
  const html = await response.text();
  const found =
    html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/) ??
    html.match(/channel\/(UC[A-Za-z0-9_-]{22})/);
  if (!found) throw new Error("the channel page carried no channel id");
  return found[1];
}

// ---------------------------------------------------------------- the feed

const unescapeXml = (value) =>
  String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? unescapeXml(m[1]).trim() : null;
};

async function readFeed(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; SoftwareVala/1.0)" } });
  if (!response.ok) throw new Error(`the channel feed answered ${response.status}`);
  const xml = await response.text();

  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((m) => m[1])
    .map((entry) => {
      const externalId = pick(entry, "yt:videoId");
      if (!externalId) return null;
      const thumb = entry.match(/<media:thumbnail[^>]*url="([^"]+)"/);
      return {
        external_id: externalId,
        title: pick(entry, "title") ?? externalId,
        description: pick(entry, "media:description"),
        source_url: `https://www.youtube.com/watch?v=${externalId}`,
        thumbnail_url: thumb ? unescapeXml(thumb[1]) : `https://i.ytimg.com/vi/${externalId}/hqdefault.jpg`,
        published_at: pick(entry, "published"),
      };
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------- the sync

async function main() {
  const channel = await channelFromSocialLinks();
  if (!channel) {
    throw new Error(
      "No enabled YouTube row in storefront_social_links. Add the channel there - it is where the footer reads it from too - and this will follow.",
    );
  }
  console.log(`channel : ${channel.url}${channel.handle ? ` (${channel.handle})` : ""}`);

  const channelId = await resolveChannelId(channel.url);
  console.log(`id      : ${channelId}`);

  const films = await readFeed(channelId);
  console.log(`feed    : ${films.length} film(s)\n`);
  if (films.length === 0) {
    return { added: 0, refreshed: 0, gone: 0, total: 0 };
  }

  const ids = films.map((f) => f.external_id);
  const existingRows = await rest(
    `vala_tv_videos?select=id,external_id,title,description,thumbnail_url,status&source=eq.youtube&external_id=in.(${ids.join(",")})`,
  );
  const existing = new Map((existingRows.json ?? []).map((r) => [r.external_id, r]));

  const toAdd = films.filter((f) => !existing.has(f.external_id));
  const toRefresh = films.filter((f) => {
    const row = existing.get(f.external_id);
    if (!row) return false;
    return (
      row.title !== f.title ||
      (row.description ?? null) !== (f.description ?? null) ||
      (row.thumbnail_url ?? null) !== (f.thumbnail_url ?? null)
    );
  });

  // A film the feed no longer carries is reported, never removed. The feed
  // only holds the most recent uploads, so "absent from the feed" does not
  // mean "deleted from the channel" - which is exactly why this script must
  // not act on it.
  const allOurs = await rest("vala_tv_videos?select=external_id,title&source=eq.youtube");
  const missing = (allOurs.json ?? []).filter((r) => r.external_id && !ids.includes(r.external_id));

  console.log(`already here : ${existing.size}`);
  console.log(`new          : ${toAdd.length}`);
  console.log(`changed      : ${toRefresh.length}`);
  console.log(`not in feed  : ${missing.length}  (left alone - the feed only carries recent uploads)`);

  if (!APPLY) {
    for (const f of toAdd.slice(0, 20)) console.log(`   would add  [${f.external_id}] ${f.title.slice(0, 70)}`);
    for (const f of toRefresh.slice(0, 20)) console.log(`   would fresh[${f.external_id}] ${f.title.slice(0, 70)}`);
    console.log("\ndry run - nothing written. Re-run with --apply.");
    return { added: 0, refreshed: 0, gone: missing.length, total: films.length };
  }

  let added = 0;
  if (toAdd.length > 0) {
    // Newest last, so `position` ascends with age and the newest film sorts
    // first on a page that orders by position.
    const payload = toAdd.map((f, i) => ({
      title: f.title,
      description: f.description,
      url: f.source_url,
      source_url: f.source_url,
      thumbnail_url: f.thumbnail_url,
      published_at: f.published_at,
      status: "published",
      source: "youtube",
      external_id: f.external_id,
      channel_id: channelId,
      language: "en",
      position: 10 + i,
      synced_at: new Date().toISOString(),
    }));
    const insert = await rest("vala_tv_videos", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify(payload),
    });
    if (!insert.ok) throw new Error(`insert failed ${insert.status}: ${insert.text.slice(0, 200)}`);
    added = Array.isArray(insert.json) ? insert.json.length : 0;
  }

  let refreshed = 0;
  for (const f of toRefresh) {
    const update = await rest(
      `vala_tv_videos?source=eq.youtube&external_id=eq.${encodeURIComponent(f.external_id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: f.title,
          description: f.description,
          thumbnail_url: f.thumbnail_url,
          synced_at: new Date().toISOString(),
        }),
      },
    );
    if (update.ok) refreshed += 1;
  }

  // Everything the feed confirmed is still there gets its synced_at moved on,
  // so a film that stops being confirmed is visible by its stale timestamp.
  await rest(`vala_tv_videos?source=eq.youtube&external_id=in.(${ids.join(",")})`, {
    method: "PATCH",
    body: JSON.stringify({ synced_at: new Date().toISOString() }),
  }).catch(() => {});

  console.log(`\nadded ${added}, refreshed ${refreshed}`);
  return { added, refreshed, gone: missing.length, total: films.length };
}

const run = await openRun(APPLY ? "sync" : "check");
try {
  const summary = await main();
  await closeRun(
    run,
    "COMPLETED",
    `feed ${summary.total}, added ${summary.added}, refreshed ${summary.refreshed}, not-in-feed ${summary.gone}`,
  );
  process.exit(0);
} catch (problem) {
  const message = problem instanceof Error ? problem.message : String(problem);
  console.error(`FAILED: ${message}`);
  await closeRun(run, "FAILED", null, message.slice(0, 500));
  process.exit(1);
}
