import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { Memory, MemoryScope, MemoryTotals } from "./memory.server";

/**
 * The memory API.
 *
 * Reading memory is an executive act: it is what the company believes about
 * itself, which is not something to hand to anyone who asks. Writing one is
 * more so, because a memory recorded here becomes the context later decisions
 * are made against.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireExecutive(): Promise<{ id: string; roles: string[] }> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Sign-in required");

  const url = process.env["SUPABASE_URL"]?.trim();
  const publishable =
    process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? process.env["SUPABASE_ANON_KEY"]?.trim();
  const service = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !publishable || !service) throw new Error("Authentication is not configured");

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

  const rolesResponse = await fetch(
    `${url}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } },
  );
  const roles = rolesResponse.ok
    ? ((await rolesResponse.json()) as { role?: string }[])
        .map((r) =>
          String(r.role ?? "")
            .toLowerCase()
            .trim(),
        )
        .filter(Boolean)
    : [];

  return { id: user.id, roles };
}

const SCOPES = [
  "FOUNDER",
  "COMPANY",
  "OPERATIONAL",
  "CONVERSATION",
  "DECISION",
  "LEARNING",
  "WORKING",
] as const;

export const loadFounderMemory = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        scope: z.enum(SCOPES).optional(),
        search: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(
    async ({
      data,
    }): Promise<{ memories: Memory[]; totals: MemoryTotals | null; degraded: string[] }> => {
      const caller = await requireExecutive();
      const { currentMemory, memoryTotals } = await import("./memory.server");
      const [current, totals] = await Promise.all([
        currentMemory(caller.roles, {
          scope: data.scope as MemoryScope | undefined,
          search: data.search,
          limit: data.limit,
        }),
        memoryTotals(),
      ]);
      return { memories: current.memories, totals, degraded: current.degraded };
    },
  );

/** How a belief about one subject changed, and why. */
export const loadFounderMemoryHistory = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ scope: z.enum(SCOPES), subject: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ history: Memory[]; degraded: string[] }> => {
    const caller = await requireExecutive();
    const { memoryHistory } = await import("./memory.server");
    return memoryHistory(caller.roles, data.scope as MemoryScope, data.subject);
  });

export const recordFounderMemory = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        scope: z.enum(SCOPES),
        subject: z.string().min(2).max(200),
        statement: z.string().min(3).max(2000),
        detail: z.string().max(8000).optional(),
        sourceSystem: z.string().min(2).max(120),
        sourceRef: z.string().max(300).optional(),
        confidence: z.enum(["MEASURED", "ESTIMATED", "STALE", "UNKNOWN"]).optional(),
        verifiedAt: z.string().max(40).optional(),
        validUntil: z.string().max(40).optional(),
        allowedRoles: z.array(z.string().max(40)).max(20).optional(),
        supersedeReason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<{ ok: boolean; memoryId?: string; replaced?: boolean; error?: string }> => {
      const caller = await requireExecutive();
      const { recordMemory } = await import("./memory.server");
      const result = await recordMemory({
        ...data,
        confidence: data.confidence as never,
        recordedBy: caller.id,
      });
      return result.ok
        ? { ok: true, memoryId: result.memoryId, replaced: result.replaced }
        : { ok: false, error: result.reason };
    },
  );

export const retractFounderMemory = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ memoryId: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const caller = await requireExecutive();
    const { retractMemory } = await import("./memory.server");
    const result = await retractMemory(data.memoryId, data.reason, caller.id);
    return result.ok ? { ok: true } : { ok: false, error: result.reason };
  });
