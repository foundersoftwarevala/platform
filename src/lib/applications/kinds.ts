export const APPLICATION_KINDS = [
  "reseller",
  "vendor",
  "author",
  "franchise",
  "influencer",
  "affiliate",
  "employee",
] as const;
export type ApplicationKind = (typeof APPLICATION_KINDS)[number];

export function isApplicationKind(value: unknown): value is ApplicationKind {
  return typeof value === "string" && APPLICATION_KINDS.some((kind) => kind === value);
}

export const OPEN_STATUSES: readonly string[] = ["pending", "in_review"];

export type ApplicationCounts = {
  total: number;
  byRole: { kind: ApplicationKind; count: number }[];
};
