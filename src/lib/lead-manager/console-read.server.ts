export type LeadConsoleRow = Record<string, unknown>;

export async function readAllLeadConsoleRows(
  baseUrl: string,
  headers: Record<string, string>,
  path: string,
  fetcher: typeof fetch = fetch,
  pageSize = 500,
): Promise<LeadConsoleRow[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("The lead page size must be a positive integer.");
  }

  const rows: LeadConsoleRow[] = [];
  let expectedTotal: number | undefined;

  for (let offset = 0; expectedTotal === undefined || offset < expectedTotal;) {
    const response = await fetcher(`${baseUrl}/rest/v1/${path}&order=id.asc`, {
      headers: {
        ...headers,
        Prefer: "count=exact",
        Range: `${offset}-${offset + pageSize - 1}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Lead console read failed (${response.status}).`);
    }

    const range = response.headers.get("content-range") ?? "";
    const match = range.match(/^(?:(\d+)-(\d+)|\*)\/(\d+)$/);
    if (!match) throw new Error("Lead console read did not return an exact total.");

    const total = Number(match[3]);
    if (!Number.isSafeInteger(total)) {
      throw new Error("Lead console read returned an invalid total.");
    }
    if (expectedTotal !== undefined && expectedTotal !== total) {
      throw new Error("Lead count changed while the console was reading pages.");
    }
    expectedTotal = total;

    const page: unknown = await response.json();
    if (!Array.isArray(page)) throw new Error("Lead console read returned invalid rows.");
    if (page.some((row) => row === null || typeof row !== "object" || Array.isArray(row))) {
      throw new Error("Lead console read returned an invalid row.");
    }
    if (total === 0) {
      if (page.length !== 0 || match[1] !== undefined) {
        throw new Error("Lead console returned rows for an empty result.");
      }
      break;
    }

    const first = Number(match[1]);
    const last = Number(match[2]);
    const maximumLength = Math.min(pageSize, total - offset);
    if (
      first !== offset ||
      last - first + 1 !== page.length ||
      page.length === 0 ||
      page.length > maximumLength
    ) {
      throw new Error("Lead console returned an incomplete page.");
    }

    rows.push(...(page as LeadConsoleRow[]));
    offset += page.length;
  }

  return rows;
}
