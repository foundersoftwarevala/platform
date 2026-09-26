import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { executeAiRequest } from "@/lib/ai-api.functions";
import { checkTagBundle, type GateFinding, type TagBundle } from "./tag-quality-gate";

/**
 * SEO tags for a card slot, generated through AI API Manager and nowhere else.
 *
 * Section 5 forbids a hidden API integration inside an SEO module, and this is
 * the reason: a module that reaches a provider directly answers to nobody for
 * its quota, its cost, its credentials or its audit trail. So the call goes
 * through executeAiRequest, which already checks that the service is registered
 * and active in api_services, that it has an endpoint, that a real production
 * credential exists, and which writes the attempt to usage_events whether it
 * succeeded or not.
 *
 * As of writing no provider can serve this: api_services holds 188 services and
 * 371 capabilities, all catalogued and none approved, and no provider
 * credential is present in the server environment. That is reported as
 * NOT_CONFIGURED with the reason, which is the honest answer. It is not a
 * reason to invent keywords - a card that keeps the tags it has is in a better
 * state than one given made-up ones.
 *
 * A card slot is a fixed category-by-country position and its identity does not
 * change: the category, the country, the URL and the slot number are inputs
 * here, never outputs. Only keyword material is rewritten, and only when it
 * passes the quality gate.
 */

export type TagGenerationState = "GENERATED" | "NOT_CONFIGURED" | "REJECTED" | "PROVIDER_ERROR";

export type TagGenerationResult = {
  state: TagGenerationState;
  slot_url: string | null;
  reason: string;
  provider: string | null;
  model: string | null;
  findings: GateFinding[];
  tags: TagBundle | null;
  stored: boolean;
};

type SlotFacts = {
  id: string;
  slot_url: string;
  category: string;
  country: string;
  region: string | null;
  business_type: string | null;
  software_type: string | null;
  primary_keyword: string | null;
  product_name: string | null;
};

/**
 * The instruction the provider is given.
 *
 * Deliberately narrow about what it may assert. Everything the model is allowed
 * to say has to follow from the facts passed in. The quality gate refuses the
 * rest afterwards, but asking for it and then throwing it away wastes a paid
 * call, so it is ruled out here too.
 */
export function buildTagPrompt(facts: SlotFacts, knownCountries: string[]): string {
  const lines = [
    "Produce search keywords for one page of a software marketplace.",
    "",
    "The page is a fixed slot. Its identity cannot change:",
    "  category: " + facts.category,
    "  country: " + facts.country,
    facts.region ? "  region: " + facts.region : null,
    facts.business_type ? "  business type: " + facts.business_type : null,
    facts.software_type ? "  software type: " + facts.software_type : null,
    facts.product_name ? "  product currently in the slot: " + facts.product_name : null,
    facts.primary_keyword ? "  existing primary keyword: " + facts.primary_keyword : null,
    "",
    "Rules, all checked afterwards, all causing rejection:",
    "  - Every keyword must be about " + facts.category + " and about " + facts.country + ".",
    "  - Name no other country. Others in this catalogue include: " +
      knownCountries.slice(0, 8).join(", ") +
      ".",
    "  - Make no claim that cannot be checked: no superlatives, no customer",
    "    counts, no ratings, no review counts, no prices, no percentages.",
    "  - Do not repeat a word three times in one phrase.",
    "  - No URLs. No entry longer than 120 characters.",
    "",
    "Return JSON only, with exactly these keys:",
    '{"primary":"","secondary":[],"longTail":[],"semantic":[],"geo":[],',
    ' "entities":[],"questions":[],"titleCandidates":[],"metaDescriptionCandidates":[]}',
  ];
  return lines.filter((line) => line !== null).join("\n");
}

/**
 * Read a bundle out of whatever the provider returned.
 *
 * Models wrap JSON in prose and in code fences often enough that refusing such
 * a reply outright would throw away good output over formatting. The first
 * balanced object is taken; anything that is not an object carrying a primary
 * keyword is a parse failure and is reported as one.
 */
export function parseTagResponse(text: string): TagBundle | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const raw = parsed as Record<string, unknown>;
  const list = (key: string): string[] =>
    Array.isArray(raw[key])
      ? (raw[key] as unknown[]).filter((v): v is string => typeof v === "string")
      : [];

  const primary = typeof raw.primary === "string" ? raw.primary : "";
  if (!primary.trim()) return null;

  return {
    primary,
    secondary: list("secondary"),
    longTail: list("longTail"),
    semantic: list("semantic"),
    geo: list("geo"),
    entities: list("entities"),
    questions: list("questions"),
    titleCandidates: list("titleCandidates"),
    metaDescriptionCandidates: list("metaDescriptionCandidates"),
  };
}

/**
 * Whether a failure from AI API Manager means "nothing is set up" or
 * "something went wrong".
 *
 * These are the messages executeAiRequest throws when the registry has nothing
 * it can use. They are a configuration state, not a fault: an operator answers
 * the first by adding a provider and the second by looking at a log, so
 * reporting both as one would send them to the wrong place.
 */
export function isNotConfigured(message: string): boolean {
  return /no active ai provider|no real production credential|not registered|no execution endpoint|is not configured/i.test(
    message,
  );
}
function rest(path: string, init?: RequestInit) {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return fetch(url + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Generate and store tags for one slot.
 *
 * Nothing is written unless the gate passed. The existing keyword material is
 * left exactly as it is on NOT_CONFIGURED, on a provider error and on a
 * rejection - three different states, each reported as itself, because "we
 * could not ask" and "we asked and the answer was unusable" call for different
 * responses from an operator.
 */
/**
 * The work itself, as a plain function.
 *
 * A server function can only be called the way TanStack calls it, and the SEO
 * Manager needs an ordinary endpoint it can POST to from a button. Both now
 * call this, so there is one implementation and no chance of the two drifting.
 */
export async function generateTagsForSlot(data: {
  slotUrl: string;
  dryRun?: boolean;
}): Promise<TagGenerationResult> {
  const empty = {
    slot_url: data.slotUrl,
    provider: null,
    model: null,
    findings: [] as GateFinding[],
    tags: null,
    stored: false,
  };

  const slotResponse = await rest(
    "marketplace_card_slots?select=id,slot_url,country_marker,region,business_type," +
      "software_type,primary_keyword,category_id,current_product_id&slot_url=eq." +
      encodeURIComponent(data.slotUrl) +
      "&limit=1",
  );
  const slots = slotResponse.ok ? ((await slotResponse.json()) as Record<string, unknown>[]) : [];
  if (!slots[0]) {
    return {
      ...empty,
      state: "REJECTED",
      reason: "No card slot is registered at " + data.slotUrl + ".",
    };
  }
  const slot = slots[0];

  const categoryResponse = await rest(
    "marketplace_categories?select=name&id=eq." +
      encodeURIComponent(String(slot.category_id)) +
      "&limit=1",
  );
  const categories = categoryResponse.ok
    ? ((await categoryResponse.json()) as { name: string }[])
    : [];

  let productName: string | null = null;
  if (slot.current_product_id) {
    const productResponse = await rest(
      "marketplace_products?select=name&id=eq." +
        encodeURIComponent(String(slot.current_product_id)) +
        "&limit=1",
    );
    const products = productResponse.ok
      ? ((await productResponse.json()) as { name: string }[])
      : [];
    productName = products[0]?.name ?? null;
  }

  const facts: SlotFacts = {
    id: String(slot.id),
    slot_url: String(slot.slot_url),
    category: categories[0]?.name ?? "software",
    country: String(slot.country_marker ?? ""),
    region: (slot.region as string) ?? null,
    business_type: (slot.business_type as string) ?? null,
    software_type: (slot.software_type as string) ?? null,
    primary_keyword: (slot.primary_keyword as string) ?? null,
    product_name: productName,
  };

  const countryResponse = await rest("marketplace_card_slots?select=country_marker&limit=2000");
  const countryRows = countryResponse.ok
    ? ((await countryResponse.json()) as { country_marker: string | null }[])
    : [];
  const knownCountries = [
    ...new Set(countryRows.map((r) => r.country_marker).filter(Boolean)),
  ] as string[];

  // ---- through AI API Manager, or not at all -----------------------------
  let text: string;
  let provider: string | null = null;
  let model: string | null = null;
  try {
    const answer = await executeAiRequest({
      module: "seo-manager",
      system:
        "You produce search keyword sets for a software marketplace. " +
        "You never make a claim that cannot be checked.",
      prompt: buildTagPrompt(facts, knownCountries),
    });
    text = answer.text;
    provider = answer.provider ?? answer.service ?? null;
    model = answer.model ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // executeAiRequest throws these when the registry has nothing usable.
    // That is a configuration state, not a failure of this request, and the
    // two are reported differently so an operator knows which to act on.
    const notConfigured = isNotConfigured(message);
    return {
      ...empty,
      state: notConfigured ? "NOT_CONFIGURED" : "PROVIDER_ERROR",
      reason: message,
    };
  }

  const bundle = parseTagResponse(text);
  if (!bundle) {
    return {
      ...empty,
      state: "REJECTED",
      provider,
      model,
      reason: "The provider's reply was not a keyword bundle this could read.",
    };
  }

  const gate = checkTagBundle(bundle, {
    category: facts.category,
    country: facts.country,
    knownCountries,
  });
  if (!gate.ok || !gate.cleaned) {
    return {
      ...empty,
      state: "REJECTED",
      provider,
      model,
      findings: gate.findings,
      reason: "The quality gate refused this bundle: " + (gate.findings[0]?.rule ?? "unknown"),
    };
  }

  if (data.dryRun) {
    return {
      ...empty,
      state: "GENERATED",
      provider,
      model,
      findings: gate.findings,
      tags: gate.cleaned,
      reason: "Generated and passed the gate; not stored because this was a dry run.",
    };
  }

  // Stored in the canonical model: keyword_set is the column the card slots
  // already use. The slot's identity columns are not touched.
  const flat = [
    gate.cleaned.primary,
    ...gate.cleaned.secondary,
    ...gate.cleaned.longTail,
    ...gate.cleaned.semantic,
    ...gate.cleaned.geo,
  ];
  const patch = await rest("marketplace_card_slots?id=eq." + encodeURIComponent(facts.id), {
    method: "PATCH",
    body: JSON.stringify({ keyword_set: flat, primary_keyword: gate.cleaned.primary }),
  });

  return {
    ...empty,
    state: "GENERATED",
    provider,
    model,
    findings: gate.findings,
    tags: gate.cleaned,
    stored: patch.ok,
    reason: patch.ok
      ? "Stored " + flat.length + " keywords on " + facts.slot_url + "."
      : "Generated and passed the gate, but the write failed: HTTP " + patch.status + ".",
  };
}

/** The same work, for a caller that goes through TanStack. */
export const generateSlotTags = createServerFn({ method: "POST" })
  .validator((v) =>
    z.object({ slotUrl: z.string().min(1), dryRun: z.boolean().optional() }).parse(v ?? {}),
  )
  .handler(async ({ data }): Promise<TagGenerationResult> => generateTagsForSlot(data));
