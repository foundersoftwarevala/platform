import type { Json } from "@/integrations/supabase/types";

export type { Json };
export type JsonObject = { [key: string]: Json | undefined };

export function isJson(value: unknown): value is Json {
  const ancestors = new Set<object>();
  function visit(item: unknown): boolean {
    if (item === null || typeof item === "string" || typeof item === "boolean") return true;
    if (typeof item === "number") return Number.isFinite(item);
    if (typeof item !== "object" || ancestors.has(item)) return false;
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    )
      return false;
    ancestors.add(item);
    const valid = Array.isArray(item)
      ? Array.from(item).every(visit)
      : Object.values(item).every((child) => child === undefined || visit(child));
    ancestors.delete(item);
    return valid;
  }
  return visit(value);
}

export function requireJson(value: unknown, context: string): Json {
  if (!isJson(value)) throw new Error(`${context} is not JSON serializable`);
  return value;
}

export function requireJsonObject(value: unknown, context: string): JsonObject {
  const json = requireJson(value, context);
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error(`${context} must be a JSON object`);
  }
  return json;
}
