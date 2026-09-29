import { assertPublicUrl } from "./safe-fetch.server";
import { demoStore, type Row } from "./rest.server";
import {
  assertBatchSize,
  batchFingerprint,
  batchOutcome,
  BatchRefused,
  createBatch,
  getBatch,
  MAX_BATCH_ROWS,
  setBatchStatus,
} from "./batch.server";
import type { Actor } from "./process.server";

/**
 * Taking demo addresses in, and deciding which product each one belongs to.
 *
 * Add Demo and Bulk Add wrote into `demos`, a table with no product
 * relationship that the storefront has never read - so a demo added through
 * either screen could not appear anywhere, and the screen said "completed". The
 * canonical relationship is product_demo_urls.product_id, and this is the only
 * path to one.
 *
 * The rule that shapes everything here: a demo's address says nothing about its
 * product. pixel-till-pro.lovable.app is CounterPOS; temple-learn-sync is
 * AnnadanamKitchen. So nothing is inferred from a URL, and a row is assigned
 * only when the caller named the product or a name matches exactly one product
 * on sale. Everything else is taken in unassigned and left for an operator,
 * because a wrong assignment is how admissionschool-desk came to carry an
 * AnnadanamKitchen demo - and that is worse than no assignment at all.
 *
 * Twelve thousand addresses can go through this. None of them is guessed.
 */

/** What happened to one address. */
export type RowState =
  | "ASSIGNED"
  | "ALREADY_ASSIGNED"
  /** Taken in by an earlier batch and still waiting; its evidence is kept. */
  | "DUPLICATE"
  | "AMBIGUOUS"
  | "UNMATCHED"
  | "INVALID"
  | "ERROR";

export type RowResult = {
  url: string;
  state: RowState;
  reason: string;
  productId?: string | null;
  productSlug?: string | null;
  candidates?: { id: string; name: string; slug: string }[];
  demoUrlId?: string | null;
};

export type AssignInput = {
  /** One line each: the address, and optionally a product and a name to match on. */
  rows: { url: string; product?: string | null; name?: string | null }[];
  /** False previews without writing anything. */
  commit: boolean;
  actor: Actor;
  /**
   * The batch these rows belong to. Supplied when an operator commits a batch
   * they previewed, so the rows carry the same identifier the preview did and
   * the batch's progress counts them. Generated when it is absent.
   */
  batchId?: string;
};

export type AssignReport = {
  committed: boolean;
  totals: Record<RowState, number>;
  rows: RowResult[];
  /** The batch as a whole, for the audit trail and for an operator to undo by. */
  batchId: string;
};

/** The address as it will be stored and compared: trimmed, no trailing slash. */
export function normaliseDemoUrl(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "") || trimmed;
}

const EMPTY_TOTALS = (): Record<RowState, number> => ({
  ASSIGNED: 0,
  ALREADY_ASSIGNED: 0,
  DUPLICATE: 0,
  AMBIGUOUS: 0,
  UNMATCHED: 0,
  INVALID: 0,
  ERROR: 0,
});

/**
 * The addresses of this batch that the catalogue already holds unassigned.
 *
 * A duplicate inside one file is caught as the file is read. A duplicate across
 * batches is not: the same address can perfectly well appear in batch three and
 * again in batch seven, and the second time it must not be taken in again. The
 * unique index would refuse the insert, but that arrives as a database error and
 * reads like a fault, so the rows are looked up first and reported as what they
 * are - already here, with the investigation that was already done on them.
 *
 * Asked in pages of fifty, because five hundred addresses in one query string
 * is longer than a proxy will carry.
 */
async function existingUnassigned(
  store: ReturnType<typeof demoStore>,
  urls: string[],
): Promise<Map<string, { id: string; batchId: string | null; investigated: string | null }>> {
  const found = new Map<string, { id: string; batchId: string | null; investigated: string | null }>();
  const unique = [...new Set(urls.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const page = unique.slice(i, i + 50);
    const list = page.map((u) => `"${u.replace(/"/g, '\\"')}"`).join(",");
    const rows = await store.get<Row[]>(
      `product_demo_urls?select=id,url,processing&product_id=is.null&url=in.(${encodeURIComponent(list)})`,
    );
    for (const row of rows) {
      const processing = (row.processing ?? {}) as Record<string, unknown>;
      const assignment = (processing.assignment ?? {}) as { batch_id?: string };
      const investigation = (processing.investigation ?? null) as { state?: string } | null;
      found.set(String(row.url), {
        id: String(row.id),
        batchId: assignment.batch_id ? String(assignment.batch_id) : null,
        investigated: investigation?.state ? String(investigation.state) : null,
      });
    }
  }
  return found;
}

/**
 * Preview or commit a batch of demo addresses.
 *
 * With `commit: false` nothing is written and the same decisions are returned,
 * so an operator sees exactly what would happen - which matters most for the
 * rows that would NOT be assigned, because those are the ones a careless import
 * would have guessed at.
 *
 * One bad row never takes the batch with it: each is decided, written and
 * reported on its own, and a row that throws is reported as ERROR with the
 * message rather than aborting the rest.
 */
export async function assignDemoUrls(input: AssignInput): Promise<AssignReport> {
  // Nothing is read, matched or written above the maximum. A file of twelve
  // thousand is refused whole rather than quietly becoming its first five
  // hundred.
  assertBatchSize(input.rows.length);

  const store = demoStore();
  const batchId = input.batchId ?? crypto.randomUUID();
  const totals = EMPTY_TOTALS();
  const rows: RowResult[] = [];
  const seen = new Set<string>();

  // What an earlier batch already took in, asked once for the whole batch.
  const alreadyHere = await existingUnassigned(
    store,
    input.rows.map((r) => normaliseDemoUrl(r.url)),
  );

  for (const raw of input.rows) {
    const url = normaliseDemoUrl(raw.url);
    const result: RowResult = { url, state: "ERROR", reason: "" };

    try {
      // A demo must be a public address this server can actually reach. The
      // same check the pipeline uses, so an address refused here is refused
      // there too rather than failing later.
      try {
        assertPublicUrl(url);
      } catch (error) {
        result.state = "INVALID";
        result.reason = error instanceof Error ? error.message : "That is not a usable address.";
        rows.push(result);
        totals.INVALID += 1;
        continue;
      }

      // The same address twice in one file is the file's mistake, not a reason
      // to write it twice.
      if (seen.has(url)) {
        result.state = "ALREADY_ASSIGNED";
        result.reason = "this address appears earlier in the same batch";
        rows.push(result);
        totals.ALREADY_ASSIGNED += 1;
        continue;
      }
      seen.add(url);

      /**
       * Taken in by an earlier batch and still unresolved.
       *
       * It is not an error and not a new row: the address is already in the
       * queue an operator reviews, with whatever the page-reading step already
       * learned about it. Saying so, and naming the batch it came from, is more
       * use than either taking it in twice or reporting a constraint violation.
       */
      const earlier = alreadyHere.get(url);
      if (earlier && earlier.batchId !== batchId) {
        result.state = "DUPLICATE";
        result.demoUrlId = earlier.id;
        result.reason = earlier.investigated
          ? `already taken in by batch ${earlier.batchId?.slice(0, 8) ?? "an earlier run"} and investigated (${earlier.investigated}); its evidence is kept`
          : `already taken in by batch ${earlier.batchId?.slice(0, 8) ?? "an earlier run"} and still awaiting review`;
        rows.push(result);
        totals.DUPLICATE += 1;
        continue;
      }

      const match = await store.rpc<{
        state: "ALREADY_ASSIGNED" | "MATCHED" | "AMBIGUOUS" | "UNMATCHED";
        product_id?: string;
        reason?: string;
        evidence?: Record<string, unknown>;
        candidates?: { id: string; name: string; slug: string }[];
        demo_url_id?: string;
      }>("demo_match_product", {
        p_url: url,
        p_hint: raw.name ?? null,
        p_product: raw.product ?? null,
      });

      result.reason = String(match.reason ?? "");
      if (match.candidates) result.candidates = match.candidates;

      if (match.state === "ALREADY_ASSIGNED") {
        result.state = "ALREADY_ASSIGNED";
        result.productId = match.product_id ?? null;
        result.demoUrlId = match.demo_url_id ?? null;
        result.productSlug = String(match.evidence?.product_slug ?? "") || null;
        rows.push(result);
        totals.ALREADY_ASSIGNED += 1;
        continue;
      }

      const assigned = match.state === "MATCHED";
      result.state = assigned ? "ASSIGNED" : match.state;
      result.productId = assigned ? (match.product_id ?? null) : null;
      result.productSlug = assigned ? (String(match.evidence?.product_slug ?? "") || null) : null;

      if (!input.commit) {
        rows.push(result);
        totals[result.state] += 1;
        continue;
      }

      /**
       * Written to the canonical table either way.
       *
       * An assigned row carries its product. One that is not assigned is taken
       * in with product_id null, which keeps it in the one table an operator
       * reviews and keeps it off the storefront, since the proxy and the badge
       * both look a demo up by product. The decision, its reason and its
       * evidence ride along in `processing`, so why a row is where it is can be
       * answered months later.
       *
       * Nothing is published here. A new row is inactive and unprocessed; it
       * still has to go through investigate and activate, which is where the
       * branding and the category checks live.
       */
      const created = await store.post<Row>("product_demo_urls", {
        product_id: result.productId,
        url,
        demo_name: raw.name?.trim() || new URL(url).hostname,
        status: "inactive",
        processing_status: "unprocessed",
        processing: {
          assignment: {
            state: result.state,
            reason: result.reason,
            evidence: match.evidence ?? null,
            candidates: match.candidates ?? null,
            batch_id: batchId,
            decided_at: new Date().toISOString(),
            decided_by: input.actor.email ?? input.actor.id ?? "unknown",
          },
        },
      });
      result.demoUrlId = created?.id ? String(created.id) : null;
      rows.push(result);
      totals[result.state] += 1;
    } catch (error) {
      // This row and no other.
      result.state = "ERROR";
      result.reason = error instanceof Error ? error.message : String(error);
      rows.push(result);
      totals.ERROR += 1;
    }
  }

  return { committed: input.commit, totals, rows, batchId };
}

/**
 * An operator choosing the product for a row the matcher would not place.
 *
 * This is the other half of the intake: AMBIGUOUS and UNMATCHED rows sit in
 * product_demo_urls with product_id null, and nothing could ever give them one.
 * Now an operator can, and the decision is recorded as theirs - the row keeps the
 * machine's original reason and candidates alongside who overruled it and when,
 * so a mapping can always be explained.
 *
 * It refuses rather than guesses: a product that is not on sale, a product that
 * already carries this address, or a row that has been assigned since the
 * operator last looked.
 */
export async function resolveDemoAssignment(input: {
  demoUrlId: string;
  product: string;
  actor: Actor;
}): Promise<{ ok: true; productId: string; productSlug: string } | { ok: false; reason: string }> {
  const store = demoStore();

  const [row] = await store.get<Row[]>(
    `product_demo_urls?select=id,url,product_id,processing&id=eq.${encodeURIComponent(input.demoUrlId)}&limit=1`,
  );
  if (!row) return { ok: false, reason: "That demo is no longer there." };
  if (row.product_id) {
    return {
      ok: false,
      reason: "This demo already has a product. Existing mappings are not overwritten here.",
    };
  }

  const wanted = String(input.product).trim();
  const [product] = await store.get<Row[]>(
    `marketplace_products?select=id,name,slug,visible,moderation_status&` +
      (/^[0-9a-f-]{36}$/i.test(wanted)
        ? `id=eq.${encodeURIComponent(wanted)}`
        : `slug=eq.${encodeURIComponent(wanted)}`) +
      `&limit=1`,
  );
  if (!product) return { ok: false, reason: `No product matches "${wanted}".` };
  if (product.visible !== true || String(product.moderation_status) !== "approved") {
    return { ok: false, reason: `"${String(product.name)}" is not on sale, so a demo cannot hang on it.` };
  }

  // The same address must not end up on the same product twice.
  const clash = await store.get<Row[]>(
    `product_demo_urls?select=id&product_id=eq.${encodeURIComponent(String(product.id))}` +
      `&url=eq.${encodeURIComponent(String(row.url))}&limit=1`,
  );
  if (clash.length > 0) {
    return { ok: false, reason: `"${String(product.name)}" already carries this address.` };
  }

  const previous = (row.processing ?? {}) as Record<string, unknown>;
  const assignment = (previous.assignment ?? {}) as Record<string, unknown>;

  await store.patch(`product_demo_urls?id=eq.${encodeURIComponent(input.demoUrlId)}`, {
    product_id: product.id,
    processing: {
      ...previous,
      assignment: {
        ...assignment,
        // The machine's reasoning is kept, not replaced.
        state: "ASSIGNED",
        resolved_by_operator: input.actor.email ?? input.actor.id ?? "unknown",
        resolved_at: new Date().toISOString(),
        resolved_to: { id: product.id, slug: product.slug },
        previous_state: assignment.state ?? null,
      },
    },
  });

  await store.post("demo_url_audit_log", {
    demo_url_id: input.demoUrlId,
    action: "demo_url.assignment.resolved",
    actor_id: input.actor.id,
    actor_email: input.actor.email,
    metadata: {
      product_id: product.id,
      product_slug: product.slug,
      from_state: assignment.state ?? null,
    },
  });

  return { ok: true, productId: String(product.id), productSlug: String(product.slug) };
}

/* ------------------------------------------------------------------ the file */

/**
 * Reading the owner's file.
 *
 * Twelve thousand addresses arrive as a spreadsheet export, and the column
 * names will not be the ones this code would have chosen. So the header is
 * matched against the names such a file actually uses - and where a column
 * cannot be identified it is left alone rather than guessed at, because
 * guessing which column holds the product is how a demo ends up on the wrong
 * one.
 *
 * A file with no address column is refused with a schema error naming what was
 * found, rather than imported as zero rows.
 */
const HEADER_ALIASES: Record<"url" | "productId" | "productSlug" | "productName", string[]> = {
  url: ["url", "demo_url", "demourl", "link", "demo_link", "address", "demo_address", "website", "demo", "live_demo", "demo_site"],
  productId: ["product_id", "productid", "id", "uuid", "product_uuid"],
  productSlug: ["product_slug", "productslug", "slug"],
  productName: ["product_name", "productname", "product", "name", "title", "software", "software_name"],
};

/**
 * A header, reduced to letters, digits and single underscores.
 *
 * "Demo URL", "demo_url" and "demourl" are the same column written three ways,
 * and an export will use whichever the person who made it preferred. Matching on
 * the reduced form means the alias list need not carry every spelling - it was
 * missing "demo url" with a space, which is the commonest of all, and a real
 * export was refused for it.
 */
const headerKey = (value: string) =>
  value
    .replace(/^\ufeff/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Splits a line on comma, tab or semicolon, honouring quoted fields. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t" || ch === ";") { out.push(field); field = ""; }
    else field += ch;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

export type ParsedFile = {
  columns: { url: number; productId: number; productSlug: number; productName: number };
  detected: string[];
  rows: { url: string; product?: string | null; name?: string | null; line: number }[];
  invalid: { line: number; reason: string; sample: string }[];
  duplicatesInFile: number;
};

export function parseIntakeFile(text: string): ParsedFile {
  const lines = text.replace(/^\ufeff/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new Error("SCHEMA_ERROR: the file is empty.");

  const header = splitLine(lines[0]).map(headerKey);
  const find = (names: string[]) => header.findIndex((h) => names.includes(h));

  const columns = {
    url: find(HEADER_ALIASES.url),
    productId: find(HEADER_ALIASES.productId),
    productSlug: find(HEADER_ALIASES.productSlug),
    productName: find(HEADER_ALIASES.productName),
  };

  // A file with no header at all, but one column of addresses, is still usable.
  const headerless = columns.url === -1 && /^https?:\/\//i.test(lines[0].trim());
  if (columns.url === -1 && !headerless) {
    throw new Error(
      `SCHEMA_ERROR: no address column. Found: ${header.join(", ") || "(no header)"}. ` +
        `Name one of them ${HEADER_ALIASES.url.slice(0, 4).join(", ")}.`,
    );
  }

  const body = headerless ? lines : lines.slice(1);
  const offset = headerless ? 1 : 2;
  const rows: ParsedFile["rows"] = [];
  const invalid: ParsedFile["invalid"] = [];
  const seen = new Set<string>();
  let duplicatesInFile = 0;

  body.forEach((line, index) => {
    const cells = headerless ? [line.trim()] : splitLine(line);
    const at = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : "");
    const url = normaliseDemoUrl(headerless ? cells[0] : at(columns.url));
    if (!url) {
      invalid.push({ line: index + offset, reason: "no address on this line", sample: line.slice(0, 80) });
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      invalid.push({ line: index + offset, reason: "not an http address", sample: url.slice(0, 80) });
      return;
    }
    if (seen.has(url)) { duplicatesInFile += 1; return; }
    seen.add(url);

    // The product column that is filled wins, in the order the brief sets.
    const product = at(columns.productId) || at(columns.productSlug) || null;
    const name = at(columns.productName) || null;
    rows.push({ url, product, name, line: index + offset });
  });

  const detected = (Object.keys(columns) as (keyof typeof columns)[])
    .filter((k) => columns[k] >= 0)
    .map((k) => `${k}=${header[columns[k]]}`);

  return { columns, detected: headerless ? ["url=(no header, one address per line)"] : detected, rows, invalid, duplicatesInFile };
}

/**
 * What the file would do, without doing it.
 *
 * Every row is decided by the same matcher a commit uses, so the counts are the
 * outcome and not an estimate - which matters most for the rows that would NOT
 * be assigned, since those are the ones a careless import guesses at.
 */
export async function previewIntakeFile(
  text: string,
  options: { filename?: string | null; actor?: Actor; register?: boolean } = {},
): Promise<{
  detected: string[];
  counts: Record<string, number>;
  invalid: ParsedFile["invalid"];
  sample: RowResult[];
  rows: { url: string; product?: string | null; name?: string | null }[];
  batchId: string | null;
  fingerprint: string;
  maximum: number;
}> {
  const parsed = parseIntakeFile(text);
  // The size of the batch is what the file holds, valid or not: an operator
  // splitting a file has to split all of it, not the part that parsed.
  assertBatchSize(parsed.rows.length + parsed.invalid.length + parsed.duplicatesInFile);

  const actor = options.actor ?? { id: null, email: null };
  const intake = parsed.rows.map(({ url, product, name }) => ({ url, product, name }));
  const report = await assignDemoUrls({ rows: intake, commit: false, actor });

  const counts: Record<string, number> = {
    TOTAL: parsed.rows.length + parsed.invalid.length + parsed.duplicatesInFile,
    VALID: parsed.rows.length,
    INVALID: parsed.invalid.length,
    // Both kinds of repetition, counted together the way an operator sees them:
    // the same address twice in this file, and one an earlier batch already has.
    DUPLICATE: parsed.duplicatesInFile + report.totals.DUPLICATE,
    DUPLICATE_IN_FILE: parsed.duplicatesInFile,
    DUPLICATE_ACROSS_BATCHES: report.totals.DUPLICATE,
    ALREADY_ASSIGNED: report.totals.ALREADY_ASSIGNED,
    EXPLICIT_PRODUCT_MATCH: 0,
    EXACT_NAME_MATCH: 0,
    INVESTIGATION_REQUIRED: 0,
    AMBIGUOUS: report.totals.AMBIGUOUS,
    UNMATCHED: report.totals.UNMATCHED,
    ERROR: report.totals.ERROR,
  };

  // An assignment is explicit when the file named the product, and a name match
  // otherwise. Counted from each row's own reason, not assumed from the totals.
  for (const row of report.rows) {
    if (row.state !== "ASSIGNED") continue;
    if (/named in the request/i.test(row.reason)) counts.EXPLICIT_PRODUCT_MATCH += 1;
    else counts.EXACT_NAME_MATCH += 1;
  }
  // Anything unplaced is what the page-reading step exists for.
  counts.INVESTIGATION_REQUIRED = counts.AMBIGUOUS + counts.UNMATCHED;

  /**
   * The preview is remembered, so the commit can be checked against it.
   *
   * Registering the batch here is what makes the two halves one act: the
   * operator sees decisions for a known set of addresses, and a commit that
   * names this batch has to carry the same addresses or it is refused. Nothing
   * about product_demo_urls is written - the preview still writes nothing.
   */
  const fingerprint = batchFingerprint(intake.map((r) => r.url));
  let batchId: string | null = null;
  if (options.register !== false) {
    const batch = await createBatch({
      filename: options.filename ?? null,
      totals: {
        total: counts.TOTAL,
        valid: counts.VALID,
        invalid: counts.INVALID,
        duplicate: counts.DUPLICATE,
      },
      fingerprint,
      counts,
      detected: parsed.detected,
      actor,
      status: "PREVIEW_READY",
    });
    batchId = String(batch.id);
  }

  return {
    detected: parsed.detected,
    counts,
    invalid: parsed.invalid.slice(0, 20),
    sample: report.rows.slice(0, 20),
    rows: intake,
    batchId,
    fingerprint,
    maximum: MAX_BATCH_ROWS,
  };
}

/**
 * Committing one batch: the addresses that were previewed, and no others.
 *
 * Everything that makes a batch safe happens here rather than in the matcher,
 * because the matcher decides one address and this decides one upload:
 *
 *   - the batch has to exist, and to be one that has not been committed;
 *   - the addresses have to be the ones the preview showed, or the operator is
 *     committing decisions they never saw;
 *   - the outcome is recorded from what happened to the rows, so a batch that
 *     half-worked says PARTIALLY_COMPLETED rather than claiming success;
 *   - a failure anywhere in it leaves every other batch untouched, because the
 *     only rows written carry this batch's id.
 */
export async function commitBatch(input: {
  batchId: string;
  rows: { url: string; product?: string | null; name?: string | null }[];
  actor: Actor;
}): Promise<AssignReport & { status: string }> {
  assertBatchSize(input.rows.length);

  const batch = await getBatch(input.batchId);
  if (!batch) throw new BatchRefused("BATCH_NOT_FOUND", `no batch has the id ${input.batchId}`);
  if (batch.status === "COMMITTED" || batch.status === "PARTIALLY_COMPLETED") {
    throw new BatchRefused(
      "BATCH_ALREADY_COMMITTED",
      `batch ${input.batchId} was committed on ${batch.committed_at ?? "an earlier run"}; take the remaining addresses in as a new batch`,
    );
  }
  if (batch.status === "CANCELLED") {
    throw new BatchRefused("BATCH_CANCELLED", `batch ${input.batchId} was cancelled`);
  }

  const expected = (batch.preview as { fingerprint?: string } | null)?.fingerprint ?? null;
  const actual = batchFingerprint(input.rows.map((r) => normaliseDemoUrl(r.url)));
  if (expected && expected !== actual) {
    throw new BatchRefused(
      "STALE_PREVIEW",
      "these addresses are not the ones that were previewed for this batch. Preview the file again before committing it",
    );
  }

  await setBatchStatus(input.batchId, "PROCESSING");
  try {
    const report = await assignDemoUrls({
      rows: input.rows,
      commit: true,
      actor: input.actor,
      batchId: input.batchId,
    });
    const status = batchOutcome(report.totals);
    await setBatchStatus(input.batchId, status, {
      committed_at: new Date().toISOString(),
      notes: Object.entries(report.totals)
        .filter(([, n]) => n > 0)
        .map(([state, n]) => `${state}=${n}`)
        .join(" "),
    });
    return { ...report, status };
  } catch (error) {
    // The batch failed as a batch. Said so, and left alone.
    await setBatchStatus(input.batchId, "FAILED", {
      notes: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
    });
    throw error;
  }
}
