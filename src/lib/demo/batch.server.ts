import { createHash } from "node:crypto";

import { demoStore, type Row } from "./rest.server";
import type { Actor } from "./process.server";

/**
 * The batch: two to five hundred addresses that arrive, are looked at, and are
 * committed together.
 *
 * Twelve thousand is the size of the catalogue, not the size of the work. The
 * work arrives as files of a few hundred, and each one has to stand alone - its
 * own identifier, its own counts, its own errors, its own commit, its own place
 * in the history. A batch that goes wrong must leave every other batch exactly
 * as it was.
 *
 * So the rules here are all about isolation:
 *
 *   - Above the maximum nothing is processed at all. A file of twelve thousand
 *     is refused with BATCH_SIZE_EXCEEDED, not silently truncated to the first
 *     five hundred, which would lose eleven and a half thousand addresses
 *     without telling anyone.
 *   - A preview is remembered by its fingerprint. Commit the wrong file against
 *     a batch and it is refused, not merged.
 *   - A batch is committed once. A second commit is refused rather than taking
 *     the same addresses in twice.
 *   - Progress is counted from the rows themselves, so an interrupted run that
 *     is started again continues rather than double-counting.
 */

/** Five hundred at a time. Above this a file is refused, never truncated. */
export const MAX_BATCH_ROWS = 500;

export type BatchStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "PREVIEW_READY"
  | "AWAITING_REVIEW"
  | "COMMITTED"
  | "PARTIALLY_COMPLETED"
  | "FAILED"
  | "CANCELLED";

export class BatchSizeExceeded extends Error {
  readonly code = "BATCH_SIZE_EXCEEDED";
  constructor(
    readonly received: number,
    readonly maximum: number = MAX_BATCH_ROWS,
  ) {
    super(
      `BATCH_SIZE_EXCEEDED: this batch has ${received} addresses and the maximum is ${maximum}. ` +
        `Split the file into batches of ${maximum} or fewer.`,
    );
  }
}

/** Refused for a reason the operator has to act on, not a server fault. */
export class BatchRefused extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}

/**
 * A batch is refused above the maximum before anything is read, parsed or
 * written. Checked at every entrance - the file, the row list, the commit - so
 * there is no path into the pipeline that skips it.
 */
export function assertBatchSize(received: number): void {
  if (received > MAX_BATCH_ROWS) throw new BatchSizeExceeded(received, MAX_BATCH_ROWS);
}

/**
 * What was previewed, in one short string.
 *
 * A commit names the batch it belongs to, and the addresses have to be the ones
 * that were previewed. Someone who previews file A, opens file B and presses
 * commit is committing decisions that were never shown to them, so the
 * fingerprint of the addresses is kept and compared.
 */
export function batchFingerprint(urls: string[]): string {
  const canonical = urls.map((u) => u.trim().toLowerCase()).join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

export type BatchRecord = {
  id: string;
  source_filename: string | null;
  status: BatchStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  created_at: string;
  created_by_email: string | null;
  committed_at: string | null;
  preview?: Record<string, unknown> | null;
  notes?: string | null;
};

export async function createBatch(input: {
  filename?: string | null;
  totals: { total: number; valid: number; invalid: number; duplicate: number };
  fingerprint: string;
  counts: Record<string, number>;
  detected: string[];
  actor: Actor;
  status?: BatchStatus;
}): Promise<BatchRecord> {
  const store = demoStore();
  return await store.post<BatchRecord>("demo_intake_batches", {
    source_filename: input.filename?.slice(0, 200) ?? null,
    total_rows: input.totals.total,
    valid_rows: input.totals.valid,
    invalid_rows: input.totals.invalid,
    duplicate_rows: input.totals.duplicate,
    status: input.status ?? "PREVIEW_READY",
    created_by: input.actor.id,
    created_by_email: input.actor.email,
    preview: {
      fingerprint: input.fingerprint,
      counts: input.counts,
      detected: input.detected,
      previewed_at: new Date().toISOString(),
    },
  });
}

export async function getBatch(id: string): Promise<BatchRecord | null> {
  const store = demoStore();
  const [row] = await store.get<BatchRecord[]>(
    `demo_intake_batches?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  return row ?? null;
}

/**
 * Ten minutes. A batch of five hundred has taken sixteen seconds, so a claim
 * older than this belonged to a run that died rather than one still working.
 */
export const STALE_CLAIM_MS = 10 * 60 * 1000;

/** The statuses a commit may start from. */
const CLAIMABLE = ["PREVIEW_READY", "UPLOADED", "AWAITING_REVIEW", "FAILED"] as const;

/**
 * Taking the batch, so that only one commit of it runs.
 *
 * The condition is in the filter, so the database decides the winner: the first
 * caller moves the batch to PROCESSING and gets the row back, and a second
 * caller arriving in the same moment matches nothing and is told the batch is
 * already being committed. A batch left PROCESSING by a run that died can be
 * claimed again once its claim is stale, so a crash never strands an upload.
 */
export async function claimBatch(id: string): Promise<BatchRecord | null> {
  const store = demoStore();
  const stale = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const condition =
    `or=(status.in.(${CLAIMABLE.join(",")}),` +
    `and(status.eq.PROCESSING,claimed_at.lt.${encodeURIComponent(stale)}))`;
  const claimed = await store.patchReturning<BatchRecord>(
    `demo_intake_batches?id=eq.${encodeURIComponent(id)}&${condition}`,
    { status: "PROCESSING", claimed_at: new Date().toISOString() },
  );
  return claimed[0] ?? null;
}

export async function setBatchStatus(
  id: string,
  status: BatchStatus,
  extra: Row = {},
): Promise<void> {
  const store = demoStore();
  await store.patch(`demo_intake_batches?id=eq.${encodeURIComponent(id)}`, { status, ...extra });
}

/**
 * The history, with each batch's progress counted from its rows.
 *
 * Nothing here is a stored counter. mm_demo_batches counts the rows carrying
 * each batch id at the moment it is asked, so a batch whose investigation is
 * still running shows what has actually been done, and a row an operator
 * resolved by hand moves the figure immediately.
 */
export async function listBatches(limit = 25): Promise<{
  batches: (BatchRecord & {
    rows_taken: number;
    assigned: number;
    unresolved: number;
    investigated: number;
    pending: number;
    fetch_failed: number;
    errors: number;
    ambiguous: number;
    unmatched: number;
  })[];
  generated_at: string;
}> {
  const store = demoStore();
  return await store.rpc("mm_demo_batches", { p_limit: limit });
}

/**
 * Where a batch has got to, and what is left.
 *
 * Progress is the answer to "can I close the laptop": every row of this batch
 * that has been decided, every one still waiting, and the ones that failed in a
 * way worth retrying. A restart reads this and continues.
 */
export async function batchProgress(id: string): Promise<{
  batch: BatchRecord;
  progress: Record<string, number>;
  rows: { id: string; url: string; product_id: string | null; state: string; investigation: string | null }[];
}> {
  const batch = await getBatch(id);
  if (!batch) throw new BatchRefused("BATCH_NOT_FOUND", `no batch has the id ${id}`);

  const store = demoStore();
  const rows = await store.get<Row[]>(
    `product_demo_urls?select=id,url,product_id,processing` +
      `&processing->assignment->>batch_id=eq.${encodeURIComponent(id)}` +
      `&order=created_at.asc&limit=${MAX_BATCH_ROWS}`,
  );

  const progress: Record<string, number> = {
    ROWS_TAKEN: rows.length,
    ASSIGNED: 0,
    UNRESOLVED: 0,
    INVESTIGATED: 0,
    PENDING_INVESTIGATION: 0,
    RETRYABLE: 0,
  };

  const shaped = rows.map((row) => {
    const processing = (row.processing ?? {}) as Record<string, unknown>;
    const assignment = (processing.assignment ?? {}) as { state?: string };
    const investigation = (processing.investigation ?? null) as { state?: string } | null;
    const investigationState = investigation?.state ? String(investigation.state) : null;

    if (row.product_id) progress.ASSIGNED += 1;
    else progress.UNRESOLVED += 1;
    if (investigationState) progress.INVESTIGATED += 1;
    else if (!row.product_id) progress.PENDING_INVESTIGATION += 1;
    if (investigationState && RETRYABLE_STATES.has(investigationState)) progress.RETRYABLE += 1;

    return {
      id: String(row.id),
      url: String(row.url),
      product_id: row.product_id ? String(row.product_id) : null,
      state: String(assignment.state ?? "UNKNOWN"),
      investigation: investigationState,
    };
  });

  return { batch, progress, rows: shaped };
}

/**
 * Which failures are worth trying again.
 *
 * A page that timed out, refused the connection or answered 5xx may well answer
 * next time, so it is retryable. A page whose name matches nothing in the
 * catalogue, or an address that is not public, will give the same answer for
 * ever - retrying it is a waste of a request and of the operator's attention,
 * so it goes to review instead.
 */
export const RETRYABLE_STATES = new Set(["FETCH_FAILED", "ERROR"]);

export function isRetryable(state: string | null | undefined): boolean {
  return state != null && RETRYABLE_STATES.has(String(state));
}

/**
 * How a batch ended, from what actually happened to its rows.
 *
 * COMMITTED only when every row was taken in. One failure makes it partial and
 * says so; all of them failing makes it a failure. A batch that claims success
 * over silent losses is the thing this exists to prevent.
 */
export function batchOutcome(totals: Record<string, number>): BatchStatus {
  const failed = (totals.ERROR ?? 0) + (totals.INVALID ?? 0);
  const taken =
    (totals.ASSIGNED ?? 0) +
    (totals.AMBIGUOUS ?? 0) +
    (totals.UNMATCHED ?? 0) +
    (totals.ALREADY_ASSIGNED ?? 0) +
    (totals.DUPLICATE ?? 0);
  if (taken === 0) return "FAILED";
  if (failed > 0) return "PARTIALLY_COMPLETED";
  return "COMMITTED";
}
