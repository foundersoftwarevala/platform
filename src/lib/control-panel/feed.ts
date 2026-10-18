/**
 * The Control Panel banner's items, as the browser receives them from
 * /api/control-panel/feed. Every item is a real row; `action` says what its
 * main button does to that row.
 */

export type FeedAlertSource =
  | "server_alerts"
  | "security_alerts"
  | "finance_alerts"
  | "legal_alerts"
  | "lead_alerts"
  | "seo_alerts"
  | "marketing_alerts";

export type FeedAction =
  /** Decide the application as approved, through the applications API. */
  | { type: "approve"; kind: string; id: string }
  /** Mark the alert acknowledged in the module that raised it. */
  | { type: "acknowledge"; source: FeedAlertSource; id: string }
  /** Nothing to decide here: open the module that owns it. */
  | { type: "open" };

export type FeedItem = {
  id: string;
  kind: "alert" | "notification" | "approval" | "todo";
  title: string;
  detail: string;
  meta?: string;
  /** When it happened, or when it is due. */
  at: string | null;
  /** The module that owns the row. */
  href: string;
  action: FeedAction;
};
