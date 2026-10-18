const INITIAL_DEMO_PATHS: Readonly<Record<string, string>> = {
  "church-community-operations": "/auth",
};

export function initialDemoPath(
  slug: string,
  requestPath: string,
  hasTicketQuery: boolean,
): string | null {
  if (!hasTicketQuery || requestPath !== "/") return null;
  return INITIAL_DEMO_PATHS[slug] ?? null;
}
