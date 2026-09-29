import { getRole, type Field } from "./config";

/**
 * What an application form may contain, checked the same way on both sides.
 *
 * The form's own configuration is the contract: only its fields are kept, its
 * required fields must be there, and each value must be the kind of value the
 * field asks for. The browser checks first so the applicant hears at once; the
 * server checks again because the browser is not the one deciding.
 *
 * Documents are not values: a file field is never kept as text. The file is
 * uploaded and recorded on its own.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT = 2000;
const MAX_LONG_TEXT = 5000;

export type Checked =
  { ok: true; values: Record<string, string> } | { ok: false; error: string; fields: string[] };

function problem(field: Field, value: string): string | null {
  switch (field.type) {
    case "email":
      return EMAIL.test(value) ? null : "is not a valid email address";
    case "url": {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:"
          ? null
          : "must be a web address (https://…)";
      } catch {
        return "must be a web address (https://…)";
      }
    }
    case "number": {
      const n = Number(value.replace(/,/g, ""));
      return Number.isFinite(n) && n >= 0 ? null : "must be a number";
    }
    case "tel":
      return (value.match(/\d/g)?.length ?? 0) >= 6 ? null : "is not a phone number";
    case "select":
      return field.options?.includes(value) ? null : "is not one of the choices";
    default:
      return null;
  }
}

export function checkApplication(role: string, raw: Record<string, unknown>): Checked {
  const config = getRole(role);
  if (!config) return { ok: false, error: "That role does not exist.", fields: [] };

  const fields = config.sections.flatMap((s) => s.fields).filter((f) => f.type !== "file");
  const values: Record<string, string> = {};
  const missing: Field[] = [];
  const wrong: { field: Field; why: string }[] = [];

  for (const field of fields) {
    const value = typeof raw[field.name] === "string" ? (raw[field.name] as string).trim() : "";
    if (!value) {
      if (field.required) missing.push(field);
      continue;
    }
    const limit = field.type === "textarea" ? MAX_LONG_TEXT : MAX_TEXT;
    if (value.length > limit) {
      wrong.push({ field, why: `is longer than ${limit} characters` });
      continue;
    }
    const why = problem(field, value);
    if (why) wrong.push({ field, why });
    else values[field.name] = value;
  }

  if (missing.length) {
    return {
      ok: false,
      error: `Missing required fields: ${missing.map((f) => f.label).join(", ")}`,
      fields: missing.map((f) => f.name),
    };
  }
  if (wrong.length) {
    return {
      ok: false,
      error: wrong.map((w) => `${w.field.label} ${w.why}`).join("; "),
      fields: wrong.map((w) => w.field.name),
    };
  }
  return { ok: true, values };
}
