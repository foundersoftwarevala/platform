export type GateRow = {
  url: string;
  entity_type: string;
  state: string;
  indexable: boolean;
  sitemap_eligible: boolean;
  fingerprint_class: string | null;
  blocking_reason: string | null;
} & Record<string, unknown>;
export type GateHash = { url: string; layer: string; hash: string };
export type GateInput = {
  kinds: string[];
  decisions: GateRow[];
  fingerprints: (GateHash & Record<string, unknown>)[];
  expectedSignature: string;
  maxDropPercent: number;
  crossOnly: boolean;
};

function isDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => isDeepEqual(value, right[index]))
    );
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) && isDeepEqual(Reflect.get(left, key), Reflect.get(right, key)),
    )
  );
}

export function expectedSlotHreflang(
  siblings: { status: string; country_code: string | null }[],
): number {
  // Match the public route: occupied siblings with an ISO code, plus x-default.
  return siblings.filter((row) => row.status === "occupied" && row.country_code).length + 1;
}

export function prepareGateRun(before: GateRow[], hashes: GateHash[], input: GateInput) {
  const previous = before.filter((row) => input.kinds.includes(row.entity_type));
  const rows = new Map(previous.map((row) => [row.url, { ...row }]));
  const evaluated = new Set(input.decisions.map((row) => row.url));
  if (evaluated.size !== input.decisions.length) throw new Error("Duplicate evaluation URLs");
  for (const row of input.decisions) {
    if (!input.kinds.includes(row.entity_type))
      throw new Error("Evaluation outside requested scope");
    rows.set(row.url, { ...row });
  }
  if (!input.crossOnly) {
    for (const row of previous) {
      if (!evaluated.has(row.url)) {
        rows.set(row.url, {
          ...row,
          state: "UNVERIFIED",
          indexable: false,
          sitemap_eligible: false,
          fingerprint_class: "UNVERIFIED",
          blocking_reason: "inventory: URL no longer occurs in the completed inventory.",
        });
      }
    }
  }
  const prints = new Map<string, GateHash>();
  // A removed/nonpublic page must not keep a stale hash in a normal full run.
  if (input.crossOnly)
    for (const print of hashes)
      if (rows.has(print.url)) prints.set(`${print.url}\0${print.layer}`, print);
  for (const print of input.fingerprints) {
    if (!evaluated.has(print.url)) throw new Error("Fingerprint outside evaluated inventory");
    prints.set(`${print.url}\0${print.layer}`, print);
  }
  const groups = (layer: string) => {
    const grouped = new Map<string, Set<string>>();
    for (const print of prints.values()) {
      if (print.layer !== layer) continue;
      if (!grouped.has(print.hash)) grouped.set(print.hash, new Set());
      grouped.get(print.hash)!.add(print.url);
    }
    return [...grouped.values()].filter((urls) => urls.size > 1).map((urls) => [...urls].sort());
  };
  const exact = groups("body");
  const exactMembers = new Set(exact.flat());
  const exactKeys = new Set(exact.map((urls) => JSON.stringify(urls)));
  const masked = groups("body_masked").filter((urls) => !exactKeys.has(JSON.stringify(urls)));
  for (const [classification, duplicateGroups] of [
    ["EXACT_DUPLICATE", exact],
    ["LOW_VALUE_DUPLICATE", masked],
  ] as const) {
    for (const urls of duplicateGroups) {
      for (const url of urls) {
        const row = rows.get(url)!;
        if (classification === "EXACT_DUPLICATE" || !exactMembers.has(url))
          row.fingerprint_class = classification;
        if (row.sitemap_eligible) {
          row.state = "CONTENT_NOT_READY";
          row.indexable = false;
          row.sitemap_eligible = false;
          row.blocking_reason =
            classification === "EXACT_DUPLICATE"
              ? "content_differentiation: this page is word for word identical to another page."
              : "content_differentiation: this page differs only by country, category or product names.";
        }
      }
    }
  }
  const priorEligible = new Set(
    previous.filter((row) => row.sitemap_eligible).map((row) => row.url),
  );
  const after = [...rows.values()];
  const nextEligible = new Set(after.filter((row) => row.sitemap_eligible).map((row) => row.url));
  const lost = [...priorEligible].filter((url) => !nextEligible.has(url)).length;
  const gained = [...nextEligible].filter((url) => !priorEligible.has(url)).length;
  const lossPercent = priorEligible.size ? (lost / priorEligible.size) * 100 : 0;
  const previousByUrl = new Map(previous.map((row) => [row.url, row]));
  const meaningful = (row: GateRow) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== "evaluated_at"));
  const changed = after.filter((row) => {
    const old = previousByUrl.get(row.url);
    return !old || !isDeepEqual(meaningful(old), meaningful(row));
  }).length;
  const stateCounts = (list: GateRow[]) => {
    const counts = new Map<string, number>();
    for (const row of list) counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
    return Object.fromEntries(counts);
  };
  const currentByState = stateCounts(previous);
  const projectedByState = stateCounts(after);
  return {
    rows: after,
    stats: {
      evaluated: evaluated.size,
      currentTotal: previous.length,
      projectedTotal: after.length,
      currentEligible: priorEligible.size,
      projectedEligible: nextEligible.size,
      projectedIneligible: after.length - nextEligible.size,
      currentBlocked: currentByState.BLOCKED ?? 0,
      projectedBlocked: projectedByState.BLOCKED ?? 0,
      currentByState,
      projectedByState,
      lost,
      gained,
      lossPercent,
      maxDropPercent: input.maxDropPercent,
      verdictChanges: changed,
      exactDuplicateGroups: exact.length,
      maskedDuplicateGroups: masked.length,
    },
    stopped: lossPercent > input.maxDropPercent,
  };
}
