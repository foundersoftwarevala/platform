import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAmsCatalogue, type AmsCatalogue } from "@/lib/ams/catalogue.functions";

/**
 * The AMS catalogue, shared by every engine screen that lists it.
 *
 * One request serves Trophies, Levels, Ranks, Achievements and Badges, so
 * moving between those screens does not re-query, and all five agree with each
 * other and with Command Center because they read the same response.
 */
export function useAmsCatalogue() {
  const fetchCatalogue = useServerFn(getAmsCatalogue);
  return useQuery<AmsCatalogue>({
    queryKey: ["ams", "catalogue"],
    queryFn: () => fetchCatalogue(),
    staleTime: 60_000,
  });
}

/** Counts a field's values, for KPI tiles that must be counted not asserted. */
export function countBy<T>(rows: T[], pick: (row: T) => string): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = pick(row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}
