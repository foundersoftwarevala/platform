import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { CycleResult } from "./cycle.server";

/**
 * Morning AI's API.
 *
 * Running the day and closing it are both executive acts, so both are checked
 * on the server against the same auth service and role table the rest of
 * Founder AI uses. Reading the day is checked the same way: the plan names
 * what the company is worried about, which is not something to hand to
 * anyone who asks.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

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

export interface PlanItem {
  id: string;
  title: string;
  domain: string;
  severity: string;
  position: number;
  priorityScore: number;
  priorityReason: string;
  suggestedAgentId: string | null;
  suggestedAgentName: string | null;
  allocationReason: string | null;
  state: string;
  verification: string;
}

export interface DayView {
  cycleId: string | null;
  cycleDate: string | null;
  state: string | null;
  plannedItems: number;
  escalations: number;
  completed: number;
  verified: number;
  waitingApproval: number;
  failed: number;
  items: PlanItem[];
  briefFindings: string[];
  briefLimitations: string[];
  insufficientData: boolean;
  degraded: string[];
}

/** Run the day: analyse, brief, prioritise, plan, allocate. */
export const runFounderMorningCycle = createServerFn({ method: "POST" }).handler(
  async (): Promise<CycleResult> => {
    const userId = await requireExecutive();
    const { runMorningCycle } = await import("./cycle.server");
    return runMorningCycle(userId);
  },
);

/** Close the day and write the close report. */
export const closeFounderMorningCycle = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ cycleId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<CycleResult> => {
    const userId = await requireExecutive();
    const { closeMorningCycle } = await import("./cycle.server");
    return closeMorningCycle(data.cycleId, userId);
  });

/** Today's cycle as a screen reads it, or an empty day if none has run. */
export const loadFounderDay = createServerFn({ method: "GET" }).handler(
  async (): Promise<DayView> => {
    await requireExecutive();
    const { loadDay } = await import("./day.server");
    return loadDay();
  },
);
