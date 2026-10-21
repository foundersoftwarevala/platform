const URL_FIELDS = ["demo_url", "public_repo_url"] as const;

export function validateAuthorProductDraft(draft: Record<string, string>): string | null {
  if ((draft.name ?? "").trim().length < 3) {
    return "A product name of at least 3 characters is required.";
  }

  for (const field of URL_FIELDS) {
    const value = (draft[field] ?? "").trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return `${field} must be an http(s) web address.`;
      }
    } catch {
      return `${field} must be an http(s) web address.`;
    }
  }

  if ((draft.features ?? "").trim()) {
    try {
      JSON.parse(draft.features);
    } catch {
      return "Features must contain valid JSON.";
    }
  }

  return null;
}
