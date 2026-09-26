import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { SignalOutcome } from "./signals.server";

/**
 * The way into the monitoring pipeline.
 *
 * A Monitoring Agent raises a signal here and Founder AI decides what it
 * earns — nothing, the dashboard, the attention queue, an alert, or an alert
 * with an escalation and a governed decision. The caller states what it saw;
 * it does not get to say what should happen about it.
 *
 * Authorization is checked on the server, against the same auth service and
 * the same role table the rest of Founder AI uses. There is no agent-only
 * back door: a signal arriving without a session is refused like anything
 * else.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** The signed-in caller, and the roles they actually hold. */
async function requireExecutive(): Promise<string> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Sign-in required");

  const url = process.env["SUPABASE_URL"]?.trim();
  const publishable =
    process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? process.env["SUPABASE_ANON_KEY"]?.trim();
  if (!url || !publishable) throw new Error("Authentication is not configured");

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Sign-in required");
  const user = (await response.json()) as { id?: string };
  if (!user?.id) throw new Error("Sign-in required");

  const db = await admin();
  const [{ data: isBoss }, { data: isAdmin }] = await Promise.all([
    db.rpc("has_role", { _user_id: user.id, _role: "boss" }),
    db.rpc("has_role", { _user_id: user.id, _role: "admin" }),
  ]);
  if (!isBoss && !isAdmin) throw new Error("Executive permission required");
  return user.id;
}

export const ingestFounderSignal = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        agentKey: z.string().min(2).max(80),
        kind: z.string().min(2).max(80),
        domain: z.string().min(2).max(60),
        title: z.string().min(3).max(300),
        reason: z.string().min(3).max(2000),
        severity: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        sourceSystem: z.string().min(2).max(120),
        sourceRef: z.string().min(2).max(200),
        entityType: z.string().max(80).optional(),
        entityId: z.string().max(120).optional(),
        occurredAt: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<SignalOutcome> => {
    await requireExecutive();
    const { routeSignal } = await import("./signals.server");
    return routeSignal({
      agentKey: data.agentKey,
      kind: data.kind,
      domain: data.domain,
      title: data.title,
      reason: data.reason,
      severity: data.severity,
      sourceSystem: data.sourceSystem,
      sourceRef: data.sourceRef,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      occurredAt: data.occurredAt,
      // Evidence is not accepted over this boundary yet: what an agent read
      // belongs with the agent run, and inventing a shape for it here would
      // be a second place to keep it.
      evidence: {},
    });
  });

/** The ladder, so a screen can show what each severity earns. */
export const loadFounderSignalRoutes = createServerFn({ method: "GET" }).handler(async () => {
  await requireExecutive();
  const { loadRoutes } = await import("./signals.server");
  return [...(await loadRoutes()).values()];
});
