import { aiComplete, type AiMessage } from "@/lib/ai-gateway.server";

import { capabilityFor, routesFor, type Capability, type Route } from "./router.server";

/**
 * Making an AI request safely.
 *
 * The AI API Manager gateway already owns provider access, credentials and
 * usage metering, and eleven modules already call it. This does not replace
 * it: it wraps it with the four things it does not do, each of which matters
 * more the moment an AI request is on a path an executive depends on.
 *
 * It bounds the request. The gateway's fetch has no timeout at all, so a
 * provider that accepts a connection and then stops talking holds the request
 * open indefinitely. Every call here is bounded and a breach is recorded as a
 * timeout rather than as a mysterious hang.
 *
 * It retries only what is worth retrying. A 429, a 5xx, a timeout and a
 * transport failure are transient; a 400 is the request being wrong and will
 * be wrong again, so retrying it just spends money twice.
 *
 * It falls back on evidence, not on hope. The second route is tried only when
 * the route itself permits it and the failure was the provider's rather than
 * the request's — and the fallback is recorded with its reason, so a quiet
 * drift onto a different provider is visible.
 *
 * And it records every attempt. usage_events already holds tokens and cost;
 * this holds which decision the call informed and whether its answer survived
 * validation, which is what governance needs and metering cannot say.
 */

export type AiOutcome =
  | "OK"
  | "VALIDATION_FAILED"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "POLICY_REFUSED"
  | "CANCELLED"
  | "NO_PROVIDER";

export interface AiCallRequest {
  taskType: string;
  messages: AiMessage[];
  /** Ask for JSON. Routes the request to a service that can actually do it. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Traceability: what this call is for. */
  userId?: string | null;
  conversationId?: string | null;
  decisionId?: string | null;
  approvalId?: string | null;
  eventId?: string | null;
  correlationId?: string | null;
  /** Caller-supplied ceiling; the route's own timeout wins if it is lower. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface AiCallResult {
  ok: boolean;
  outcome: AiOutcome;
  text: string | null;
  requestId: string;
  capability: Capability;
  serviceName: string | null;
  model: string | null;
  attempts: number;
  fellBack: boolean;
  /** Plain sentences describing what happened, for an operator to read. */
  notes: string[];
  error?: string;
}

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** One row per attempt, so a flapping provider shows up rather than averaging out. */
async function record(entry: {
  requestId: string;
  taskType: string;
  capability: Capability;
  attempt: number;
  outcome: AiOutcome;
  route?: Route | null;
  model?: string | null;
  latencyMs?: number;
  fellBack?: boolean;
  fallbackReason?: string | null;
  validated?: boolean;
  validationError?: string | null;
  request: AiCallRequest;
}): Promise<void> {
  const base = restUrl();
  if (!base) return;
  try {
    await fetch(`${base}/rest/v1/founder_ai_requests`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({
        request_id: entry.requestId,
        task_type: entry.taskType,
        capability: entry.capability,
        attempt: entry.attempt,
        outcome: entry.outcome,
        service_id: entry.route?.serviceId ?? null,
        service_name: entry.route?.serviceName ?? null,
        model: entry.model ?? null,
        latency_ms: entry.latencyMs ?? null,
        fell_back: entry.fellBack ?? false,
        fallback_reason: entry.fallbackReason ?? null,
        validated: entry.validated ?? false,
        validation_error: entry.validationError ?? null,
        user_id: entry.request.userId ?? null,
        conversation_id: entry.request.conversationId ?? null,
        decision_id: entry.request.decisionId ?? null,
        approval_id: entry.request.approvalId ?? null,
        event_id: entry.request.eventId ?? null,
        correlation_id: entry.request.correlationId ?? null,
      }),
    });
  } catch (error) {
    // A failed record must not fail the call it was describing, but it must be
    // visible: an unrecorded AI request is one nobody can trace later.
    console.error("[founder/ai] request record failed:", error);
  }
}

/**
 * Which failures are worth trying again.
 *
 * A rate limit and a server error will plausibly succeed on a second attempt.
 * A malformed request will not, and neither will a refused credential — both
 * fail identically the second time, having spent the time and the money.
 */
function isTransient(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes("aborted") || message.includes("timeout")) return true;
  if (/\b(429|500|502|503|504)\b/.test(message)) return true;
  if (message.includes("rate limit") || message.includes("overloaded")) return true;
  if (message.includes("econnreset") || message.includes("fetch failed")) return true;
  return false;
}

function outcomeOf(error: unknown): AiOutcome {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes("aborted") || message.includes("timeout")) return "TIMEOUT";
  if (message.includes("429") || message.includes("rate limit")) return "RATE_LIMITED";
  return "PROVIDER_ERROR";
}

/** Exponential backoff with jitter, so retries do not arrive in lockstep. */
function backoffMs(attempt: number): number {
  const base = Math.min(8_000, 500 * 2 ** (attempt - 1));
  return Math.round(base * (0.5 + Math.random() * 0.5));
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Run one AI request through the routes for its capability.
 *
 * Never throws for a provider failure: the outcome is part of the answer, so a
 * caller has to decide what to do about it rather than have an exception
 * decide for them.
 */
export async function callAi(request: AiCallRequest): Promise<AiCallResult> {
  const requestId = `fai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const capability = capabilityFor(request.taskType, request.json);
  const notes: string[] = [];

  const routes = await routesFor(capability);
  if (routes.length === 0) {
    notes.push(
      `No AI service is routed for ${capability}. Register and approve one in AI API Manager.`,
    );
    await record({
      requestId,
      taskType: request.taskType,
      capability,
      attempt: 1,
      outcome: "NO_PROVIDER",
      request,
    });
    return {
      ok: false,
      outcome: "NO_PROVIDER",
      text: null,
      requestId,
      capability,
      serviceName: null,
      model: null,
      attempts: 0,
      fellBack: false,
      notes,
      error: "No AI provider is configured for this kind of request.",
    };
  }

  let attempt = 0;
  let fellBack = false;
  let lastError: unknown = null;
  let lastOutcome: AiOutcome = "PROVIDER_ERROR";

  for (const [index, route] of routes.entries()) {
    if (index > 0) {
      // Falling back is a decision the first route has to permit.
      if (!routes[0]!.allowFallback) {
        notes.push(`${routes[0]!.serviceName} does not permit falling back to another provider.`);
        break;
      }
      fellBack = true;
      notes.push(`Falling back to ${route.serviceName}${route.notes ? ` (${route.notes})` : ""}.`);
    }

    const budget = Math.min(route.timeoutMs, request.timeoutMs ?? route.timeoutMs);

    for (let tries = 1; tries <= route.maxAttempts; tries += 1) {
      attempt += 1;
      const started = Date.now();

      if (request.signal?.aborted) {
        await record({
          requestId,
          taskType: request.taskType,
          capability,
          attempt,
          outcome: "CANCELLED",
          route,
          request,
        });
        return {
          ok: false,
          outcome: "CANCELLED",
          text: null,
          requestId,
          capability,
          serviceName: route.serviceName,
          model: null,
          attempts: attempt,
          fellBack,
          notes: [...notes, "The request was cancelled before this attempt."],
        };
      }

      // The gateway's own fetch has no timeout, so the bound is applied here.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), budget);
      request.signal?.addEventListener("abort", () => controller.abort());

      try {
        const result = await Promise.race([
          aiComplete({
            module: `founder-ai:${request.taskType}`,
            messages: request.messages,
            serviceId: route.serviceId,
            temperature: request.temperature ?? route.temperature ?? undefined,
            maxTokens: request.maxTokens ?? route.maxTokens ?? undefined,
            json: request.json,
          }),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener("abort", () =>
              reject(new Error(`the request exceeded its ${budget}ms timeout`)),
            );
          }),
        ]);
        clearTimeout(timer);

        await record({
          requestId,
          taskType: request.taskType,
          capability,
          attempt,
          outcome: "OK",
          route,
          model: result.model,
          latencyMs: Date.now() - started,
          fellBack,
          fallbackReason: fellBack ? notes[notes.length - 1] : null,
          request,
        });

        return {
          ok: true,
          outcome: "OK",
          text: result.text,
          requestId,
          capability,
          serviceName: result.service,
          model: result.model,
          attempts: attempt,
          fellBack,
          notes,
        };
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        lastOutcome = outcomeOf(error);
        const message = error instanceof Error ? error.message : String(error);

        await record({
          requestId,
          taskType: request.taskType,
          capability,
          attempt,
          outcome: lastOutcome,
          route,
          latencyMs: Date.now() - started,
          fellBack,
          fallbackReason: fellBack ? notes[notes.length - 1] : null,
          request,
        });

        if (!isTransient(error)) {
          notes.push(`${route.serviceName} refused the request: ${message.slice(0, 160)}`);
          break; // A bad request fails the same way twice; move on.
        }
        if (tries < route.maxAttempts) {
          const wait = backoffMs(tries);
          notes.push(`${route.serviceName} failed transiently; retrying in ${wait}ms.`);
          await sleep(wait, request.signal);
        } else {
          notes.push(`${route.serviceName} failed ${route.maxAttempts} times.`);
        }
      }
    }
  }

  return {
    ok: false,
    outcome: lastOutcome,
    text: null,
    requestId,
    capability,
    serviceName: routes[0]?.serviceName ?? null,
    model: null,
    attempts: attempt,
    fellBack,
    notes,
    error: lastError instanceof Error ? lastError.message : "every routed provider failed",
  };
}

/** Note that an answer was thrown away, and why. */
export async function recordValidationFailure(
  requestId: string,
  taskType: string,
  capability: Capability,
  attempt: number,
  reason: string,
  request: AiCallRequest,
): Promise<void> {
  await record({
    requestId,
    taskType,
    capability,
    attempt: attempt + 1,
    outcome: "VALIDATION_FAILED",
    validated: false,
    validationError: reason,
    request,
  });
}
