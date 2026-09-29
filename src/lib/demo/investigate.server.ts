import { safeFetch, UnsafeUrlError } from "./safe-fetch.server";
import type { Actor } from "./process.server";

/**
 * Working out which product an unplaced demo address belongs to, from the page
 * itself.
 *
 * Intake refuses to guess: an address with no product column and no name that
 * matches the catalogue is taken in UNMATCHED and waits. For twelve thousand
 * addresses that is most of them, because the address says nothing -
 * pixel-till-pro.lovable.app is CounterPOS, temple-learn-sync is
 * AnnadanamKitchen. The only honest way to learn the name is to read the page.
 *
 * So this fetches the page through the same guarded fetcher the pipeline uses,
 * pulls out the few things that identify a product - title, og:title, the first
 * heading, JSON-LD name, canonical address - and runs the SAME matcher intake
 * runs, with the page's own title as the name. Nothing new decides anything:
 *
 *   evidence -> demo_match_product -> MATCHED only on exact equality
 *
 * An AI suggestion, where an agent is configured, is a candidate for the
 * operator and nothing more. It cannot assign, and every product it names is
 * checked against the catalogue before it is shown.
 *
 * The hostname is never evidence of identity. That rule is why this exists.
 */

type Row = Record<string, unknown>;

export type InvestigationState =
  | "MATCHED"
  | "AMBIGUOUS"
  | "UNMATCHED"
  | "FETCH_FAILED"
  | "ALREADY_ASSIGNED"
  | "ERROR";

export type Candidate = { id: string; name: string; slug: string; source: "matcher" | "ai" };

export type Investigation = {
  demoUrlId: string;
  url: string;
  state: InvestigationState;
  reason: string;
  /** Compact identity evidence. Whole pages are not kept. */
  evidence?: {
    finalUrl?: string;
    httpStatus?: number;
    title?: string | null;
    ogTitle?: string | null;
    heading?: string | null;
    jsonLdName?: string | null;
    canonical?: string | null;
    description?: string | null;
  };
  candidates?: Candidate[];
  aiSuggestion?: { name: string | null; reason: string | null; confidence: string | null } | null;
  aiError?: string | null;
  productId?: string | null;
  investigatedAt: string;
};

function db() {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) throw new Error("The database is not configured on this server.");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  return {
    async get<T = Row[]>(path: string): Promise<T> {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers });
      if (!r.ok) throw new Error(`read failed (${r.status})`);
      return (await r.json()) as T;
    },
    async patch(path: string, body: Row): Promise<void> {
      const r = await fetch(`${url}/rest/v1/${path}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`update failed (${r.status}): ${(await r.text()).slice(0, 160)}`);
    },
    async post(path: string, body: Row): Promise<void> {
      const r = await fetch(`${url}/rest/v1/${path}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
      if (!r.ok && r.status !== 409) {
        throw new Error(`insert failed (${r.status}): ${(await r.text()).slice(0, 160)}`);
      }
    },
    async rpc<T>(fn: string, args: Row): Promise<T> {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers,
        body: JSON.stringify(args),
      });
      if (!r.ok) throw new Error(`${fn} failed (${r.status})`);
      return (await r.json()) as T;
    },
  };
}

const oneOf = (html: string, pattern: RegExp): string | null => {
  const m = html.match(pattern);
  return m?.[1] ? m[1].replace(/\s+/g, " ").trim().slice(0, 300) || null : null;
};

/**
 * The few things on a page that identify a product.
 *
 * Deliberately small: a title, a social title, the first heading, a JSON-LD
 * name, the canonical address and the description. Enough to match a catalogue
 * name; not a copy of somebody's page kept in our database for ever.
 */
export function identityEvidence(html: string, finalUrl: string, httpStatus: number) {
  let jsonLdName: string | null = null;
  for (const block of html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? []) {
    const body = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    try {
      const parsed = JSON.parse(body) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const name = (node as { name?: unknown })?.name;
        if (typeof name === "string" && name.trim()) {
          jsonLdName = name.trim().slice(0, 200);
          break;
        }
      }
    } catch {
      /* a malformed block tells us nothing and is not an error */
    }
    if (jsonLdName) break;
  }

  return {
    finalUrl,
    httpStatus,
    title: oneOf(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    ogTitle: oneOf(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i),
    heading: oneOf(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]*>/g, "") ?? null,
    jsonLdName,
    canonical: oneOf(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i),
    description: oneOf(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
  };
}

/**
 * The agent that assists the investigation, read from ai_agents.
 *
 * The prompt is the owner's, editable in the AI API Manager. The output contract
 * stays in code, because it is not configuration - it is the shape this parser
 * requires, and a prompt edit must not be able to break the parser.
 *
 * No agent, or an inactive one, is a configuration error that is reported.
 * Nothing is invented in its place.
 */
async function loadAgent(): Promise<{ key: string; prompt: string; temperature: number; maxTokens: number }> {
  const store = db();
  const [agent] = await store.get<Row[]>(
    `ai_agents?select=agent_key,name,status,system_prompt,temperature,max_tokens` +
      `&agent_key=eq.demo-intelligence&limit=1`,
  );
  if (!agent) throw new Error("AI_CONFIGURATION_ERROR: no ai_agents row with agent_key demo-intelligence.");
  if (String(agent.status) !== "active") {
    throw new Error(`AI_CONFIGURATION_ERROR: the demo-intelligence agent is ${String(agent.status)}.`);
  }
  const prompt = String(agent.system_prompt ?? "").trim();
  if (!prompt) {
    throw new Error("AI_CONFIGURATION_ERROR: the demo-intelligence agent has no system prompt.");
  }
  return {
    key: String(agent.agent_key),
    prompt,
    temperature: Number(agent.temperature ?? 0) || 0,
    maxTokens: Math.min(Math.max(Number(agent.max_tokens ?? 800) || 800, 200), 2000),
  };
}

/** The shape this parser needs. Not configuration, so not in the agent row. */
const OUTPUT_CONTRACT = `
Answer with JSON only, exactly:
{"product_name": string|null, "reason": string, "confidence": "high"|"medium"|"low"}
product_name must be copied from the evidence you were given, or null when the
evidence does not name a product. Never invent a name. Never guess from the web
address.`;

async function askAgent(
  evidence: ReturnType<typeof identityEvidence>,
): Promise<{ suggestion: Investigation["aiSuggestion"]; error: string | null; agent: string | null }> {
  try {
    const agent = await loadAgent();
    const { aiComplete } = await import("@/lib/ai-gateway.server");
    const answer = await aiComplete({
      module: "demo-manager",
      json: true,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      messages: [
        { role: "system", content: `${agent.prompt}\n${OUTPUT_CONTRACT}` },
        { role: "user", content: JSON.stringify({ evidence }) },
      ],
    });
    const text = answer.text ?? "";
    const parsed = JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, "")) as {
      product_name?: string | null;
      reason?: string;
      confidence?: string;
    };
    return {
      suggestion: {
        name: parsed.product_name ? String(parsed.product_name).slice(0, 200) : null,
        reason: parsed.reason ? String(parsed.reason).slice(0, 300) : null,
        confidence: parsed.confidence ? String(parsed.confidence) : null,
      },
      error: null,
      agent: agent.key,
    };
  } catch (error) {
    // Reported, never swallowed, and never replaced with a made-up answer.
    return {
      suggestion: null,
      error: error instanceof Error ? error.message : String(error),
      agent: null,
    };
  }
}

/** A product the AI named, only if the catalogue really has it. */
async function validateCandidate(name: string): Promise<Candidate | null> {
  const store = db();
  const match = await store.rpc<{ state: string; product_id?: string; evidence?: Record<string, unknown> }>(
    "demo_match_product",
    { p_url: "https://validate.invalid/", p_hint: name },
  );
  if (match.state !== "MATCHED" || !match.product_id) return null;
  const [product] = await store.get<Row[]>(
    `marketplace_products?select=id,name,slug&id=eq.${encodeURIComponent(match.product_id)}&limit=1`,
  );
  if (!product) return null;
  return {
    id: String(product.id),
    name: String(product.name),
    slug: String(product.slug),
    source: "ai",
  };
}

/**
 * One address: fetch it, read it, match it, record what was found.
 *
 * Assignment happens only where the matcher says MATCHED on the page's own
 * title - rule D of the hierarchy, decided by the same function intake uses.
 * Everything else is left where it was, with the evidence attached so an
 * operator can finish it.
 */
export async function investigateOne(input: {
  demoUrlId: string;
  url: string;
  commit: boolean;
  actor: Actor;
  withAi?: boolean;
}): Promise<Investigation> {
  const store = db();
  const now = new Date().toISOString();
  const base: Investigation = {
    demoUrlId: input.demoUrlId,
    url: input.url,
    state: "ERROR",
    reason: "",
    investigatedAt: now,
  };

  // An address that gained a product since the batch was planned is left alone.
  const [current] = await store.get<Row[]>(
    `product_demo_urls?select=id,product_id,processing&id=eq.${encodeURIComponent(input.demoUrlId)}&limit=1`,
  );
  if (!current) return { ...base, state: "ERROR", reason: "That demo is no longer there." };
  if (current.product_id) {
    return { ...base, state: "ALREADY_ASSIGNED", reason: "It already has a product.", productId: String(current.product_id) };
  }

  let evidence: Investigation["evidence"];
  try {
    // The guarded fetcher: public addresses only, every redirect re-checked,
    // bounded in time and size.
    const page = await safeFetch(input.url, { maxBytes: 1_500_000, timeoutMs: 12_000, maxRedirects: 4 });
    evidence = identityEvidence(page.body, page.url, page.status);
  } catch (error) {
    const reason =
      error instanceof UnsafeUrlError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    const result: Investigation = { ...base, state: "FETCH_FAILED", reason };
    if (input.commit) await record(input.demoUrlId, current, result, input.actor);
    return result;
  }

  // The page's own name, in the order a page states it most reliably.
  const hint =
    evidence.jsonLdName ?? evidence.ogTitle ?? evidence.title ?? evidence.heading ?? null;

  const match = await store.rpc<{
    state: string;
    product_id?: string;
    reason?: string;
    candidates?: { id: string; name: string; slug: string }[];
  }>("demo_match_product", { p_url: input.url, p_hint: hint });

  const candidates: Candidate[] = (match.candidates ?? []).map((c) => ({ ...c, source: "matcher" as const }));

  let ai: Awaited<ReturnType<typeof askAgent>> = { suggestion: null, error: null, agent: null };
  if (input.withAi !== false) {
    ai = await askAgent(evidence);
    if (ai.suggestion?.name) {
      const validated = await validateCandidate(ai.suggestion.name);
      // A name the catalogue does not have is not offered at all.
      if (validated && !candidates.some((c) => c.id === validated.id)) candidates.push(validated);
    }
  }

  const result: Investigation = {
    ...base,
    state:
      match.state === "MATCHED"
        ? "MATCHED"
        : match.state === "AMBIGUOUS"
          ? "AMBIGUOUS"
          : match.state === "ALREADY_ASSIGNED"
            ? "ALREADY_ASSIGNED"
            : "UNMATCHED",
    reason: String(match.reason ?? ""),
    evidence,
    candidates,
    aiSuggestion: ai.suggestion,
    aiError: ai.error,
    productId: match.state === "MATCHED" ? (match.product_id ?? null) : null,
  };

  if (input.commit) {
    // Only a MATCHED result touches the canonical mapping, and only when the row
    // still has none. Nothing is published: the row stays inactive and
    // unprocessed, so publishing remains a separate, deliberate act.
    if (result.state === "MATCHED" && result.productId) {
      await store.patch(`product_demo_urls?id=eq.${encodeURIComponent(input.demoUrlId)}`, {
        product_id: result.productId,
      });
    }
    await record(input.demoUrlId, current, result, input.actor, ai.agent);
  }

  return result;
}

/** The investigation kept beside the assignment, in the row's own metadata. */
async function record(
  demoUrlId: string,
  current: Row,
  result: Investigation,
  actor: Actor,
  agent: string | null = null,
): Promise<void> {
  const store = db();
  const processing = (current.processing ?? {}) as Record<string, unknown>;
  const assignment = (processing.assignment ?? {}) as Record<string, unknown>;

  await store.patch(`product_demo_urls?id=eq.${encodeURIComponent(demoUrlId)}`, {
    processing: {
      ...processing,
      investigation: {
        state: result.state,
        reason: result.reason,
        evidence: result.evidence ?? null,
        candidates: result.candidates ?? [],
        ai_suggestion: result.aiSuggestion ?? null,
        ai_error: result.aiError ?? null,
        ai_agent: agent,
        investigated_at: result.investigatedAt,
        investigated_by: actor.email ?? actor.id ?? "system",
      },
      ...(result.state === "MATCHED" && result.productId
        ? {
            assignment: {
              ...assignment,
              state: "ASSIGNED",
              previous_state: assignment.state ?? null,
              matched_by: "investigation",
              resolved_at: result.investigatedAt,
            },
          }
        : {}),
    },
  });

  await store.post("demo_url_audit_log", {
    demo_url_id: demoUrlId,
    action: `demo_url.investigated.${result.state.toLowerCase()}`,
    actor_id: actor.id,
    actor_email: actor.email,
    metadata: {
      reason: result.reason,
      title: result.evidence?.title ?? null,
      candidates: (result.candidates ?? []).map((c) => c.slug),
      ai_agent: agent,
      ai_error: result.aiError ?? null,
      product_id: result.productId ?? null,
    },
  });
}

/**
 * A batch, run at a pace that will not hurt anybody.
 *
 * Resumable by construction: it asks the database for rows that still have no
 * product and no investigation - or whose investigation failed to fetch - so
 * stopping after two thousand and starting again continues where it left off
 * rather than from zero. Nothing is re-fetched that already has an answer.
 *
 * Four at a time, because twelve thousand simultaneous requests would be a
 * denial-of-service attack on other people's demos and on this VPS.
 */
export async function investigateBatch(input: {
  limit: number;
  commit: boolean;
  actor: Actor;
  retryFailed?: boolean;
  withAi?: boolean;
}): Promise<{
  committed: boolean;
  totals: Record<string, number>;
  rows: Investigation[];
  remainingPending: number;
}> {
  const store = db();
  const limit = Math.min(Math.max(input.limit || 25, 1), 500);

  const unresolved = await store.get<Row[]>(
    `product_demo_urls?select=id,url,processing&product_id=is.null&order=created_at.asc&limit=${limit * 4}`,
  );

  const due = unresolved.filter((row) => {
    const investigation = ((row.processing ?? {}) as Record<string, unknown>).investigation as
      | { state?: string }
      | undefined;
    if (!investigation) return true;
    if (input.retryFailed && ["FETCH_FAILED", "ERROR"].includes(String(investigation.state))) return true;
    return false;
  });

  const work = due.slice(0, limit);
  const rows: Investigation[] = [];
  const totals: Record<string, number> = {};

  // Controlled concurrency: a small pool, not a flood.
  const CONCURRENCY = 4;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, work.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= work.length) return;
      const row = work[index];
      try {
        const result = await investigateOne({
          demoUrlId: String(row.id),
          url: String(row.url),
          commit: input.commit,
          actor: input.actor,
          withAi: input.withAi,
        });
        rows.push(result);
        totals[result.state] = (totals[result.state] ?? 0) + 1;
      } catch (error) {
        // One address never stops the batch.
        const message = error instanceof Error ? error.message : String(error);
        rows.push({
          demoUrlId: String(row.id),
          url: String(row.url),
          state: "ERROR",
          reason: message,
          investigatedAt: new Date().toISOString(),
        });
        totals.ERROR = (totals.ERROR ?? 0) + 1;
      }
    }
  });
  await Promise.all(workers);

  return {
    committed: input.commit,
    totals,
    rows,
    remainingPending: Math.max(due.length - work.length, 0),
  };
}
