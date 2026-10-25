import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { callAsUser } from "@/lib/supabase-rpc.server";
import type { Json } from "@/lib/json";

const trendingResponse = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  searches: z.array(
    z.object({
      query: z.string(),
      searches: z.number().int().nonnegative(),
    }),
  ),
});

export type TrendingSearch = z.infer<typeof trendingResponse>["searches"][number];

export const marketplaceTrendingSearches = createServerFn({ method: "GET" }).handler(
  async (): Promise<TrendingSearch[]> => {
    const result = trendingResponse.safeParse(
      await callAsUser<Json>("mm_search_trends", { p_days: 30, p_limit: 5 }),
    );
    if (!result.success) throw new Error("The search trends response was invalid.");
    if (!result.data.ok) {
      throw new Error(
        result.data.reason === "not_permitted"
          ? "Search trends require marketplace operator access."
          : "Search trends could not be loaded.",
      );
    }
    return result.data.searches;
  },
);
