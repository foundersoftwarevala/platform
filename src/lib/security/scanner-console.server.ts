type Row = Record<string, unknown>;

export async function readScannerRows(
  baseUrl: string,
  headers: Record<string, string>,
  path: string,
  fetcher: typeof fetch = fetch,
): Promise<Row[]> {
  const response = await fetcher(`${baseUrl}/rest/v1/${path}`, { headers });
  if (!response.ok) throw new Error(`Scanner read failed (${response.status}).`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Scanner read returned an invalid response.");
  return rows as Row[];
}

export async function readScannerCount(
  baseUrl: string,
  headers: Record<string, string>,
  path: string,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const response = await fetcher(`${baseUrl}/rest/v1/${path}`, {
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  if (!response.ok) throw new Error(`Scanner count failed (${response.status}).`);
  const range = response.headers.get("content-range") ?? "";
  const match = range.match(/\/(\d+)$/);
  if (!match) throw new Error("Scanner count response did not include an exact total.");
  const total = Number(match[1]);
  if (!Number.isSafeInteger(total)) throw new Error("Scanner count response was invalid.");
  return total;
}

export async function readScannerProviderStatus(
  baseUrl: string,
  headers: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<Row | null> {
  const response = await fetcher(`${baseUrl}/rest/v1/rpc/mm_security_provider_status`, {
    method: "POST",
    headers,
    body: "{}",
  });
  if (!response.ok) throw new Error(`Scanner provider status failed (${response.status}).`);
  const value: unknown = await response.json();
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Scanner provider status returned an invalid response.");
  }
  return value as Row;
}
