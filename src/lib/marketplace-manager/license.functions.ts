import { callAsUser } from "@/lib/supabase-rpc.server";
import type { JsonObject } from "@/lib/json";
import { createServerFn } from "@tanstack/react-start";

/**
 * Licence figures for the Marketplace Manager.
 *
 * Counted from marketplace_licenses and marketplace_entitlements as the
 * signed-in operator, so the database decides what they may see.
 */

export const getLicenseOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<JsonObject> =>
    callAsUser("mm_license_overview", { p_window: "30d" }),
);
