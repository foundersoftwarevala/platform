const SENSITIVE_KEY =
  /(?:password|passwd|pwd|token|api[_-]?key|secret|authorization|cookie|credential|private[_-]?key)/i;

const SENSITIVE_ASSIGNMENT =
  /(["']?(?:password|passwd|pwd|access[_-]?token|refresh[_-]?token|token|api[_-]?key|secret|authorization|cookie|credential|private[_-]?key)["']?\s*[:=]\s*)(["']?)[^,;}"']+/gi;

const URL_SECRET =
  /([?&](?:password|token|api[_-]?key|secret|access[_-]?token|refresh[_-]?token)=)[^&#\s]*/gi;
const EMAIL_ADDRESS =
  /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+\b/gi;
const PHONE_NUMBER =
  /(?<![\w])(?:\+\d{1,3}[\s.-]?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}|(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{3,4}[\s.-]\d{4}|\d{10,15})(?!\w)/g;

export function redactSensitiveText(value: string): string {
  return value
    .replace(SENSITIVE_ASSIGNMENT, "$1$2[REDACTED]")
    .replace(URL_SECRET, "$1[REDACTED]")
    .replace(EMAIL_ADDRESS, "[REDACTED_EMAIL]")
    .replace(PHONE_NUMBER, "[REDACTED_PHONE]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_TOKEN]");
}

export function redactSensitiveData(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (value == null || typeof value !== "object") return value;
  if (depth >= 6 || seen.has(value)) return "[REDACTED]";
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => redactSensitiveData(item, depth + 1, seen));
    seen.delete(value);
    return result;
  }

  const result = Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      SENSITIVE_KEY.test(key) ? [] : [[key, redactSensitiveData(item, depth + 1, seen)]],
    ),
  );
  seen.delete(value);
  return result;
}

const ERROR_METADATA_ALLOWLIST = new Set(["kind", "reported_severity"]);

export function redactErrorMetadata(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      if (!ERROR_METADATA_ALLOWLIST.has(key) || typeof item !== "string") return [];
      return [[key, redactSensitiveText(item).slice(0, 80)]];
    }),
  );
}
