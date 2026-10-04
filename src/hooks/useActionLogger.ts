/**
 * ACTION LOGGER HOOK
 * Universal button action logging for Software Vala Enterprise Platform
 * Every button click = 1 DB action minimum
 *
 * DEBUG FIX: Enhanced with retry logic, fail-safe, and complete traceability
 *
 * Actions are recorded in audit_logs. There is no action_logs table, and
 * audit_logs is not writable from the browser, so entries go through the
 * recordAuditEvent server function, which records the signed-in user as the
 * actor from their verified token rather than from anything the page sends.
 */
import { useCallback } from "react";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AUDIT_SEVERITIES = ["info", "low", "medium", "high", "warning", "critical"] as const;

export interface AuditEventInput {
  action: string;
  entityType: string;
  entityId?: string | null | undefined;
  severity?: (typeof AUDIT_SEVERITIES)[number] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/** Writes one audit_logs row for the signed-in user. Throws when it was not written. */
export const recordAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AuditEventInput) => {
    const text = (value: unknown, field: string, max: number) => {
      if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
      return value.trim().slice(0, max);
    };
    return {
      action: text(input?.action, "action", 200),
      entityType: text(input?.entityType, "entityType", 100),
      entityId: input?.entityId ? String(input.entityId).slice(0, 200) : null,
      severity: AUDIT_SEVERITIES.includes(input?.severity as never) ? input.severity! : "info",
      metadata: (() => {
        const metadata =
          input?.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
            ? input.metadata
            : {};
        // Any signed-in account can write here with the service key, so the
        // free-form part is bounded rather than stored at whatever size arrives.
        if (JSON.stringify(metadata).length > 16_000) throw new Error("metadata is too large");
        return metadata;
      })(),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = (context.claims as { email?: string } | undefined)?.email;
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor: email ?? context.userId,
      action: data.action,
      entity_type: data.entityType,
      entity_id: data.entityId,
      severity: data.severity,
      metadata: { ...data.metadata, actor_user_id: context.userId, source: "client" } as never,
    });
    if (error) throw new Error(`Audit log write failed: ${error.message}`);
    return { ok: true as const };
  });

/** The audit_logs entry for a button action: the module is the entity type. */
function buttonActionEvent(params: {
  buttonId: string;
  moduleName: string;
  actionType: ActionType;
  actionResult: ActionResult;
  responseTimeMs?: number | null | undefined;
  errorMessage?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
}): AuditEventInput {
  return {
    action: `${params.moduleName}.${params.actionType.toLowerCase()}`,
    entityType: params.moduleName,
    severity: params.actionResult === "failure" ? "warning" : "info",
    metadata: {
      ...(params.metadata ?? {}),
      button_id: params.buttonId,
      action_type: params.actionType,
      action_result: params.actionResult,
      response_time_ms: params.responseTimeMs ?? null,
      error_message: params.errorMessage ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    },
  };
}

export type ActionType = "CREATE" | "READ" | "UPDATE" | "DELETE" | "PROCESS" | "NAVIGATE";
export type ActionResult = "success" | "failure" | "retry" | "blocked";

interface LogActionParams {
  buttonId: string;
  moduleName: string;
  actionType: ActionType;
  actionResult: ActionResult;
  responseTimeMs?: number | undefined;
  errorMessage?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

interface UseActionLoggerReturn {
  logAction: (params: LogActionParams) => Promise<void>;
  logButtonClick: (
    buttonId: string,
    moduleName: string,
    actionType: ActionType,
  ) => () => Promise<{
    complete: (result: ActionResult, error?: string) => Promise<void>;
    startTime: number;
  }>;
}

export function useActionLogger(): UseActionLoggerReturn {
  const logAction = useCallback(async (params: LogActionParams) => {
    const maxRetries = 2;
    let retryCount = 0;

    const attemptLog = async (): Promise<void> => {
      try {
        await recordAuditEvent({ data: buttonActionEvent(params) });
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          // Retry with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, retryCount * 100));
          return attemptLog();
        }
        // Never break the app, but never fail silently either.
        console.error("[ActionLogger] Failed to log action after retries:", error);
        const { toast } = await import("@/hooks/use-toast");
        toast({
          title: "Audit log failed",
          description: `Action "${params.buttonId}" could not be recorded.`,
          variant: "destructive",
        });
      }
    };

    await attemptLog();
  }, []);

  const logButtonClick = useCallback(
    (buttonId: string, moduleName: string, actionType: ActionType) => {
      return async () => {
        const startTime = performance.now();

        return {
          startTime,
          complete: async (result: ActionResult, error?: string) => {
            const responseTimeMs = Math.round(performance.now() - startTime);
            await logAction({
              buttonId,
              moduleName,
              actionType,
              actionResult: result,
              responseTimeMs,
              errorMessage: error,
            });
          },
        };
      };
    },
    [logAction],
  );

  return { logAction, logButtonClick };
}

/**
 * Higher-order function to wrap any button action with logging
 * DEBUG FIX: Added proper error handling and retry logic
 */
export function withActionLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  buttonId: string,
  moduleName: string,
  actionType: ActionType,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const startTime = performance.now();
    let result: ActionResult = "success";
    let errorMessage: string | undefined;

    try {
      const response = await fn(...args);
      return response as ReturnType<T>;
    } catch (error) {
      result = "failure";
      errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw error;
    } finally {
      const responseTimeMs = Math.round(performance.now() - startTime);

      // Log asynchronously without blocking - with retry
      const logWithRetry = async (retries = 2) => {
        try {
          await recordAuditEvent({
            data: buttonActionEvent({
              buttonId,
              moduleName,
              actionType,
              actionResult: result,
              responseTimeMs,
              errorMessage,
            }),
          });
        } catch (err) {
          if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return logWithRetry(retries - 1);
          }
          console.error("[ActionLogger] HOF logging failed:", err);
        }
      };

      logWithRetry();
    }
  };
}

export default useActionLogger;
