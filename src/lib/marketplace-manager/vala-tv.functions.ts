import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { catalogueChanged } from "@/lib/marketplace/catalogue-invalidation";
import { withMarketplaceManagerDatabaseFromRequest } from "./vps-rpc.server";

export type ValaTvCategory = { id: string; name: string };
export type ValaTvVideo = {
  id: string;
  title: string;
  url: string | null;
  thumbnail_url: string | null;
  duration: string | null;
  category_id: string | null;
  status: string;
  position: number;
};

export type ValaTvVideoPatch = Partial<
  Pick<
    ValaTvVideo,
    "title" | "url" | "thumbnail_url" | "duration" | "category_id" | "status" | "position"
  > & { published_at: string | null }
>;

export type ValaTvManagerData = {
  categories: ValaTvCategory[];
  videos: ValaTvVideo[];
  views: Record<string, number>;
};

export const getValaTvManager = createServerFn({ method: "GET" }).handler(
  async (): Promise<ValaTvManagerData> =>
    withMarketplaceManagerDatabaseFromRequest(async (tx) => {
      const categories = await tx<ValaTvCategory[]>`
        select id, name
          from public.vala_tv_categories
         where archived is false
         order by position, id
      `;
      const videos = await tx<ValaTvVideo[]>`
        select id, title, url, thumbnail_url, duration, category_id, status, position
          from public.vala_tv_videos
         where status <> 'archived'
         order by position, id
      `;
      const counts = await tx<{ video_id: string; views: number }[]>`
        select video_id, count(*)::int as views
          from public.vala_tv_views
         group by video_id
      `;
      return {
        categories,
        videos,
        views: Object.fromEntries(counts.map(({ video_id, views }) => [video_id, views])),
      };
    }),
);

export const createValaTvVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ categoryId: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<ValaTvVideo> => {
    const video = await withMarketplaceManagerDatabaseFromRequest(async (tx) => {
      const categoryId =
        data.categoryId ??
        (await tx<{ id: string }[]>`
          select id from public.vala_tv_categories
           where archived is false
           order by position, id
           limit 1
        `)[0]?.id ??
        null;
      const [position] = await tx<{ next_position: number }[]>`
        select coalesce(max(position), 0)::int + 1 as next_position
          from public.vala_tv_videos
         where status <> 'archived'
      `;
      const [row] = await tx<ValaTvVideo[]>`
        insert into public.vala_tv_videos
          (title, status, source, category_id, position, created_by)
        values ('New video', 'draft', 'manual', ${categoryId}::uuid,
                ${position?.next_position ?? 1}, auth.uid())
        returning id, title, url, thumbnail_url, duration, category_id, status, position
      `;
      if (!row) throw new Error("The new Vala TV video could not be read back.");
      return row;
    });
    catalogueChanged();
    return video;
  });

const videoPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  url: z.string().trim().max(2048).nullable().optional(),
  thumbnail_url: z.string().trim().max(2048).nullable().optional(),
  duration: z.string().trim().max(40).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
  position: z.number().int().min(0).max(100_000).optional(),
  published_at: z.string().datetime().nullable().optional(),
}).strict();

export const updateValaTvVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), patch: videoPatchSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const entries = Object.entries(data.patch);
    if (!entries.length) throw new Error("No Vala TV video changes were supplied.");
    const columns = new Set([
      "title", "url", "thumbnail_url", "duration", "category_id", "status",
      "position", "published_at",
    ]);
    for (const [key] of entries) {
      if (!columns.has(key)) throw new Error(`The ${key} field cannot be changed here.`);
    }
    await withMarketplaceManagerDatabaseFromRequest(async (tx) => {
      const values = entries.map(([, value]) => value);
      const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
      values.push(data.id);
      const rows = await tx.unsafe(
        `update public.vala_tv_videos
            set ${assignments.join(", ")}, updated_at = now(), updated_by = auth.uid()
          where id = $${values.length}::uuid and status <> 'archived'
          returning id`,
        values as never[],
      ) as { id: string }[];
      if (!rows[0]) throw new Error("The Vala TV video does not exist or is archived.");
    });
    catalogueChanged();
    return { ok: true };
  });

export const archiveValaTvVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await withMarketplaceManagerDatabaseFromRequest(async (tx) => {
      const rows = await tx<{ id: string }[]>`
        update public.vala_tv_videos
           set status = 'archived', updated_at = now(), updated_by = auth.uid()
         where id = ${data.id}::uuid and status <> 'archived'
         returning id
      `;
      if (!rows[0]) throw new Error("The Vala TV video does not exist or is already archived.");
    });
    catalogueChanged();
    return { ok: true };
  });
