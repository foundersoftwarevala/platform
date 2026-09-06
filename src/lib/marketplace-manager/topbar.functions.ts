import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
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

async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

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
  config: Record<string, unknown>;
  live: boolean;
  updated_at: string;
};

/** Every module in the bar, in the order the header renders them. */
export const listTopBarModules = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; modules: TopBarModule[] }> => {
    const modules = await callAsUser<TopBarModule[]>("mm_topbar_modules", {});
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
    z.object({
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
    }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("mm_topbar_configure", {
        p_key: data.key, p_patch: data.patch,
      }),
      "Module updated",
    ),
  );

/** Reordering writes sort_order, which is the column the header sorts on. */
export const reorderTopBarModules = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ keys: z.array(z.string().min(1)).min(1).max(60) }).parse(i),
  )
  .handler(async ({ data }) =>
    settle(
      await callAsUser<Outcome>("mm_topbar_reorder", { p_keys: data.keys }),
      "Top bar reordered",
    ),
  );
