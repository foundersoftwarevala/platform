import { getRole } from "./config";
import { documentFields } from "./documents";
import { serviceRest } from "./gateway.server";

/**
 * Every application submitted through /apply/<role>, one shape for all of them.
 *
 * Each role keeps its own table and its own review function - nothing is
 * copied into a second store. What this adds is one way to read them all and
 * one way to decide them, so the Control Panel can manage every application
 * from a single queue while each role's Manager keeps its own account view.
 */

export const APPLICATION_KINDS = [
  "reseller",
  "vendor",
  "author",
  "franchise",
  "influencer",
  "affiliate",
] as const;
export type ApplicationKind = (typeof APPLICATION_KINDS)[number];

export function isApplicationKind(value: unknown): value is ApplicationKind {
  return typeof value === "string" && (APPLICATION_KINDS as readonly string[]).includes(value);
}

type Row = Record<string, unknown>;

export type ApplicationSummary = {
  kind: ApplicationKind;
  id: string;
  number: string;
  name: string;
  email: string;
  status: string;
  reason: string | null;
  submitted: string;
  /** The decisions this application can take now, in the order a reviewer would. */
  actions: string[];
};

type Definition = {
  table: string;
  owner: string;
  scope?: string;
  select: string;
  number: (r: Row) => string;
  name: (r: Row) => string;
  email: (r: Row) => string;
  reason: (r: Row) => string | null;
  submitted: (r: Row) => string;
  /** The submitted answers, keyed as the form keys them. */
  answers: (r: Row) => Row;
  /** Target statuses available from each current status. */
  transitions: Record<string, string[]>;
  /** The review function and how its arguments are named. */
  review: (id: string, status: string, reason: string | null) => { fn: string; args: Row };
  /** Where this application's decisions are written in the audit trail. */
  audit: { table: "marketplace_audit_logs" | "influencer_audit_logs"; entity: string };
  /** The word a reviewer uses for "approve" in this table's status vocabulary. */
  approvedStatus: string;
};

const text = (v: unknown) => (v == null ? "" : String(v));
const idKey = (id: unknown) => text(id).replace(/-/g, "").slice(0, 10).toUpperCase();

const seller = (kind: "vendor" | "author"): Definition => ({
  table: "marketplace_sellers",
  owner: "owner_user_id",
  scope: `seller_kind=eq.${kind}`,
  select:
    "id,display_name,slug,status,seller_kind,application,applied_at,created_at,rejection_reason",
  number: (r) => text((r.application as Row | null)?.application_number) || text(r.slug),
  name: (r) => text(r.display_name),
  email: (r) => text((r.application as Row | null)?.email),
  reason: (r) => (r.rejection_reason == null ? null : text(r.rejection_reason)),
  submitted: (r) => text(r.applied_at ?? r.created_at),
  answers: (r) => (r.application as Row | null) ?? {},
  transitions: {
    pending: ["approved", "rejected"],
    approved: ["suspended"],
    suspended: ["approved"],
  },
  review: (id, status, reason) => ({
    fn: "review_seller_application",
    args: { p_id: id, p_status: status, p_reason: reason },
  }),
  audit: { table: "marketplace_audit_logs", entity: "marketplace_seller" },
  approvedStatus: "approved",
});

const DEFINITIONS: Record<ApplicationKind, Definition> = {
  reseller: {
    table: "resellers",
    owner: "user_id",
    select: "id,code,name,email,company_name,status,application,applied_at,created_at",
    number: (r) => text(r.code),
    name: (r) => [text(r.name), text(r.company_name)].filter(Boolean).join(" — "),
    email: (r) => text(r.email),
    // A reseller refusal is recorded in the audit trail; the latest one is shown.
    reason: () => null,
    submitted: (r) => text(r.applied_at ?? r.created_at),
    answers: (r) => (r.application as Row | null) ?? {},
    transitions: { pending: ["active", "rejected"], active: ["suspended"], suspended: ["active"] },
    review: (id, status, reason) => ({
      fn: "mm_reseller_status",
      args: { p_id: id, p_to: status, p_reason: reason },
    }),
    audit: { table: "marketplace_audit_logs", entity: "reseller" },
    approvedStatus: "active",
  },
  vendor: seller("vendor"),
  author: seller("author"),
  franchise: {
    table: "franchise_applications",
    owner: "applicant_user_id",
    select:
      "id,code,owner_name,business_name,email,status,review_notes,application,applied_at,created_at",
    number: (r) => text(r.code),
    name: (r) => [text(r.owner_name), text(r.business_name)].filter(Boolean).join(" — "),
    email: (r) => text(r.email),
    reason: (r) => (r.review_notes == null ? null : text(r.review_notes)),
    submitted: (r) => text(r.applied_at ?? r.created_at),
    answers: (r) => (r.application as Row | null) ?? {},
    transitions: {
      pending: ["in_review", "approved", "rejected"],
      in_review: ["approved", "rejected"],
    },
    review: (id, status, reason) => ({
      fn: "review_franchise_application",
      args: { p_id: id, p_status: status, p_notes: reason },
    }),
    audit: { table: "marketplace_audit_logs", entity: "franchise_application" },
    approvedStatus: "approved",
  },
  influencer: {
    table: "influencer_applications",
    owner: "applicant_user_id",
    select:
      "id,application_number,full_name,email,phone,country,region,social_profiles,followers,niche," +
      "engagement_rate,tax_details,payment_details,status,rejection_reason,created_at,application",
    number: (r) => text(r.application_number),
    name: (r) => text(r.full_name),
    email: (r) => text(r.email),
    reason: (r) => (r.rejection_reason == null ? null : text(r.rejection_reason)),
    submitted: (r) => text(r.created_at),
    // Applications since the form kept its answers verbatim are read from that.
    // Earlier ones exist only as columns; their answers are put back under the
    // form's own keys so the detail view reads the same as every other role.
    answers: (r) => {
      if (r.application && typeof r.application === "object") return r.application as Row;
      const social = (r.social_profiles as Row | null) ?? {};
      const tax = (r.tax_details as Row | null) ?? {};
      return {
        fullName: r.full_name,
        email: r.email,
        phone: r.phone,
        country: r.country,
        region: r.region,
        instagram: social.instagram,
        youtube: social.youtube,
        linkedin: social.linkedin,
        xTwitter: social.x,
        followers: r.followers,
        engagementRate: r.engagement_rate,
        niche: r.niche,
        rateCard: social.rate_card,
        pastBrands: social.past_brands,
        idType: tax.id_type,
      };
    },
    transitions: {
      pending: ["in_review", "approved", "rejected"],
      in_review: ["approved", "rejected"],
    },
    review: (id, status, reason) => ({
      fn: "review_influencer_application",
      args: { p_application_id: id, p_status: status, p_rejection_reason: reason },
    }),
    audit: { table: "influencer_audit_logs", entity: "application" },
    approvedStatus: "approved",
  },
  affiliate: {
    table: "marketplace_affiliate_partners",
    owner: "user_id",
    select: "id,display_name,status,application,applied_at,created_at,rejection_reason",
    number: (r) => `AFF-${idKey(r.id)}`,
    name: (r) => text(r.display_name),
    email: (r) => text((r.application as Row | null)?.email),
    reason: (r) => (r.rejection_reason == null ? null : text(r.rejection_reason)),
    submitted: (r) => text(r.applied_at ?? r.created_at),
    answers: (r) => (r.application as Row | null) ?? {},
    transitions: {
      pending: ["approved", "rejected"],
      approved: ["suspended"],
      suspended: ["approved"],
    },
    review: (id, status, reason) => ({
      fn: "review_affiliate_application",
      args: { p_id: id, p_status: status, p_reason: reason },
    }),
    audit: { table: "marketplace_audit_logs", entity: "marketplace_affiliate_partner" },
    approvedStatus: "approved",
  },
};

export function definitionOf(kind: ApplicationKind): Definition {
  return DEFINITIONS[kind];
}

/** Statuses that still wait for a decision. */
export const OPEN_STATUSES = ["pending", "in_review"];

function summarise(kind: ApplicationKind, r: Row): ApplicationSummary {
  const d = DEFINITIONS[kind];
  const status = text(r.status);
  return {
    kind,
    id: text(r.id),
    number: d.number(r),
    name: d.name(r),
    email: d.email(r),
    status,
    reason: d.reason(r),
    submitted: d.submitted(r),
    actions: d.transitions[status] ?? [],
  };
}

/**
 * Applications of one kind, or of every kind, newest first.
 *
 * `open` keeps to the ones still waiting for a decision. The cap is per kind
 * and generous: the queue is the working set, not an archive, and a limit that
 * silently hid applications would be worse than a long list.
 */
export async function listApplications(
  kinds: ApplicationKind[],
  open: boolean,
): Promise<ApplicationSummary[]> {
  const results = await Promise.all(
    kinds.map(async (kind) => {
      const d = DEFINITIONS[kind];
      const filters = [d.scope, open ? `status=in.(${OPEN_STATUSES.join(",")})` : null]
        .filter(Boolean)
        .join("&");
      const response = await serviceRest(
        `${d.table}?select=${d.select}${filters ? `&${filters}` : ""}&order=created_at.desc&limit=1000`,
      );
      if (!response.ok)
        throw new Error(`${kind} applications could not be read (${response.status})`);
      const rows = (await response.json()) as Row[];
      // Resellers, sellers and affiliates an operator created directly - or who
      // joined before the form existed - have no application: they are
      // accounts, not applicants, and stay in their own Manager. Franchise and
      // influencer tables hold nothing but applications.
      const holdsOnlyApplications = kind === "franchise" || kind === "influencer";
      return rows
        .filter(
          (r) =>
            holdsOnlyApplications ||
            r.application != null ||
            OPEN_STATUSES.includes(text(r.status)),
        )
        .map((r) => summarise(kind, r));
    }),
  );
  return results.flat().sort((a, b) => (a.submitted < b.submitted ? 1 : -1));
}

export type ApplicationField = { key: string; label: string; value: string | null };
export type ApplicationSection = { title: string; fields: ApplicationField[] };
export type ApplicationDocument = {
  id: string;
  field: string;
  label: string;
  name: string;
  mime: string;
  size: number;
  uploadedAt: string;
};
export type ApplicationEvent = { at: string; action: string; actor: string; reason: string | null };

export type ApplicationDetail = ApplicationSummary & {
  sections: ApplicationSection[];
  documents: ApplicationDocument[];
  history: ApplicationEvent[];
  ownerUserId: string | null;
};

/** Keys the system writes into an application; shown with plain labels. */
const SYSTEM_LABELS: Record<string, string> = {
  application_number: "Application number",
  agreement_accepted_at: "Agreement accepted",
  region: "City / State",
};

function display(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** One application, in full: every answer, its documents and its decisions. */
export async function getApplication(
  kind: ApplicationKind,
  id: string,
): Promise<ApplicationDetail | null> {
  const d = DEFINITIONS[kind];
  const response = await serviceRest(
    `${d.table}?select=${d.select},${d.owner}&id=eq.${encodeURIComponent(id)}${d.scope ? `&${d.scope}` : ""}&limit=1`,
  );
  if (!response.ok) throw new Error(`The application could not be read (${response.status})`);
  const [row] = (await response.json()) as Row[];
  if (!row) return null;

  const answers = d.answers(row);
  const config = getRole(kind);
  const files = new Set(documentFields(kind).map((f) => f.name));
  const seen = new Set<string>();
  const sections: ApplicationSection[] = [];

  for (const section of config?.sections ?? []) {
    const fields: ApplicationField[] = [];
    for (const field of section.fields) {
      // A document is shown as a document, below - never as a file name.
      if (files.has(field.name)) continue;
      seen.add(field.name);
      fields.push({ key: field.name, label: field.label, value: display(answers[field.name]) });
    }
    if (fields.length) sections.push({ title: section.title, fields });
  }

  // Anything else the application holds is shown too: nothing submitted is hidden.
  const other: ApplicationField[] = [];
  for (const [key, raw] of Object.entries(answers)) {
    if (seen.has(key) || files.has(key) || raw == null || raw === "") continue;
    other.push({ key, label: SYSTEM_LABELS[key] ?? key, value: display(raw) });
  }
  if (other.length) sections.push({ title: "Other details", fields: other });

  const [documents, history] = await Promise.all([listDocuments(kind, id), historyOf(kind, id)]);
  const summary = summarise(kind, row);
  // The reseller's latest refusal lives in the audit trail, not on the row.
  const reason = summary.reason ?? history.find((e) => e.reason)?.reason ?? null;
  return {
    ...summary,
    reason,
    sections,
    documents,
    history,
    ownerUserId: row[d.owner] == null ? null : text(row[d.owner]),
  };
}

export async function listDocuments(
  kind: ApplicationKind,
  id: string,
): Promise<ApplicationDocument[]> {
  const response = await serviceRest(
    `application_documents?select=id,field,original_name,mime_type,size_bytes,uploaded_at` +
      `&application_kind=eq.${kind}&application_id=eq.${encodeURIComponent(id)}&order=uploaded_at.asc`,
  );
  if (!response.ok) return [];
  const labels = new Map(documentFields(kind).map((f) => [f.name, f.label]));
  return ((await response.json()) as Row[]).map((r) => ({
    id: text(r.id),
    field: text(r.field),
    label: labels.get(text(r.field)) ?? text(r.field),
    name: text(r.original_name),
    mime: text(r.mime_type),
    size: Number(r.size_bytes ?? 0),
    uploadedAt: text(r.uploaded_at),
  }));
}

async function historyOf(kind: ApplicationKind, id: string): Promise<ApplicationEvent[]> {
  const d = DEFINITIONS[kind];
  if (d.audit.table === "influencer_audit_logs") {
    const response = await serviceRest(
      `influencer_audit_logs?select=action,actor_user_id,metadata,after_data,created_at` +
        `&entity_type=eq.${d.audit.entity}&entity_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=50`,
    );
    if (!response.ok) return [];
    return ((await response.json()) as Row[]).map((r) => {
      const after = (r.after_data as Row | null) ?? {};
      return {
        at: text(r.created_at),
        action: text(r.action),
        actor: text(r.actor_user_id) || "system",
        reason: after.rejection_reason == null ? null : text(after.rejection_reason),
      };
    });
  }
  const response = await serviceRest(
    `marketplace_audit_logs?select=action,actor,reason,created_at` +
      `&entity_type=eq.${d.audit.entity}&entity_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=50`,
  );
  if (!response.ok) return [];
  return ((await response.json()) as Row[]).map((r) => ({
    at: text(r.created_at),
    action: text(r.action),
    actor: text(r.actor) || "system",
    reason: r.reason == null || r.reason === "" ? null : text(r.reason),
  }));
}

/** The row an application lives in, found by who applied - used after a submission. */
export async function findOwnApplication(
  kind: ApplicationKind,
  userId: string,
): Promise<{ id: string; status: string; number: string } | null> {
  const d = DEFINITIONS[kind];
  const response = await serviceRest(
    `${d.table}?select=${d.select}&${d.owner}=eq.${encodeURIComponent(userId)}` +
      `${d.scope ? `&${d.scope}` : ""}&order=created_at.desc&limit=1`,
  );
  if (!response.ok) return null;
  const [row] = (await response.json()) as Row[];
  return row ? { id: text(row.id), status: text(row.status), number: d.number(row) } : null;
}

/** Whether this user is the applicant, read from the application itself. */
export async function ownerOf(
  kind: ApplicationKind,
  id: string,
): Promise<{ owner: string | null; status: string } | null> {
  const d = DEFINITIONS[kind];
  const response = await serviceRest(
    `${d.table}?select=${d.owner},status&id=eq.${encodeURIComponent(id)}${d.scope ? `&${d.scope}` : ""}&limit=1`,
  );
  if (!response.ok) return null;
  const [row] = (await response.json()) as Row[];
  return row
    ? { owner: row[d.owner] == null ? null : text(row[d.owner]), status: text(row.status) }
    : null;
}
