import type { JsonObject } from "@/lib/json";
import { createServerFn } from "@tanstack/react-start";
import {
  callMarketplaceManagerFunctionFromRequest,
  callVpsPublicFunction,
} from "./vps-rpc.server";

import { z } from "zod";

/**
 * Storefront Top Bar modules — the ones the header actually renders.
 *
 * TopUtilityBar.tsx composes ten modules: ApplyNow, LanguagePicker,
 * CalendarTool, CalculatorTool, LoginPill, CurrencyPicker, Notifications,
 * Favorites, AiChat and DashboardsMenu. The manager listed twenty-five from a
 * static array under a hardcoded "25 modules" label, and nineteen of those
 * twenty-five describe things the header does not have.
 *
 * These read and write marketplace_topbar_modules, which the header itself now
 * reads, so the manager and the storefront cannot disagree.
 */

export type TopBarModule = {
  module_key: string;
  name: string;
  category: string;
  description: string | null;
  component: string | null;
  sort_order: number;
  status: "live" | "draft" | "hidden" | "archived";
  desktop_enabled: boolean;
  tablet_enabled: boolean;
  mobile_enabled: boolean;
  sticky_enabled: boolean;
  featured: boolean;
  config: JsonObject;
  live: boolean;
  /**
   * True when a component in the header actually reads this row. The registry
   * returns these three and always has; they were missing from this type, so
   * every caller that wanted them reached for a cast. `blocked_reason` is what
   * the module says is missing before it could go live, and it is the same
   * sentence mm_topbar_configure quotes back when it refuses.
   */
  rendered: boolean;
  planned: boolean;
  blocked_reason: string | null;
  updated_at: string;
};

/** Every module in the bar, in the order the header renders them. */
export const listTopBarModules = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; modules: TopBarModule[] }> => {
    const modules = await callVpsPublicFunction<TopBarModule[]>("mm_topbar_modules");
    return { ok: true as const, modules: modules ?? [] };
  },
);

type Outcome = { ok?: boolean; reason?: string; message?: string };

function settle(r: Outcome | null, whenOk: string) {
  if (!r?.ok) {
    throw new Error(
      r?.reason === "not_permitted"
        ? "Changing the storefront top bar needs marketplace operator rights."
        : r?.reason === "unknown_module"
          ? "That module is not in the registry."
          : String(r?.message ?? r?.reason ?? "The change was refused."),
    );
  }
  return { ok: true as const, message: whenOk };
}

export const configureTopBarModule = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        key: z.string().min(1).max(60),
        patch: z.object({
          name: z.string().min(1).max(80).optional(),
          status: z.enum(["live", "draft", "hidden", "archived"]).optional(),
          sort_order: z.number().int().min(1).max(99).optional(),
          desktop_enabled: z.boolean().optional(),
          tablet_enabled: z.boolean().optional(),
          mobile_enabled: z.boolean().optional(),
          sticky_enabled: z.boolean().optional(),
          featured: z.boolean().optional(),
        }),
      })
      .parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callMarketplaceManagerFunctionFromRequest<Outcome>(
        "mm_topbar_configure",
        {
          p_key: data.key,
          p_patch: data.patch,
        },
      ),
      "Module updated",
    ),
  );

export type TopBarItem = { key: string; label: string; blurb?: string };

/**
 * Replace the items of a header dropdown.
 *
 * Apply Now and Dashboards are the only two menus the header has, and their
 * entries used to be arrays inside TopUtilityBar.tsx. They live in the
 * module's own config now, so the manager edits the rows the header reads.
 *
 * The database does the validating — a key and a label on every item, no
 * repeated keys, at most forty entries — because a client cannot be trusted
 * with any of it, and because the same rules then apply to every caller.
 */
export const setTopBarItems = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        key: z.string().min(1).max(60),
        items: z
          .array(
            z.object({
              key: z.string().min(1).max(60),
              label: z.string().min(1).max(80),
              blurb: z.string().max(160).optional(),
            }),
          )
          .max(40),
      })
      .parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callMarketplaceManagerFunctionFromRequest<Outcome>(
        "mm_topbar_items_set",
        {
          p_key: data.key,
          p_items: data.items,
        },
      ),
      `Menu saved — ${data.items.length} item${data.items.length === 1 ? "" : "s"}`,
    ),
  );

/** Reordering writes sort_order, which is the column the header sorts on. */
export const reorderTopBarModules = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ keys: z.array(z.string().min(1)).min(1).max(60) }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callMarketplaceManagerFunctionFromRequest<Outcome>(
        "mm_topbar_reorder",
        { p_keys: data.keys },
      ),
      "Top bar reordered",
    ),
  );
