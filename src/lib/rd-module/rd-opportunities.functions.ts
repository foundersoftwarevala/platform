import { rdOperator } from "./auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  EVALUATION_AREAS,
  EVALUATION_DECISIONS,
  IDEA_CATEGORIES,
  OPPORTUNITY_STATUSES,
  PARTNERSHIP_STAGES,
  PLATFORMS,
  PRIORITIES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  PROJECT_KINDS,
  SAAS_BRINGS,
  SAAS_NEEDS,
  SAAS_STAGES,
  BRANCH_STATUSES,
  TYPE_LABEL,
  clusterKeyFor,
  publicStatusLabel,
  publicStatusMessage,
  type Evaluation,
  type Opportunity,
  type OpportunityEvent,
  type RdProject,
} from "./rd-opportunity-types";

async function admin() {
  const { supabaseAdmin } = await import("@/lib/rd-module/supabase/client.server");
  return supabaseAdmin;
}

function fail(message: string, error: { message: string } | null) {
  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "rd-opportunities",
        event: message,
        error: error.message,
      }),
    );
    throw new Error(message);
  }
}

const short = (max = 200) => z.string().trim().max(max).default("");
const long = (max = 5000) => z.string().trim().max(max).default("");

const contact = {
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[0-9+()\-\s]*$/, "Phone can contain digits, spaces, + ( ) -")
    .default(""),
  country: z.string().trim().min(2, "Please enter your country").max(80),
  website_hp: z.string().max(0).optional(), // honeypot — must stay empty
  attachments: z
    .array(
      z.object({
        path: z.string().regex(/^pending\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/),
        name: z.string().trim().min(1).max(200),
        size: z.number().int().min(0).max(MAX_ATTACHMENT_BYTES),
        type: z.string().max(120).default(""),
      }),
    )
    .max(MAX_ATTACHMENTS)
    .default([]),
};

const softwareSchema = z.object({
  type: z.literal("SOFTWARE_ON_DEMAND"),
  title: z.string().trim().min(4, "Please add a title").max(160),
  need: z.string().trim().min(10, "Describe the software you need").max(3000),
  business_type: short(),
  category: short(120),
  problem: long(),
  features: long(),
  expected_users: short(),
  target_country: short(),
  target_market: short(),
  existing_software: short(500),
  platforms: z.array(z.enum(PLATFORMS)).max(6).default([]),
  budget: short(120),
  timeline: short(120),
  additional: long(),
  ...contact,
});

const saasSchema = z.object({
  type: z.literal("SAAS_PARTNERSHIP"),
  title: z.string().trim().min(2, "Please add the product name").max(160),
  description_text: z.string().trim().min(10, "Describe the product").max(3000),
  problem: long(),
  target_customers: short(500),
  category: short(120),
  features: long(),
  stage: z.enum(SAAS_STAGES),
  brings: z.array(z.enum(SAAS_BRINGS)).max(9).default([]),
  needs: z.array(z.enum(SAAS_NEEDS)).max(10).default([]),
  current_users: short(),
  current_revenue: short(),
  target_market: short(),
  competitors: short(500),
  business_model: short(500),
  expected_partnership: long(),
  additional: long(),
  website: z
    .string()
    .trim()
    .max(300)
    .url("Website must be a full URL")
    .or(z.literal(""))
    .default(""),
  company: short(160),
  ...contact,
});

const buildSchema = z.object({
  type: z.literal("BUILD_WITH_US"),
  title: z.string().trim().min(4, "Please add an idea title").max(160),
  category: z.enum(IDEA_CATEGORIES),
  problem: z.string().trim().min(10, "Describe the problem").max(3000),
  solution: long(),
  target_users: short(500),
  benefit: long(2000),
  features: long(),
  why: long(2000),
  contribute: long(2000),
  help_needed: long(2000),
  ...contact,
});

const submitSchema = z.discriminatedUnion("type", [softwareSchema, saasSchema, buildSchema]);
export type SubmitOpportunityInput = z.input<typeof submitSchema>;

async function fingerprint() {
  const ip =
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const ua = getRequestHeader("user-agent") ?? "";
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${ip}|${ua.slice(0, 120)}`),
  );
  return Array.from(new Uint8Array(bytes))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newRequestId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `SV-RD-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** Public: submit a Software On Demand / SaaS Partnership / Build With Us request. */
export const submitOpportunity = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) => submitSchema.parse(i))
  .handler(async ({ data }) => {
    if (data.website_hp) throw new Error("Submission rejected");
    const db = await admin();
    const fp = await fingerprint();
    const email = data.email.toLowerCase();

    // Throttle: max 5 submissions per device per hour, 10 per email per day.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const [{ count: fpCount }, { count: emailCount }, { data: dupes }] = await Promise.all([
      db
        .from("rd_opportunities")
        .select("id", { count: "exact", head: true })
        .eq("submitter_fingerprint", fp)
        .gte("created_at", hourAgo),
      db
        .from("rd_opportunities")
        .select("id", { count: "exact", head: true })
        .ilike("contact_email", email)
        .gte("created_at", dayAgo),
      db
        .from("rd_opportunities")
        .select("public_request_id")
        .ilike("contact_email", email)
        .ilike("title", data.title)
        .gte("created_at", dayAgo)
        .limit(1),
    ]);
    if ((fpCount ?? 0) >= 5 || (emailCount ?? 0) >= 10) {
      throw new Error("Too many submissions. Please try again later.");
    }
    if (dupes && dupes.length > 0) {
      throw new Error(
        `You already submitted this request today (ID ${dupes[0]?.public_request_id}).`,
      );
    }

    const {
      type,
      title,
      name,
      phone,
      country,
      website_hp: _hp,
      email: _e,
      attachments,
      ...rest
    } = data;
    let description = "";
    let category = "";
    let company = "";
    if (data.type === "SOFTWARE_ON_DEMAND") {
      description = data.need;
      category = data.category;
    } else if (data.type === "SAAS_PARTNERSHIP") {
      description = data.description_text;
      category = data.category;
      company = data.company;
    } else {
      description = data.problem;
      category = data.category;
    }

    let requestId = newRequestId();
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: row, error } = await db
        .from("rd_opportunities")
        .insert({
          public_request_id: requestId,
          type,
          title,
          description,
          details: rest,
          category,
          country,
          contact_name: name,
          contact_email: email,
          contact_phone: phone,
          company,
          cluster_key: clusterKeyFor(title),
          submitter_fingerprint: fp,
          attachments,
        })
        .select("id, public_request_id, status, created_at")
        .single();
      if (error && error.code === "23505") {
        requestId = newRequestId();
        continue;
      }
      fail("Could not save your submission", error);
      await Promise.all([
        db.from("rd_opportunity_events").insert({
          opportunity_id: row!.id,
          kind: "created",
          to_value: "NEW",
          body: `${TYPE_LABEL[type]} submitted via public website`,
          actor: "Public submitter",
        }),
        db.from("rnd_notifications").insert({
          type: "idea",
          title: `New ${TYPE_LABEL[type]} request`,
          message: `${row!.public_request_id}: ${title}`,
        }),
      ]);
      return {
        requestId: row!.public_request_id,
        status: publicStatusLabel(row!.status),
        createdAt: row!.created_at,
      };
    }
    throw new Error("Could not save your submission");
  });

/** Public: signed upload slots for request attachments (private bucket). */
export const createAttachmentUploads = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        files: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(200),
              size: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),
            }),
          )
          .min(1)
          .max(MAX_ATTACHMENTS),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const folder = crypto.randomUUID();
    return Promise.all(
      data.files.map(async (f, idx) => {
        const safe = f.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-100) || "file";
        const path = `pending/${folder}/${idx}-${safe}`;
        const { data: slot, error } = await db.storage
          .from("rd-attachments")
          .createSignedUploadUrl(path);
        fail("Could not prepare upload", error);
        return { path, token: slot!.token };
      }),
    );
  });

/** Internal: short-lived download link for an attachment. */
export const getAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        path: z
          .string()
          .regex(/^pending\//)
          .max(300),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { data: url, error } = await db.storage
      .from("rd-attachments")
      .createSignedUrl(data.path, 300);
    fail("Could not open file", error);
    return { url: url!.signedUrl };
  });

/** Public: safe status lookup. Requires both request ID and the submitter email. */
export const trackOpportunity = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        requestId: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^SV-RD-[A-Z0-9]{6}$/, "Request ID looks like SV-RD-XXXXXX"),
        email: z.string().trim().email().max(255),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("rd_opportunities")
      .select("public_request_id, type, title, status, created_at, updated_at")
      .eq("public_request_id", data.requestId)
      .ilike("contact_email", data.email.toLowerCase())
      .maybeSingle();
    fail("Lookup failed", error);
    if (!row) return { found: false as const };
    return {
      found: true as const,
      requestId: row.public_request_id,
      type: TYPE_LABEL[row.type as keyof typeof TYPE_LABEL] ?? row.type,
      title: row.title,
      status: publicStatusLabel(row.status),
      message: publicStatusMessage(row.status),
      submittedAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

// ---------------- R&D Manager (internal) ----------------

const OPP_COLUMNS =
  "id, public_request_id, type, title, description, details, category, country, contact_name, contact_email, contact_phone, company, status, priority, source, assigned_to, cluster_key, related_ref, attachments, created_at, updated_at";

export const listOpportunities = createServerFn({ method: "GET" })
  .middleware([rdOperator])
  .handler(async () => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { data, error } = await db
      .from("rd_opportunities")
      .select(OPP_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(1000);
    fail("Could not load opportunities", error);
    return (data ?? []) as unknown as Opportunity[];
  });

export const listRdProjects = createServerFn({ method: "GET" })
  .middleware([rdOperator])
  .handler(async () => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { data, error } = await db
      .from("rd_projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    fail("Could not load projects", error);
    return (data ?? []) as unknown as RdProject[];
  });

export const listEvaluations = createServerFn({ method: "GET" })
  .middleware([rdOperator])
  .handler(async () => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { data, error } = await db
      .from("rd_evaluations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    fail("Could not load evaluations", error);
    return (data ?? []) as unknown as Evaluation[];
  });

export const getOpportunity = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { data: opp, error } = await db
      .from("rd_opportunities")
      .select(OPP_COLUMNS)
      .eq("id", data.id)
      .single();
    fail("Opportunity not found", error);
    const o = opp as unknown as Opportunity;
    const words = o.cluster_key.split("-").filter(Boolean);
    const [events, evaluation, projects, sameCluster, products, ideas] = await Promise.all([
      db
        .from("rd_opportunity_events")
        .select("*")
        .eq("opportunity_id", o.id)
        .order("created_at", { ascending: false })
        .limit(200),
      db.from("rd_evaluations").select("*").eq("opportunity_id", o.id).maybeSingle(),
      db
        .from("rd_projects")
        .select("*")
        .eq("opportunity_id", o.id)
        .order("created_at", { ascending: false }),
      o.cluster_key
        ? db
            .from("rd_opportunities")
            .select("id, public_request_id, title, status, type")
            .eq("cluster_key", o.cluster_key)
            .neq("id", o.id)
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
      words.length
        ? db
            .from("pm_products")
            .select("id, product, version, user_code")
            .or(words.map((w) => `product.ilike.%${w}%`).join(","))
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      words.length
        ? db
            .from("rnd_ideas")
            .select("id, title, status")
            .or(words.map((w) => `title.ilike.%${w}%`).join(","))
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
    ]);
    return {
      opportunity: o,
      events: (events.data ?? []) as OpportunityEvent[],
      evaluation: (evaluation.data ?? null) as unknown as Evaluation | null,
      projects: (projects.data ?? []) as unknown as RdProject[],
      similar: {
        opportunities: sameCluster.data ?? [],
        products: products.data ?? [],
        ideas: ideas.data ?? [],
      },
    };
  });

async function logEvent(
  db: Awaited<ReturnType<typeof admin>>,
  e: {
    opportunity_id: string;
    kind: string;
    from_value?: string;
    to_value?: string;
    body?: string;
    actor?: string;
  },
) {
  const { error } = await db.from("rd_opportunity_events").insert({ actor: "R&D Manager", ...e });
  fail("Could not record activity", error);
}

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(OPPORTUNITY_STATUSES).optional(),
        priority: z.enum(PRIORITIES).optional(),
        assigned_to: z.string().trim().max(80).optional(),
        related_ref: z.string().trim().max(200).optional(),
        reason: z.string().trim().max(2000).default(""),
        actor: z.string().trim().min(2).max(80).default("R&D Manager"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { data: cur, error } = await db
      .from("rd_opportunities")
      .select("status, priority, assigned_to, public_request_id, title")
      .eq("id", data.id)
      .single();
    fail("Opportunity not found", error);
    const patch: {
      status?: (typeof OPPORTUNITY_STATUSES)[number];
      priority?: (typeof PRIORITIES)[number];
      assigned_to?: string;
      related_ref?: string;
    } = {};
    if (data.status && data.status !== cur!.status) {
      if (
        (BRANCH_STATUSES as readonly string[]).includes(data.status) &&
        cur!.status !== "APPROVED"
      ) {
        throw new Error(
          "Only approved opportunities can move to handoff, partnership or R&D project.",
        );
      }
      patch.status = data.status;
    }
    if (data.priority && data.priority !== cur!.priority) patch.priority = data.priority;
    if (data.assigned_to !== undefined && data.assigned_to !== cur!.assigned_to)
      patch.assigned_to = data.assigned_to;
    if (data.related_ref !== undefined) patch.related_ref = data.related_ref;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error: upErr } = await db.from("rd_opportunities").update(patch).eq("id", data.id);
    fail("Could not update opportunity", upErr);
    if (patch.status)
      await logEvent(db, {
        opportunity_id: data.id,
        kind: "status_change",
        from_value: cur!.status,
        to_value: patch.status,
        body: data.reason,
        actor: data.actor,
      });
    if (patch.priority)
      await logEvent(db, {
        opportunity_id: data.id,
        kind: "priority_change",
        from_value: cur!.priority,
        to_value: patch.priority,
        actor: data.actor,
      });
    if (patch.assigned_to !== undefined)
      await logEvent(db, {
        opportunity_id: data.id,
        kind: "assigned",
        from_value: cur!.assigned_to,
        to_value: patch.assigned_to,
        actor: data.actor,
      });
    if (data.related_ref)
      await logEvent(db, {
        opportunity_id: data.id,
        kind: "duplicate_link",
        to_value: data.related_ref,
        body: data.reason,
        actor: data.actor,
      });
    if (patch.status || patch.assigned_to) {
      await db.from("rnd_notifications").insert({
        type: patch.status === "APPROVED" ? "approval" : "idea",
        title: patch.status ? `Status: ${patch.status.replace(/_/g, " ")}` : "Opportunity assigned",
        message: `${cur!.public_request_id}: ${cur!.title}${patch.assigned_to ? ` → ${patch.assigned_to}` : ""}`,
      });
    }
    return { ok: true };
  });

export const addOpportunityNote = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["note", "comment", "info_request"]),
        body: z.string().trim().min(2).max(4000),
        actor: z.string().trim().min(2).max(80).default("R&D Manager"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    await logEvent(db, {
      opportunity_id: data.id,
      kind: data.kind,
      body: data.body,
      actor: data.actor,
    });
    if (data.kind === "info_request") {
      const { data: cur } = await db
        .from("rd_opportunities")
        .select("status, public_request_id")
        .eq("id", data.id)
        .single();
      if (cur && cur.status !== "NEEDS_INFORMATION") {
        await db.from("rd_opportunities").update({ status: "NEEDS_INFORMATION" }).eq("id", data.id);
        await logEvent(db, {
          opportunity_id: data.id,
          kind: "status_change",
          from_value: cur.status,
          to_value: "NEEDS_INFORMATION",
          actor: data.actor,
        });
        await db.from("rnd_notifications").insert({
          type: "feedback",
          title: "More information requested",
          message: cur.public_request_id,
        });
      }
    }
    return { ok: true };
  });

export const saveEvaluation = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        scores: z.record(z.enum(EVALUATION_AREAS), z.number().int().min(0).max(10)),
        decision: z.enum(EVALUATION_DECISIONS).or(z.literal("")),
        notes: z.string().trim().max(5000).default(""),
        evidence: z.string().trim().max(5000).default(""),
        research_links: z.array(z.string().trim().url().max(500)).max(20).default([]),
        decision_reason: z.string().trim().max(2000).default(""),
        actor: z.string().trim().min(2).max(80).default("R&D Manager"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { id, actor, ...rest } = data;
    const { error } = await db
      .from("rd_evaluations")
      .upsert({ opportunity_id: id, ...rest }, { onConflict: "opportunity_id" });
    fail("Could not save evaluation", error);
    const values = Object.values(rest.scores);
    const avg = values.length
      ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
      : "—";
    await logEvent(db, {
      opportunity_id: id,
      kind: "evaluation",
      to_value: rest.decision,
      body: `Average score ${avg}/10. ${rest.decision_reason}`.trim(),
      actor,
    });
    const { data: opp } = await db
      .from("rd_opportunities")
      .select("public_request_id, title")
      .eq("id", id)
      .single();
    await db.from("rnd_notifications").insert({
      type: "idea",
      title: "Evaluation completed",
      message: `${opp?.public_request_id ?? ""}: ${opp?.title ?? ""} — avg ${avg}/10${rest.decision ? `, ${rest.decision}` : ""}`,
    });
    return { ok: true };
  });

const projectSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(PROJECT_KINDS),
  name: z.string().trim().min(3).max(160),
  objective: z.string().trim().max(3000).default(""),
  research_question: z.string().trim().max(2000).default(""),
  owner: z.string().trim().max(80).default(""),
  team: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  timeline: z.string().trim().max(120).default(""),
  acceptance_criteria: z.string().trim().max(4000).default(""),
  technical_notes: z.string().trim().max(4000).default(""),
  commercial_terms: z.string().trim().max(4000).default(""),
  actor: z.string().trim().min(2).max(80).default("R&D Manager"),
});

const STATUS_FOR_KIND: Record<
  (typeof PROJECT_KINDS)[number],
  (typeof OPPORTUNITY_STATUSES)[number]
> = {
  RESEARCH: "RESEARCHING",
  POC: "POC",
  DEVELOPMENT_HANDOFF: "DEVELOPMENT_HANDOFF",
  PARTNERSHIP: "PARTNERSHIP",
};

export const createRdProject = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) => projectSchema.parse(i))
  .handler(async ({ data }) => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { id, actor, ...rest } = data;
    const { data: opp, error } = await db
      .from("rd_opportunities")
      .select("status, public_request_id, title, description, priority")
      .eq("id", id)
      .single();
    fail("Opportunity not found", error);
    if (
      (data.kind === "DEVELOPMENT_HANDOFF" || data.kind === "PARTNERSHIP") &&
      opp!.status !== "APPROVED"
    ) {
      throw new Error(
        "Approve the opportunity before creating a development handoff or partnership.",
      );
    }

    let pipelineItemId: string | null = null;
    if (data.kind === "DEVELOPMENT_HANDOFF") {
      // Hand off into the existing Innovation Pipeline so development can trace the original request.
      const { data: item, error: pErr } = await db
        .from("rnd_pipeline_items")
        .insert({
          title: data.name,
          description:
            `From ${opp!.public_request_id}: ${data.objective || opp!.description}`.slice(0, 2000),
          stage: "prototype",
          priority: opp!.priority,
          assignee: data.owner || "vala(dev)0000",
        })
        .select("id")
        .single();
      fail("Could not create development handoff", pErr);
      pipelineItemId = item!.id;
    }

    const { data: project, error: projErr } = await db
      .from("rd_projects")
      .insert({
        opportunity_id: id,
        ...rest,
        stage: data.kind === "PARTNERSHIP" ? PARTNERSHIP_STAGES[0] : "",
        pipeline_item_id: pipelineItemId,
      })
      .select("id")
      .single();
    fail("Could not create project", projErr);

    const nextStatus = STATUS_FOR_KIND[data.kind];
    if (nextStatus !== opp!.status) {
      await db.from("rd_opportunities").update({ status: nextStatus }).eq("id", id);
      await logEvent(db, {
        opportunity_id: id,
        kind: "status_change",
        from_value: opp!.status,
        to_value: nextStatus,
        actor,
      });
    }
    await logEvent(db, {
      opportunity_id: id,
      kind: "project_created",
      to_value: data.kind,
      body: data.name,
      actor,
    });
    await db.from("rnd_notifications").insert({
      type: "approval",
      title: `${data.kind.replace(/_/g, " ")} created`,
      message: `${opp!.public_request_id}: ${data.name}`,
    });
    return { id: project!.id };
  });

export const updateRdProject = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "on_hold", "completed", "cancelled"]).optional(),
        stage: z.enum(PARTNERSHIP_STAGES).optional(),
        findings: z.string().trim().max(5000).optional(),
        results: z.string().trim().max(5000).optional(),
        recommendation: z.string().trim().max(3000).optional(),
        commercial_terms: z.string().trim().max(4000).optional(),
        actor: z.string().trim().min(2).max(80).default("R&D Manager"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await (await import("./rd-gate.server")).requireRdUnlocked();
    const db = await admin();
    const { id, actor, ...raw } = data;
    const patch = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)) as {
      status?: string;
      stage?: string;
      findings?: string;
      results?: string;
      recommendation?: string;
      commercial_terms?: string;
    };
    const { data: cur, error } = await db
      .from("rd_projects")
      .select("opportunity_id, stage, name, kind")
      .eq("id", id)
      .single();
    fail("Project not found", error);
    const { error: upErr } = await db.from("rd_projects").update(patch).eq("id", id);
    fail("Could not update project", upErr);
    if (patch.stage && patch.stage !== cur!.stage) {
      await logEvent(db, {
        opportunity_id: cur!.opportunity_id,
        kind: "partnership_stage",
        from_value: cur!.stage,
        to_value: patch.stage,
        body: cur!.name,
        actor,
      });
      await db.from("rnd_notifications").insert({
        type: "approval",
        title: "Partnership stage changed",
        message: `${cur!.name} → ${patch.stage}`,
      });
    } else {
      await logEvent(db, {
        opportunity_id: cur!.opportunity_id,
        kind: "note",
        body: `Project "${cur!.name}" updated`,
        actor,
      });
    }
    return { ok: true };
  });
