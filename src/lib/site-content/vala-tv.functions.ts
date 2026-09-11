import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { ValaVideo } from "@/lib/site-content/videos";

/**
 * Vala TV, read and written where the homepage reads it.
 *
 * The homepage's Vala TV section is served by sf_vala_tv() over
 * public.vala_tv_videos. The Manager screen kept its videos in the operator's
 * browser (lib/site-content/videos.ts), so nothing it saved could reach the
 * page. These functions give the screen the database instead:
 *
 *   read   - the operator is checked with mm_is_operator(), then every column is
 *            read, so the editor can show thumbnail, duration and category;
 *   write  - mm_vala_tv_save and mm_vala_tv_status, called as the signed-in
 *            person, which check the role again and record the change in the
 *            marketplace audit log;
 *   public - sf_vala_tv(), the exact list the homepage renders, for /vala-tv.
 *
 * Views are counted from vala_tv_views by the database; they are not typed in.
 */

async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

type Outcome = { ok?: boolean; reason?: string; problems?: string[]; video?: unknown };

function settle(result: Outcome | null): void {
  if (result?.ok) return;
  if (result?.reason === "not_permitted") {
    throw new Error("Changing Vala TV needs marketplace operator rights.");
  }
  if (result?.reason === "validation_failed" && result.problems?.length) {
    throw new Error(result.problems.join(" "));
  }
  throw new Error(String(result?.reason ?? "The change was refused."));
}

export type ManagedVideo = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  thumbnail_url: string | null;
  duration: string | null;
  category_id: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  featured: boolean;
  position: number;
  publish_at: string | null;
  views: number;
};

export type ValaTvCategory = { id: string; name: string; slug: string; position: number };

/** Everything the Manager screen needs, for an operator only. */
export const getValaTvManager = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ videos: ManagedVideo[]; categories: ValaTvCategory[]; liveNow: number }> => {
    const allowed = await callAsUser<boolean>("mm_is_operator", {});
    if (allowed !== true) throw new Error("Vala TV is managed by marketplace operators.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [videos, categories, views, live] = await Promise.all([
      supabaseAdmin
        .from("vala_tv_videos" as never)
        .select(
          "id,title,description,url,thumbnail_url,duration,category_id,status,featured,position,publish_at",
        )
        .order("position", { ascending: true })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("vala_tv_categories" as never)
        .select("id,name,slug,position")
        .eq("archived", false)
        .order("position", { ascending: true }),
      supabaseAdmin.from("vala_tv_views" as never).select("video_id"),
      supabaseAdmin.rpc("sf_vala_tv" as never),
    ]);
    if (videos.error) throw new Error(videos.error.message);
    if (categories.error) throw new Error(categories.error.message);

    const counted = new Map<string, number>();
    for (const row of (views.data ?? []) as { video_id: string }[]) {
      counted.set(row.video_id, (counted.get(row.video_id) ?? 0) + 1);
    }
    return {
      videos: ((videos.data ?? []) as Omit<ManagedVideo, "views">[]).map((v) => ({
        ...v,
        views: counted.get(v.id) ?? 0,
      })),
      categories: (categories.data ?? []) as ValaTvCategory[],
      liveNow: Array.isArray(live.data) ? (live.data as unknown[]).length : 0,
    };
  },
);

const saveValaTvInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().max(300).optional(),
  description: z.string().max(4000).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  thumbnail_url: z.string().max(2000).nullable().optional(),
  duration: z.string().max(40).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  featured: z.boolean().optional(),
  position: z.number().int().min(0).max(100000).optional(),
});
export type SaveValaTvInput = z.infer<typeof saveValaTvInput>;

/** Create (no id) or update a video. Status changes go through setValaTvStatus. */
export const saveValaTvVideo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => saveValaTvInput.parse(i))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const patch: Record<string, unknown> = { ...data };
    // The function reads '' as "clear", so a cleared field is sent as ''.
    for (const key of ["description", "url", "thumbnail_url", "duration", "category_id"]) {
      if (key in patch && patch[key] === null) patch[key] = "";
    }
    settle(await callAsUser<Outcome>("mm_vala_tv_save", { p_patch: patch }));
    return { ok: true as const };
  });

/** Draft, schedule, publish or archive. Publishing checks the video can play. */
export const setValaTvStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        to: z.enum(["draft", "scheduled", "published", "archived"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const result = await callAsUser<Outcome>("mm_vala_tv_status", {
      p_id: data.id,
      p_to: data.to,
    });
    settle(result);
    return { ok: true as const };
  });

type PublicRow = {
  id: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  duration: string | null;
  category: string | null;
  views: number | null;
};

/**
 * The published list, exactly as the homepage section gets it, in the shape
 * the /vala-tv page already draws.
 */
export const listPublicValaTv = createServerFn({ method: "GET" }).handler(
  async (): Promise<ValaVideo[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("sf_vala_tv" as never);
    if (error || !Array.isArray(data)) return [];
    return (data as PublicRow[]).map((v, index) => ({
      id: v.id,
      title: v.title ?? "",
      url: v.url ?? "",
      thumbnail: v.thumbnail ?? "",
      duration: v.duration ?? "",
      views: v.views ? String(v.views) : "",
      category: v.category ?? "",
      published: true,
      order: index,
    }));
  },
);
