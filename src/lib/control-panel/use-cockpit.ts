import { useQuery } from "@tanstack/react-query";

import { authHeaders } from "@/lib/auth/operator-fetch";

import type { CockpitFigures } from "./cockpit";

/** The cockpit figures, shared by every panel that shows one. Refreshed every minute. */
export function useCockpitFigures() {
  return useQuery({
    queryKey: ["control-panel", "cockpit"],
    queryFn: async (): Promise<CockpitFigures> => {
      const response = await fetch("/api/control-panel/cockpit", { headers: await authHeaders() });
      const body = (await response.json().catch(() => ({}))) as CockpitFigures & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? `The cockpit figures could not be read (${response.status})`);
      return body;
    },
    refetchInterval: 60_000,
  });
}
