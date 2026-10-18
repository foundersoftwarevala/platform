/**
 * The one way the demo pipeline talks to the database.
 *
 * Intake, the batch registry and the investigation all need the same four
 * operations against the same VPS instance with the same service credentials.
 * They had a copy each, which is how two of them came to encode a URL segment
 * differently. One store, imported everywhere.
 */

export type Row = Record<string, unknown>;

export function demoStore() {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) throw new Error("The database is not configured on this server.");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  return {
    async rpc<T>(fn: string, args: Row): Promise<T> {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers,
        body: JSON.stringify(args),
      });
      if (!r.ok) throw new Error(`${fn} failed (${r.status}): ${(await r.text()).slice(0, 180)}`);
      return (await r.json()) as T;
    },
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
    /**
     * An update that says which rows it changed.
     *
     * This is how one caller can win a claim: the filter carries the condition,
     * and an empty result means somebody else got there first rather than
     * meaning the update failed.
     */
    async patchReturning<T = Row>(path: string, body: Row): Promise<T[]> {
      const r = await fetch(`${url}/rest/v1/${path}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`update failed (${r.status}): ${(await r.text()).slice(0, 160)}`);
      return (await r.json()) as T[];
    },
    /** How many rows a filter matches, without fetching them. */
    async count(path: string): Promise<number> {
      const separator = path.includes("?") ? "&" : "?";
      const r = await fetch(`${url}/rest/v1/${path}${separator}select=id`, {
        headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
      });
      if (!r.ok) throw new Error(`count failed (${r.status})`);
      // PostgREST answers "0-0/37"; the total is what is wanted.
      const total = (r.headers.get("content-range") ?? "").split("/")[1];
      await r.text();
      return Number.parseInt(total ?? "0", 10) || 0;
    },
    async post<T>(path: string, body: Row): Promise<T> {
      const r = await fetch(`${url}/rest/v1/${path}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`insert failed (${r.status}): ${(await r.text()).slice(0, 180)}`);
      const rows = (await r.json()) as T[];
      return rows[0] as T;
    },
  };
}
