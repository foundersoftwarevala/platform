export type MarketplaceFilterName = "status" | "moderation" | "missing" | "range";

export type MarketplaceFilterRule = {
  column: string;
  operator: "eq" | "is" | "gte";
  values: readonly string[];
  resolveColumn?: (value: string) => string;
  resolveValue?: (value: string, now: Date) => string;
};

export type MarketplaceSectionFilterSchema = Partial<
  Record<MarketplaceFilterName, MarketplaceFilterRule>
>;

const CONTENT_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "published",
  "changes_requested",
  "rejected",
  "suspended",
  "archived",
] as const;

const MODERATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "published",
  "suspended",
  "changes_requested",
  "rejected",
  "archived",
] as const;

const MISSING_PRODUCT_FIELDS = [
  "category_id",
  "demo_url",
  "description",
  "industry_label",
  "price_label",
  "thumbnail_url",
] as const;

const DATE_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;

const productQueueSchema: MarketplaceSectionFilterSchema = {
  status: {
    column: "content_status",
    operator: "eq",
    values: [...CONTENT_STATUSES, "active", "inactive"],
    resolveColumn: (value) =>
      value === "active" || value === "inactive" ? "visible" : "content_status",
    resolveValue: (value) => (value === "active" ? "true" : value === "inactive" ? "false" : value),
  },
  moderation: { column: "moderation_status", operator: "eq", values: MODERATION_STATUSES },
  missing: {
    column: "",
    operator: "is",
    values: MISSING_PRODUCT_FIELDS,
    resolveColumn: (field) => field,
    resolveValue: () => "null",
  },
  range: {
    column: "created_at",
    operator: "gte",
    values: Object.keys(DATE_RANGES),
    resolveValue: (range, now) => {
      const days = DATE_RANGES[range as keyof typeof DATE_RANGES];
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    },
  },
};

const PRODUCT_QUEUE_SECTIONS = [
  "Products",
  "Product Content",
  "Product Media",
  "Product URLs",
  "Product Analytics",
  "Demo System",
  "Pricing",
  "Moderation",
  "Author Approval",
  "Cards",
  "Card Manager",
] as const;

export const filterSchema: Record<string, MarketplaceSectionFilterSchema> = Object.fromEntries(
  PRODUCT_QUEUE_SECTIONS.map((section) => [section, productQueueSchema]),
);
