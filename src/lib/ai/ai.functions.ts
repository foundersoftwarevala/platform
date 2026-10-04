import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/*
 * Vala AI workspace server functions.
 *
 * This module used to read and write ten tables (ai_projects, ai_logs,
 * ai_credits, ai_credit_transactions, ai_issues, ai_settings, ai_snapshots,
 * ai_lock_state, ai_execution_logs, and a prompt history in ai_prompts) that
 * were never created on this database, with the publishable key and no caller
 * check. Each screen now reads the store the platform already keeps for that
 * purpose - see vala-ai.server.ts for the mapping - and every function, read or
 * write, first requires an operator, because those stores are read with the
 * service-role key.
 *
 * Reads return { source, data, available, reason? }: source "postgres" is live
 * data (possibly empty), "unavailable" means the store could not be read and
 * says why. Writes throw when nothing was written.
 */

/**
 * The /vala-ai route admits platform operators and developers (RouteAccessGate),
 * so the workspace reads and command recording admit the same people. Changing
 * the write lock stays with operators only.
 */
async function operator(action: string, options: { operatorsOnly?: boolean } = {}) {
  const { requireOperator } = await import("@/lib/auth/require-operator.server");
  return requireOperator(action, options.operatorsOnly ? {} : { alsoAllow: ["developer"] });
}

async function server() {
  return import("./vala-ai.server");
}

export const getAiProjects = createServerFn({ method: "GET" }).handler(async () => {
  await operator("Vala AI");
  return {
    source: "unavailable" as const,
    data: [] as Record<string, unknown>[],
    available: false,
    reason: "Vala AI projects are not recorded anywhere on this platform yet.",
  };
});

export const getAiPrompts = createServerFn({ method: "GET" }).handler(async () => {
  const caller = await operator("Vala AI");
  return (await server()).readPromptHistory(caller);
});

export const getAiLogs = createServerFn({ method: "GET" }).handler(async () => {
  const caller = await operator("Vala AI");
  return (await server()).readExecutionLogs(caller);
});

export const getAiModels = createServerFn({ method: "GET" }).handler(async () => {
  await operator("Vala AI");
  return (await server()).readModels();
});

export const getAiCredits = createServerFn({ method: "GET" }).handler(async () => {
  await operator("Vala AI");
  return (await server()).readCredits();
});

export const getAiIssues = createServerFn({ method: "GET" }).handler(async () => {
  await operator("Vala AI");
  return (await server()).readIssues();
});

export const getAiSettings = createServerFn({ method: "GET" }).handler(async () => {
  await operator("Vala AI");
  return (await server()).readSettings();
});

export const getAiSnapshots = createServerFn({ method: "GET" }).handler(async () => {
  await operator("Vala AI");
  return (await server()).readSnapshots();
});

export const getAiLockState = createServerFn({ method: "GET" }).handler(async () => {
  await operator("Vala AI");
  return (await server()).readLock();
});

export const updateAiLockState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ locked: z.boolean(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const caller = await operator("Changing the Vala AI lock", { operatorsOnly: true });
    return (await server()).writeLock(caller, data.locked, data.reason);
  });

export const logAiExecution = createServerFn({ method: "POST" })
  .inputValidator((v) =>
    z
      .object({
        command: z.string().min(1).max(4_000),
        reply: z.string().max(8_000).nullable().optional(),
        status: z.enum(["success", "error", "warning"]),
        durationMs: z.number().int().nonnegative(),
        projectTitle: z.string().max(200).nullable().optional(),
      })
      .parse(v ?? {}),
  )
  .handler(async ({ data }) => {
    const caller = await operator("Recording a Vala AI command");
    const row = await (
      await server()
    ).recordCommand(caller, {
      command: data.command,
      reply: data.reply ?? null,
      status: data.status,
      durationMs: data.durationMs,
      projectTitle: data.projectTitle ?? null,
    });
    return { ok: true, data: row };
  });
