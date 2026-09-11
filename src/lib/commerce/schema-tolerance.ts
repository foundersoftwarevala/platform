/**
 * Reads and writes that survive a database a migration behind the code.
 *
 * The payment code was written for columns added by the card-payment and
 * atomicity migrations (amount_charged, intent_expires_at, provider_status,
 * payment_verified_at, card_last4 ...). Production has not had those
 * migrations applied, so every request that named one of them failed outright:
 *
 *   - a select answered 400 "column ... does not exist", so the buyer's
 *     purchases page returned 502 and the payment status page always said
 *     "We could not identify that payment";
 *   - a PATCH answered 400 "Could not find the '...' column", so starting a
 *     payment never saved its txnid on the order and a provider's callback
 *     could not find the order it was paying for, and settlement could not
 *     mark a paid order paid.
 *
 * These helpers retry without the one column the database says it does not
 * have, and remember it for the life of the process so the next request does
 * not pay for the failed attempt again. Nothing is invented: a column that is
 * missing is simply not read or not written. Once the migrations are applied
 * the full column set is used again with no code change - a restart clears
 * the memory.
 */

const knownMissing = new Map<string, Set<string>>();

function missingFor(table: string): Set<string> {
  let set = knownMissing.get(table);
  if (!set) {
    set = new Set();
    knownMissing.set(table, set);
  }
  return set;
}

/** The column a PostgREST error names as absent, if that is what it says. */
export function missingColumnFromError(text: string): string | null {
  // select / filter:  column marketplace_orders.amount_charged does not exist
  const read = text.match(/column\s+"?(?:[\w]+\.)?"?([\w]+)"?\s+does not exist/i);
  if (read) return read[1];
  // insert / update:  Could not find the 'amount_charged' column of 'marketplace_orders' ...
  const write = text.match(/Could not find the '([\w]+)' column/i);
  if (write) return write[1];
  return null;
}

/**
 * Run a select, dropping any column the database reports it does not have.
 * `columns` is the comma-separated select list; `build` turns a select list
 * into the full request URL.
 */
export async function selectTolerant(
  table: string,
  columns: string,
  build: (select: string) => string,
  init?: RequestInit,
): Promise<Response> {
  const missing = missingFor(table);
  let list = columns
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c && !missing.has(c));
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(build(list.join(",")), init);
    if (response.ok || response.status !== 400) return response;
    const text = await response.clone().text().catch(() => "");
    const column = missingColumnFromError(text);
    if (!column || !list.includes(column)) return response;
    missing.add(column);
    list = list.filter((c) => c !== column);
  }
  return fetch(build(list.join(",")), init);
}

/**
 * Send a write whose body may name columns the database does not have yet.
 * `send` performs the request with the body it is given.
 */
export async function writeTolerant(
  table: string,
  body: Record<string, unknown>,
  send: (body: Record<string, unknown>) => Promise<Response>,
): Promise<Response> {
  const missing = missingFor(table);
  let current: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!missing.has(key)) current[key] = value;
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await send(current);
    if (response.ok || response.status !== 400) return response;
    const text = await response.clone().text().catch(() => "");
    const column = missingColumnFromError(text);
    if (!column || !(column in current)) return response;
    missing.add(column);
    const next: Record<string, unknown> = { ...current };
    delete next[column];
    current = next;
  }
  return send(current);
}
