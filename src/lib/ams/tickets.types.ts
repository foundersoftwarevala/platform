export const AMS_STATUSES = [
  "draft","submitted","assigned","accepted","in_progress",
  "waiting_customer","waiting_developer","waiting_qa","testing",
  "resolved","closed","reopened","cancelled","archived",
] as const;
export type AmsStatus = (typeof AMS_STATUSES)[number];

export const AMS_PRIORITIES = ["low","medium","high","critical"] as const;
export type AmsPriority = (typeof AMS_PRIORITIES)[number];

export const AMS_CHAT_CHANNELS = ["support","developer","qa","boss","ai","customer"] as const;
export type AmsChatChannel = (typeof AMS_CHAT_CHANNELS)[number];

export const STATUS_META: Record<AmsStatus, { label: string; tone: string }> = {
  draft:              { label: "Draft",              tone: "bg-muted text-muted-foreground" },
  submitted:          { label: "Submitted",          tone: "bg-blue-500/15 text-blue-400" },
  assigned:           { label: "Assigned",           tone: "bg-indigo-500/15 text-indigo-400" },
  accepted:           { label: "Accepted",           tone: "bg-cyan-500/15 text-cyan-400" },
  in_progress:        { label: "In progress",        tone: "bg-trophy/15 text-trophy" },
  waiting_customer:   { label: "Waiting customer",   tone: "bg-amber-500/15 text-amber-400" },
  waiting_developer:  { label: "Waiting developer",  tone: "bg-amber-500/15 text-amber-400" },
  waiting_qa:         { label: "Waiting QA",         tone: "bg-amber-500/15 text-amber-400" },
  testing:            { label: "Testing",            tone: "bg-purple-500/15 text-purple-400" },
  resolved:           { label: "Resolved",           tone: "bg-emerald-500/15 text-emerald-400" },
  closed:             { label: "Closed",             tone: "bg-zinc-500/15 text-zinc-400" },
  reopened:           { label: "Reopened",           tone: "bg-rose-500/15 text-rose-400" },
  cancelled:          { label: "Cancelled",          tone: "bg-zinc-500/15 text-zinc-400" },
  archived:           { label: "Archived",           tone: "bg-zinc-500/15 text-zinc-400" },
};

export const PRIORITY_META: Record<AmsPriority, { label: string; tone: string }> = {
  low:      { label: "Low",      tone: "bg-zinc-500/15 text-zinc-300" },
  medium:   { label: "Medium",   tone: "bg-blue-500/15 text-blue-400" },
  high:     { label: "High",     tone: "bg-amber-500/15 text-amber-400" },
  critical: { label: "Critical", tone: "bg-rose-500/15 text-rose-400" },
};

export type Ticket = {
  id: string;
  ticket_no: string;
  subject: string;
  description: string | null;
  product: string | null;
  category: string | null;
  priority: AmsPriority;
  status: AmsStatus;
  department: string | null;
  team: string | null;
  expected_resolution_at: string | null;
  created_by: string;
  assignee_id: string | null;
  customer_id: string | null;
  tags: string[];
  resolved_at: string | null;
  closed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};
