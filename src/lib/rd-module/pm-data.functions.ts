import { rdOperator } from "./auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/lib/rd-module/supabase/client.server");
  return supabaseAdmin;
}

function fail(message: string, error: { message: string } | null) {
  if (error) throw new Error(`${message}: ${error.message}`);
}

type AuditInput = {
  action: string;
  category: "decision" | "escalation" | "ai_review" | "system";
  details: string;
  target: string;
  actor?: string;
  status?: "completed" | "pending" | "forwarded";
};

async function writeAudit(db: Awaited<ReturnType<typeof admin>>, entry: AuditInput) {
  await db.from("pm_audit_logs").insert({
    action: entry.action,
    category: entry.category,
    details: entry.details,
    target: entry.target,
    actor: entry.actor ?? "Pro Manager",
    status: entry.status ?? "completed",
    ip: "Internal",
  });
}

const id = z.object({ id: z.string().uuid() });

/* ---------------- Pro user registry ---------------- */

export const setProUserStatus = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        status: z.enum(["active", "suspended", "expired", "high_risk"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("pm_users").update({ status: data.status }).eq("id", data.id);
    fail("Could not update the user status", error);
    await writeAudit(db, {
      action: data.status === "suspended" ? "Access Suspended" : "User Status Updated",
      category: "decision",
      details: `${data.code} set to ${data.status}`,
      target: data.code,
    });
    return { ok: true };
  });

/* ---------------- Support tickets ---------------- */

export const createTicket = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        user_code: z.string().min(1),
        type: z.enum(["Technical", "Billing", "Feature", "Bug"]),
        severity: z.enum(["Critical", "High", "Medium", "Low"]),
        product: z.string().min(1).max(120),
        subject: z.string().min(3).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const code = `TKT-${Date.now().toString().slice(-6)}`;
    const { data: row, error } = await db
      .from("pm_tickets")
      .insert({ ...data, code, status: "new" })
      .select()
      .single();
    fail("Could not create the ticket", error);
    await db.from("pm_communication_logs").insert({
      code: `LOG-${Date.now().toString().slice(-6)}`,
      type: "chat",
      user_code: data.user_code,
      content: `Support request opened: ${data.subject}`,
    });
    await writeAudit(db, {
      action: "Support Ticket Created",
      category: "system",
      details: data.subject,
      target: code,
    });
    return row;
  });

export const updateTicketStatus = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        status: z.enum(["new", "in_progress", "waiting_user", "resolved", "escalated"]),
        note: z.string().max(400).default(""),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("pm_tickets").update({ status: data.status }).eq("id", data.id);
    fail("Could not update the ticket", error);
    if (data.status === "escalated") {
      await db.from("pm_alerts").insert({
        code: `ALT-${Date.now().toString().slice(-6)}`,
        type: "sla",
        message: `Ticket ${data.code} escalated by the Pro Manager`,
        severity: "high",
      });
    }
    await writeAudit(db, {
      action: `Ticket ${data.status.replace("_", " ")}`,
      category: "escalation",
      details: data.note || `Ticket ${data.code} moved to ${data.status}`,
      target: data.code,
      status: data.status === "escalated" ? "forwarded" : "completed",
    });
    return { ok: true };
  });

/* ---------------- Issue & bug tracker ---------------- */

export const updateIssue = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        status: z.enum(["open", "ai_fixing", "dev_review", "resolved"]),
        registerAiAttempt: z.boolean().default(false),
        currentAttempts: z.number().int().min(0).default(0),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const patch: { status: string; ai_attempts?: number; last_attempt_at?: string } = {
      status: data.status,
    };
    if (data.registerAiAttempt) {
      patch.ai_attempts = data.currentAttempts + 1;
      patch.last_attempt_at = new Date().toISOString();
    }
    const { error } = await db.from("pm_issues").update(patch).eq("id", data.id);
    fail("Could not update the issue", error);
    await writeAudit(db, {
      action: data.registerAiAttempt ? "AI Fix Attempt" : "Issue Updated",
      category: data.registerAiAttempt ? "ai_review" : "system",
      details: `${data.code} moved to ${data.status}`,
      target: data.code,
    });
    return { ok: true };
  });

/* ---------------- Premium assist ---------------- */

export const updateAssistSession = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        status: z.enum(["active", "paused", "ended", "escalated"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("pm_assist_sessions")
      .update({ status: data.status })
      .eq("id", data.id);
    fail("Could not update the assist session", error);
    await writeAudit(db, {
      action: `Assist Session ${data.status}`,
      category: "system",
      details: `Session ${data.code} ${data.status}`,
      target: data.code,
      status: data.status === "escalated" ? "forwarded" : "completed",
    });
    return { ok: true };
  });

/* ---------------- Promises & SLA ---------------- */

export const updatePromise = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        status: z.enum(["on_track", "near_breach", "breached", "fulfilled"]).optional(),
        extendHours: z.number().int().min(1).max(168).optional(),
        note: z.string().max(400).default(""),
        intent: z.enum(["fulfil", "extend", "escalate", "correction"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const patch: { status?: string; deadline?: string } = {};
    if (data.status) patch.status = data.status;

    if (data.intent === "extend" && data.extendHours) {
      const { data: current, error: readError } = await db
        .from("pm_promises")
        .select("deadline")
        .eq("id", data.id)
        .single();
      fail("Promise not found", readError);
      const next = new Date(new Date(current!.deadline).getTime() + data.extendHours * 3600_000);
      patch.deadline = next.toISOString();
      patch.status = "on_track";
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await db.from("pm_promises").update(patch).eq("id", data.id);
      fail("Could not update the promise", error);
    }

    if (data.intent === "escalate") {
      await db.from("pm_escalations").insert({
        code: `ESC-${Date.now().toString().slice(-6)}`,
        source: "task_manager",
        source_id: data.code,
        subject: `SLA escalation for ${data.code}`,
        description: data.note || `Promise ${data.code} escalated by the Pro Manager`,
        priority: "high",
        status: "pending",
        created_by: "PRO-MANAGER",
      });
    }

    await writeAudit(db, {
      action:
        data.intent === "fulfil"
          ? "Promise Fulfilled"
          : data.intent === "extend"
            ? "Extension Recommended"
            : data.intent === "correction"
              ? "Correction Requested"
              : "Promise Escalated",
      category: data.intent === "escalate" ? "escalation" : "decision",
      details: data.note || `Promise ${data.code} — ${data.intent}`,
      target: data.code,
      status: data.intent === "escalate" ? "forwarded" : "completed",
    });
    return { ok: true };
  });

/* ---------------- Licenses & domains ---------------- */

export const updateLicense = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        user_code: z.string().min(1),
        intent: z.enum(["renew", "upgrade", "lock_domain", "unlock_domain", "request_transfer"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error: readError } = await db
      .from("pm_licenses")
      .select("expiry, license_type, domain, domain_status, transfer_status")
      .eq("id", data.id)
      .maybeSingle();
    fail("Could not load the license", readError);
    if (!row) throw new Error("License record not found");

    const patch: { expiry?: string; domain_status?: string; transfer_status?: string } = {};
    let action = "";
    let details = "";
    let status: AuditInput["status"] = "completed";

    if (data.intent === "renew") {
      const base = new Date(row.expiry);
      const from = Number.isNaN(base.getTime()) || base < new Date() ? new Date() : base;
      const next = new Date(from);
      next.setFullYear(next.getFullYear() + 1);
      patch.expiry = next.toISOString().slice(0, 10);
      action = "License Renewed";
      details = `${row.license_type} licence for ${data.user_code} renewed until ${patch.expiry}`;
    } else if (data.intent === "upgrade") {
      action = "License Upgrade Recommended";
      details = `Upgrade from ${row.license_type} to Enterprise recommended for ${data.user_code}`;
      status = "forwarded";
    } else if (data.intent === "lock_domain" || data.intent === "unlock_domain") {
      const locked = data.intent === "lock_domain";
      patch.domain_status = locked ? "locked" : "verified";
      action = locked ? "Domain Locked" : "Domain Unlocked";
      details = `${row.domain} ${locked ? "locked" : "unlocked"} for ${data.user_code}`;
    } else {
      patch.transfer_status = "requested";
      action = "Domain Transfer Requested";
      details = `Transfer/rebind requested for ${row.domain} (${data.user_code}) — requires higher approval`;
      status = "forwarded";
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await db.from("pm_licenses").update(patch).eq("id", data.id);
      fail("Could not update the license", error);
    }

    await writeAudit(db, { action, category: "decision", details, target: data.user_code, status });
    return { ok: true };
  });

/* ---------------- Upgrades ---------------- */

export const updateUpgrade = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        status: z.enum(["pending", "recommended", "approved", "rejected"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("pm_upgrades")
      .update({ status: data.status })
      .eq("id", data.id);
    fail("Could not update the upgrade request", error);
    await writeAudit(db, {
      action: `Upgrade ${data.status}`,
      category: "decision",
      details: `Upgrade ${data.code} marked ${data.status}`,
      target: data.code,
      status: data.status === "recommended" ? "forwarded" : "completed",
    });
    return { ok: true };
  });

/* ---------------- Renewals ---------------- */

export const updateRenewal = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        intent: z.enum(["notify", "extend_grace", "suspend"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    if (data.intent === "extend_grace") {
      const { error } = await db
        .from("pm_renewals")
        .update({ grace: "14 days", status: "grace" })
        .eq("id", data.id);
      fail("Could not extend the grace period", error);
    }
    if (data.intent === "suspend") {
      const { error } = await db
        .from("pm_renewals")
        .update({ status: "suspended" })
        .eq("id", data.id);
      fail("Could not suspend the renewal", error);
    }
    if (data.intent === "notify") {
      await db.from("pm_communication_logs").insert({
        code: `LOG-${Date.now().toString().slice(-6)}`,
        type: "chat",
        user_code: data.code,
        content: `Renewal reminder sent for ${data.code}`,
      });
    }
    await writeAudit(db, {
      action:
        data.intent === "notify"
          ? "Renewal Reminder Sent"
          : data.intent === "extend_grace"
            ? "Grace Period Extended"
            : "Auto Suspend Applied",
      category: "decision",
      details: `Renewal ${data.code} — ${data.intent}`,
      target: data.code,
    });
    return { ok: true };
  });

/* ---------------- Alerts ---------------- */

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), code: z.string().min(1) }).parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("pm_alerts").update({ acknowledged: true }).eq("id", data.id);
    fail("Could not acknowledge the alert", error);
    await writeAudit(db, {
      action: "Alert Acknowledged",
      category: "escalation",
      details: `Alert ${data.code} acknowledged`,
      target: data.code,
    });
    return { ok: true };
  });

/* ---------------- Escalations ---------------- */

export const resolveEscalation = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        note: z.string().min(3, "A decision note is mandatory").max(1000),
        intent: z.enum(["resolve", "forward", "review"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const status =
      data.intent === "resolve"
        ? "resolved"
        : data.intent === "forward"
          ? "forwarded"
          : "in_review";
    const { error } = await db
      .from("pm_escalations")
      .update({ status, decision_note: data.note })
      .eq("id", data.id);
    fail("Could not update the escalation", error);
    await writeAudit(db, {
      action: data.intent === "forward" ? "Escalation Forwarded" : "Escalation Resolved",
      category: "escalation",
      details: data.note,
      target: data.code,
      status: data.intent === "forward" ? "forwarded" : "completed",
    });
    return { ok: true };
  });

/* ---------------- Quality alerts ---------------- */

export const updateQualityAlert = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        intent: z.enum(["acknowledge", "escalate"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("pm_quality_alerts")
      .update({ acknowledged: true })
      .eq("id", data.id);
    fail("Could not update the quality alert", error);
    if (data.intent === "escalate") {
      await db.from("pm_escalations").insert({
        code: `ESC-${Date.now().toString().slice(-6)}`,
        source: "dev_manager",
        source_id: data.code,
        subject: `AI quality alert ${data.code} escalated`,
        description: "Escalated from the AI quality alert board for human review.",
        priority: "high",
        status: "pending",
        created_by: "PRO-MANAGER",
      });
    }
    await writeAudit(db, {
      action: data.intent === "escalate" ? "AI Alert Escalated" : "AI Alert Acknowledged",
      category: "ai_review",
      details: `Quality alert ${data.code} ${data.intent}d`,
      target: data.code,
      status: data.intent === "escalate" ? "forwarded" : "completed",
    });
    return { ok: true };
  });

/* ---------------- Decisions ---------------- */

export const decideRequest = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        intent: z.enum(["approve", "reject", "forward"]),
        isFinancial: z.boolean().default(false),
        note: z.string().max(1000).default(""),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    if (data.intent !== "approve" && data.note.trim().length < 3) {
      throw new Error("A written reason is mandatory for this action");
    }
    const db = await admin();
    // Financial decisions are never applied here — the Pro Manager may only recommend.
    const status =
      data.intent === "approve"
        ? data.isFinancial
          ? "recommended"
          : "approved"
        : data.intent === "reject"
          ? "rejected"
          : "forwarded";
    const { error } = await db
      .from("pm_decisions")
      .update({ status, decision_note: data.note })
      .eq("id", data.id);
    fail("Could not record the decision", error);
    await writeAudit(db, {
      action:
        data.isFinancial && data.intent === "approve"
          ? "Financial Recommendation"
          : data.intent === "approve"
            ? "Exception Approved"
            : data.intent === "reject"
              ? "Decision Rejected"
              : "Decision Forwarded",
      category: "decision",
      details: data.note || `Decision ${data.code} ${status}`,
      target: data.code,
      status: status === "approved" || status === "rejected" ? "completed" : "forwarded",
    });
    return { ok: true, status };
  });

/* ---------------- Settings ---------------- */

export const toggleSetting = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z.object({ key: z.string().min(1), enabled: z.boolean() }).parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: current, error: readError } = await db
      .from("pm_settings")
      .select("locked,label")
      .eq("key", data.key)
      .single();
    fail("Setting not found", readError);
    if (current?.locked)
      throw new Error("This setting is locked and requires higher authorization");
    const { error } = await db
      .from("pm_settings")
      .update({ enabled: data.enabled, updated_at: new Date().toISOString() })
      .eq("key", data.key);
    fail("Could not update the setting", error);
    await writeAudit(db, {
      action: "Setting Updated",
      category: "system",
      details: `${current?.label} turned ${data.enabled ? "on" : "off"}`,
      target: data.key,
    });
    return { ok: true };
  });

/* ---------------- Reports ---------------- */

export const generateReport = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        type: z.enum(["daily", "weekly", "monthly", "custom"]),
        name: z.string().min(3).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const [{ count: escalations }, { count: decisions }, { count: promises }] = await Promise.all([
      db.from("pm_escalations").select("*", { count: "exact", head: true }),
      db.from("pm_decisions").select("*", { count: "exact", head: true }),
      db.from("pm_promises").select("*", { count: "exact", head: true }),
    ]);
    const rows = (escalations ?? 0) + (decisions ?? 0) + (promises ?? 0);
    const code = `RPT-${Date.now().toString().slice(-6)}`;
    const { data: row, error } = await db
      .from("pm_reports")
      .insert({ code, name: data.name, type: data.type, size: `${(rows * 0.12).toFixed(1)} MB` })
      .select()
      .single();
    fail("Could not generate the report", error);
    await writeAudit(db, {
      action: "Report Generated",
      category: "system",
      details: `${data.name} (${data.type})`,
      target: code,
    });
    return row;
  });

export const exportAuditTrail = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).default(200) }).parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: rows, error } = await db
      .from("pm_audit_logs")
      .select("created_at,action,category,actor,target,status,details")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    fail("Could not export the audit trail", error);
    const header = "timestamp,action,category,actor,target,status,details";
    const csv = [header]
      .concat(
        (rows ?? []).map((r) =>
          [r.created_at, r.action, r.category, r.actor, r.target, r.status, r.details]
            .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      )
      .join("\n");
    return { csv, rows: rows?.length ?? 0 };
  });

/* ---------------- Satisfaction ---------------- */

export const saveSatisfactionPrediction = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        user_code: z.string().min(1),
        prediction: z.string().min(3).max(4000),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("pm_satisfaction")
      .update({ ai_prediction: data.prediction })
      .eq("id", data.id);
    fail("Could not save the AI prediction", error);
    await writeAudit(db, {
      action: "AI Risk Prediction Saved",
      category: "ai_review",
      details: `Churn risk prediction refreshed for ${data.user_code}`,
      target: data.user_code,
    });
    return { ok: true };
  });

/* ---------------- AI helpdesk conversations ---------------- */

export const startConversation = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        user_code: z.string().min(1),
        topic: z.string().min(3).max(160),
        language: z.string().min(2).max(40).default("English"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const code = `AI-${Date.now().toString().slice(-6)}`;
    const { data: row, error } = await db
      .from("pm_ai_conversations")
      .insert({ ...data, code, status: "active", resolution: "In Progress" })
      .select()
      .single();
    fail("Could not start the conversation", error);
    await writeAudit(db, {
      action: "AI Conversation Started",
      category: "ai_review",
      details: `${data.topic} (${data.language})`,
      target: code,
    });
    return row;
  });

export const updateConversation = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        code: z.string().min(1),
        intent: z.enum(["auto_resolve", "create_ticket", "escalate"]),
        user_code: z.string().min(1),
        topic: z.string().min(1),
        product: z.string().default("Enterprise Suite"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    if (data.intent === "auto_resolve") {
      const { error } = await db
        .from("pm_ai_conversations")
        .update({ status: "resolved", resolution: "Auto-Resolved" })
        .eq("id", data.id);
      fail("Could not resolve the conversation", error);
    }
    if (data.intent === "create_ticket" || data.intent === "escalate") {
      const ticketCode = `TKT-${Date.now().toString().slice(-6)}`;
      await db.from("pm_tickets").insert({
        code: ticketCode,
        user_code: data.user_code,
        type: "Technical",
        severity: data.intent === "escalate" ? "High" : "Medium",
        product: data.product,
        subject: data.topic,
        status: data.intent === "escalate" ? "escalated" : "new",
      });
      const { error } = await db
        .from("pm_ai_conversations")
        .update({
          status: data.intent === "escalate" ? "escalated" : "active",
          resolution: "Ticket Created",
        })
        .eq("id", data.id);
      fail("Could not update the conversation", error);
    }
    await writeAudit(db, {
      action:
        data.intent === "auto_resolve"
          ? "AI Auto-Resolution"
          : data.intent === "escalate"
            ? "AI Conversation Escalated"
            : "Ticket Created From AI Chat",
      category: "ai_review",
      details: data.topic,
      target: data.code,
      status: data.intent === "escalate" ? "forwarded" : "completed",
    });
    return { ok: true };
  });

export const sendHelpdeskMessage = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((i: unknown) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        code: z.string().min(1),
        message: z.string().min(1).max(4000),
        language: z.string().min(2).max(40).default("English"),
        topic: z.string().default(""),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error: insertError } = await db
      .from("pm_ai_messages")
      .insert({ conversation_id: data.conversation_id, role: "user", content: data.message });
    fail("Could not save the message", insertError);

    const { data: history } = await db
      .from("pm_ai_messages")
      .select("role,content")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true })
      .limit(20);

    const { runProManagerAI } = await import("./pm-ai.server");
    const reply = await runProManagerAI("helpdesk_reply", {
      message: data.message,
      language: data.language,
      topic: data.topic,
      history: (history ?? []).map((m) => `${m.role}: ${m.content}`).join("\n"),
    });

    const { error: replyError } = await db
      .from("pm_ai_messages")
      .insert({ conversation_id: data.conversation_id, role: "assistant", content: reply });
    fail("Could not save the AI reply", replyError);

    await db.from("pm_communication_logs").insert({
      code: `LOG-${Date.now().toString().slice(-6)}`,
      type: "ai",
      user_code: data.code,
      content: `AI helpdesk exchange on ${data.topic || "support"}`,
    });

    return { reply };
  });

export const _idSchema = id;
