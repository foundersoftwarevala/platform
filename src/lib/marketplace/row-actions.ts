/**
 * Row actions, resolved from the record rather than listed per screen.
 *
 * I previously reported these as blocked on DDL. That was wrong, and worth
 * saying plainly: marketplace_products already carries content_status,
 * moderation_status and visible, and those three are exactly the state section
 * 14 wants actions to follow. No new table is needed to make a row action
 * status-aware; the state was there all along.
 *
 * This extends the Action Layer from Part 1 rather than adding a second
 * registry: the same module, the same idea of an action being unavailable
 * *with a reason*, and the same audit path underneath.
 */

export type RowActionId =
  | "view" | "edit" | "publish" | "unpublish" | "archive" | "restore"
  | "duplicate" | "delete" | "preview" | "live_demo" | "audit";

export type DangerLevel = "none" | "caution" | "high";

/** The contract section 3 asks each action to declare. */
export type RowAction = {
  id: RowActionId;
  label: string;
  variant: "primary" | "outline" | "ghost" | "danger";
  /** Semantic colour token, from the palette — never a hardcoded colour. */
  token: string;
  /** The record states this action is legal in. Empty means any. */
  allowedStatuses: string[];
  confirmationRequired: boolean;
  auditEvent: string;
  dangerLevel: DangerLevel;
  /** Whether it belongs in the visible row or the overflow menu. */
  primary: boolean;
};

export const ROW_ACTIONS: RowAction[] = [
  { id: "view", label: "View", variant: "ghost", token: "neutral", allowedStatuses: [], confirmationRequired: false, auditEvent: "product.viewed", dangerLevel: "none", primary: true },
  { id: "edit", label: "Edit", variant: "outline", token: "secondary", allowedStatuses: [], confirmationRequired: false, auditEvent: "product.updated", dangerLevel: "none", primary: true },
  { id: "preview", label: "Preview", variant: "ghost", token: "neutral", allowedStatuses: [], confirmationRequired: false, auditEvent: "product.previewed", dangerLevel: "none", primary: false },
  { id: "live_demo", label: "Live Demo", variant: "ghost", token: "info", allowedStatuses: ["published"], confirmationRequired: false, auditEvent: "product.demo_opened", dangerLevel: "none", primary: false },
  { id: "publish", label: "Publish", variant: "primary", token: "primary", allowedStatuses: ["draft", "coming_soon"], confirmationRequired: false, auditEvent: "product.published", dangerLevel: "caution", primary: true },
  { id: "unpublish", label: "Unpublish", variant: "outline", token: "warning", allowedStatuses: ["published"], confirmationRequired: true, auditEvent: "product.unpublished", dangerLevel: "caution", primary: true },
  { id: "duplicate", label: "Duplicate", variant: "ghost", token: "secondary", allowedStatuses: [], confirmationRequired: false, auditEvent: "product.duplicated", dangerLevel: "none", primary: false },
  { id: "archive", label: "Archive", variant: "outline", token: "warning", allowedStatuses: ["draft", "published", "coming_soon"], confirmationRequired: true, auditEvent: "product.archived", dangerLevel: "caution", primary: false },
  { id: "restore", label: "Restore", variant: "outline", token: "success", allowedStatuses: ["archived"], confirmationRequired: false, auditEvent: "product.restored", dangerLevel: "none", primary: true },
  { id: "delete", label: "Delete", variant: "danger", token: "danger", allowedStatuses: [], confirmationRequired: true, auditEvent: "product.deleted", dangerLevel: "high", primary: false },
  { id: "audit", label: "Audit", variant: "ghost", token: "neutral", allowedStatuses: [], confirmationRequired: false, auditEvent: "product.audit_viewed", dangerLevel: "none", primary: false },
];

/**
 * The state machine section 15 asks for, expressed as what each state may
 * become. A transition that is not here is refused rather than attempted.
 */
export const TRANSITIONS: Record<string, string[]> = {
  draft: ["published", "archived"],
  coming_soon: ["published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
};

export function transitionAllowed(from: string, to: string): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** What a given action would move the record to. */
export const ACTION_TARGET: Partial<Record<RowActionId, string>> = {
  publish: "published",
  unpublish: "draft",
  archive: "archived",
  restore: "draft",
};

export type RecordContext = {
  id: string;
  content_status?: string | null;
  moderation_status?: string | null;
  visible?: boolean | null;
  slug?: string | null;
  demo_url?: string | null;
};

export type ResolvedRowAction = RowAction & {
  available: boolean;
  /** Why not. Section 19 asks for the reason, not a greyed-out mystery. */
  reason: string | null;
  href?: string;
};

/**
 * What this record can actually have done to it right now.
 *
 * An action is returned either way — the caller decides whether to hide it or
 * disable it — but it always carries the reason when it cannot run, because a
 * disabled button that will not say why is its own kind of dead end.
 */
export function resolveRowActions(
  record: RecordContext,
  can: (action: RowActionId) => boolean = () => true,
): ResolvedRowAction[] {
  const status = String(record.content_status ?? "draft");
  const moderation = String(record.moderation_status ?? "");

  return ROW_ACTIONS.map((a): ResolvedRowAction => {
    const off = (reason: string): ResolvedRowAction => ({ ...a, available: false, reason });

    if (!can(a.id)) return off("You do not have permission for this.");

    if (a.allowedStatuses.length && !a.allowedStatuses.includes(status)) {
      return off(
        status === "published" && a.id === "publish"
          ? "Already published."
          : `Not available while this record is ${status}.`,
      );
    }

    switch (a.id) {
      case "publish":
        // Moderation is a different question from publication state, and it
        // gates it: an unapproved product does not go public from here.
        if (moderation && moderation !== "approved") {
          return off(`Moderation says ${moderation}, so this cannot be published.`);
        }
        return { ...a, available: true, reason: null };

      case "live_demo":
        if (!record.demo_url) return off("This product has no demo URL.");
        return { ...a, available: true, reason: null, href: record.demo_url };

      case "view":
      case "preview":
        if (!record.slug) return off("This product has no slug, so it has no page.");
        return {
          ...a, available: true, reason: null,
          href: `/marketplace/product/${record.slug}`,
        };

      case "delete":
        // Never decided in the browser. The server checks orders, licences and
        // entitlements and refuses with the exact dependency — section 9.
        return {
          ...a, available: true, reason: null,
        };

      default:
        return { ...a, available: true, reason: null };
    }
  });
}
