import type { z } from "zod";

import { callAi, recordValidationFailure, type AiCallRequest, type AiOutcome } from "./call.server";
import { assemble, scanForInjection, type AssembleOptions, type InjectionFinding } from "./prompt";

/**
 * Asking for structured output, and refusing to believe it on sight.
 *
 * A model asked for JSON returns JSON-shaped text, which is not the same
 * thing. It fences it in markdown, it adds a sentence before it, it invents a
 * field, it returns a confidence of 150, it labels an inference as a fact. So
 * the answer is parsed, validated against the schema, and only then used.
 *
 * One repair attempt is allowed, and only one. The model is told exactly what
 * was wrong and asked again; if the second answer is also invalid the request
 * fails with the reason. Retrying indefinitely against a model that has
 * misunderstood the shape spends money to arrive at the same place.
 *
 * Nothing is ever partially accepted. An answer that fails validation is
 * discarded whole, because the half that parsed is not more trustworthy than
 * the half that did not.
 */

export interface StructuredResult<T> {
  ok: boolean;
  data: T | null;
  outcome: AiOutcome;
  requestId: string;
  serviceName: string | null;
  model: string | null;
  attempts: number;
  fellBack: boolean;
  notes: string[];
  /** Anything in the context that tried to issue instructions. */
  injectionFindings: InjectionFinding[];
  error?: string;
}

/** Pull the JSON out of whatever the model wrapped it in. */
function extractJson(text: string): string {
  const trimmed = text.trim();

  // A fenced block is the most common wrapper.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) return fenced[1].trim();

  // Otherwise take the outermost braces, which survives a preamble sentence.
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);

  return trimmed;
}

function describe(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export interface StructuredRequest<T> extends Omit<AiCallRequest, "messages" | "json"> {
  // Input is unknown and output is T on purpose: a schema using .default()
  // has a different input type from its output, and a plain ZodType<T> would
  // make the two the same and reject it.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** The JSON shape shown to the model, from SHAPE_HINTS. */
  shapeHint: string;
  prompt: AssembleOptions;
}

export async function askStructured<T>(
  request: StructuredRequest<T>,
): Promise<StructuredResult<T>> {
  // What in the context is trying to give orders. This is reported rather than
  // stripped: removing text would change the record an operator is looking at,
  // and the presence of an instruction inside a customer record is itself
  // worth surfacing.
  const injectionFindings = scanForInjection(request.prompt.blocks);
  const notes: string[] = [];
  if (injectionFindings.length > 0) {
    notes.push(
      `${injectionFindings.length} piece(s) of context contain text shaped like instructions; they were passed as data.`,
    );
  }

  const instruction = [
    request.prompt.taskInstruction ?? "",
    "",
    "Reply with a single JSON object and nothing else. No prose, no markdown fence.",
    "Use exactly this shape:",
    request.shapeHint,
    "",
    "Where a value cannot be established from the context, use null rather than estimating it.",
    "Reference the context blocks by their id (CTX1, CTX2, …) in sourceRef.",
  ]
    .filter(Boolean)
    .join("\n");

  let messages = assemble({ ...request.prompt, taskInstruction: instruction });

  for (let round = 1; round <= 2; round += 1) {
    const result = await callAi({ ...request, messages, json: true });
    notes.push(...result.notes);

    if (!result.ok || !result.text) {
      return {
        ok: false,
        data: null,
        outcome: result.outcome,
        requestId: result.requestId,
        serviceName: result.serviceName,
        model: result.model,
        attempts: result.attempts,
        fellBack: result.fellBack,
        notes,
        injectionFindings,
        error: result.error ?? "the provider returned nothing",
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(result.text));
    } catch {
      const reason = "the answer was not valid JSON";
      await recordValidationFailure(
        result.requestId,
        request.taskType,
        result.capability,
        result.attempts,
        reason,
        { ...request, messages, json: true },
      );
      if (round === 1) {
        notes.push("The first answer was not valid JSON; asking again with the shape restated.");
        messages = assemble({
          ...request.prompt,
          taskInstruction: `${instruction}\n\nYour previous reply was not valid JSON. Return only the JSON object.`,
        });
        continue;
      }
      return {
        ok: false,
        data: null,
        outcome: "VALIDATION_FAILED",
        requestId: result.requestId,
        serviceName: result.serviceName,
        model: result.model,
        attempts: result.attempts,
        fellBack: result.fellBack,
        notes,
        injectionFindings,
        error: reason,
      };
    }

    const checked = request.schema.safeParse(parsed);
    if (checked.success) {
      return {
        ok: true,
        data: checked.data,
        outcome: "OK",
        requestId: result.requestId,
        serviceName: result.serviceName,
        model: result.model,
        attempts: result.attempts,
        fellBack: result.fellBack,
        notes,
        injectionFindings,
      };
    }

    const reason = describe(checked.error);
    await recordValidationFailure(
      result.requestId,
      request.taskType,
      result.capability,
      result.attempts,
      reason,
      { ...request, messages, json: true },
    );

    if (round === 1) {
      notes.push(`The first answer failed validation: ${reason}`);
      messages = assemble({
        ...request.prompt,
        taskInstruction:
          `${instruction}\n\nYour previous reply was rejected for these reasons:\n${reason}\n` +
          "Correct them and return only the JSON object.",
      });
      continue;
    }

    return {
      ok: false,
      data: null,
      outcome: "VALIDATION_FAILED",
      requestId: result.requestId,
      serviceName: result.serviceName,
      model: result.model,
      attempts: result.attempts,
      fellBack: result.fellBack,
      notes,
      injectionFindings,
      error: reason,
    };
  }

  // Unreachable: both rounds return. Present so the type is honest.
  return {
    ok: false,
    data: null,
    outcome: "VALIDATION_FAILED",
    requestId: "",
    serviceName: null,
    model: null,
    attempts: 0,
    fellBack: false,
    notes,
    injectionFindings,
    error: "the answer could not be validated",
  };
}
