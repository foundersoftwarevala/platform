import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Plus, Trash2, Video } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { embedUrl } from "@/lib/site-content/videos";

import { Card, PageHeader, PillButton, StatCard, SubNav } from "../ui";

/**
 * Vala TV Manager, over vala_tv_videos.
 *
 * The storefront's Vala TV section reads vala_tv_videos, but this editor kept
 * its own list in the browser: a video added, edited or taken off the air here
 * never reached the site, and the "Views" box let anyone type any number. It
 * now reads and writes the table itself - under its own policy, which admits
 * marketplace operators - and views are the ones recorded in vala_tv_views.
 */

// The Vala TV tables are not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (t: string) => (supabase as any).from(t);

type Category = { id: string; name: string };
type VideoRow = {
  id: string; title: string; url: string | null; thumbnail_url: string | null; duration: string | null;
  category_id: string | null; status: string; position: number;
};

const input =
  "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-accent/60";

const KEY = ["mm", "vala-tv"];

async function load() {
  const [categories, videos, views] = await Promise.all([
    from("vala_tv_categories").select("id,name").eq("archived", false).order("position"),
    from("vala_tv_videos").select("id,title,url,thumbnail_url,duration,category_id,status,position").neq("status", "archived").order("position"),
    from("vala_tv_views").select("video_id").limit(200000),
  ]);
  for (const r of [categories, videos, views]) if (r.error) throw new Error(r.error.message);
  const counts = new Map<string, number>();
  for (const v of (views.data ?? []) as { video_id: string }[]) counts.set(v.video_id, (counts.get(v.video_id) ?? 0) + 1);
  return {
    categories: (categories.data ?? []) as Category[],
    videos: (videos.data ?? []) as VideoRow[],
    views: counts,
  };
}

export function ValaTvSection() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: load });
  const [tab, setTab] = useState("All");
  const categories = useMemo(() => query.data?.categories ?? [], [query.data]);
  const rows = query.data?.videos ?? [];
  const nameOf = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const refresh = () => client.invalidateQueries({ queryKey: KEY });
  const save = async (id: string, change: Record<string, unknown>, done?: string) => {
    const { error } = await from("vala_tv_videos").update({ ...change, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (done) toast.success(done);
    await refresh();
  };

  const tabs = ["All", ...categories.map((c) => c.name)];
  const visible = tab === "All" ? rows : rows.filter((r) => nameOf.get(r.category_id ?? "") === tab);
  const published = rows.filter((r) => r.status === "published").length;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Vala TV Manager"
        title="Storefront video wall"
        description="Add, order and publish the videos that appear in the Vala TV section on the marketplace home page."
        actions={
          <PillButton
            variant="primary"
            onClick={async () => {
              const { data: auth } = await supabase.auth.getUser();
              const { error } = await from("vala_tv_videos").insert({
                title: "New video",
                status: "draft",
                source: "manual",
                category_id: categories[0]?.id ?? null,
                position: rows.length + 1,
                created_by: auth.user?.id ?? null,
              });
              if (error) toast.error(error.message);
              else await refresh();
            }}
          >
            <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Video</span>
          </PillButton>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Videos" value={query.isLoading ? "…" : String(rows.length)} icon={<Video className="h-4 w-4" />} />
        <StatCard label="Published" value={query.isLoading ? "…" : String(published)} tone="success" />
        <StatCard label="Drafts" value={query.isLoading ? "…" : String(rows.length - published)} tone="warning" />
        <StatCard label="Categories" value={query.isLoading ? "…" : String(categories.length)} />
      </div>

      {query.isError && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Vala TV could not be read: {(query.error as Error).message}
        </div>
      )}

      <SubNav items={tabs} active={tab} onChange={setTab} />

      {!query.isLoading && visible.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">No video here yet. Add one to start.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            views={query.data?.views.get(v.id) ?? 0}
            categories={categories}
            onSave={save}
            onDelete={async () => {
              if (!window.confirm(`Delete "${v.title}" from Vala TV?`)) return;
              const { error } = await from("vala_tv_videos").delete().eq("id", v.id);
              if (error) toast.error(error.message);
              else {
                toast.success("Video removed");
                await refresh();
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function VideoCard({
  video, views, categories, onSave, onDelete,
}: {
  video: VideoRow;
  views: number;
  categories: Category[];
  onSave: (id: string, change: Record<string, unknown>, done?: string) => Promise<void>;
  onDelete: () => void;
}) {
  // Typed into locally and saved when the field is left, so a video is not
  // rewritten on every keystroke.
  const [draft, setDraft] = useState({
    title: video.title,
    url: video.url ?? "",
    thumbnail_url: video.thumbnail_url ?? "",
    duration: video.duration ?? "",
    position: String(video.position),
  });
  useEffect(() => {
    setDraft({
      title: video.title,
      url: video.url ?? "",
      thumbnail_url: video.thumbnail_url ?? "",
      duration: video.duration ?? "",
      position: String(video.position),
    });
  }, [video]);
  const commit = (key: keyof typeof draft) => {
    const value = draft[key].trim();
    const current = key === "position" ? String(video.position) : String(video[key] ?? "");
    if (value === current) return;
    if (key === "title" && !value) {
      toast.error("A video needs a title");
      setDraft((d) => ({ ...d, title: video.title }));
      return;
    }
    void onSave(video.id, { [key]: key === "position" ? Number(value) || 0 : value || null });
  };
  const live = video.status === "published";
  const field = (key: keyof typeof draft, placeholder: string, label: string, extra = "") => (
    <input
      className={input + extra}
      aria-label={label}
      placeholder={placeholder}
      value={draft[key]}
      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      onBlur={() => commit(key)}
    />
  );

  return (
    <Card>
      <div className="mb-3 aspect-video w-full overflow-hidden rounded-xl border border-border bg-background/60">
        {video.url ? (
          <iframe src={embedUrl(video.url)} title={video.title || "Video preview"} className="h-full w-full" allowFullScreen />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Paste a YouTube, Vimeo or MP4 URL to preview
          </div>
        )}
      </div>
      <div className="space-y-2">
        {field("title", "Video title", "Video title", " font-semibold")}
        {field("url", "Video URL (YouTube / Vimeo / MP4)", "Video URL")}
        {field("thumbnail_url", "Thumbnail image URL (optional)", "Thumbnail URL")}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {field("duration", "Duration 4:12", "Duration")}
          <div className={input + " text-muted-foreground"} title="Counted from recorded plays">
            {views.toLocaleString()} views
          </div>
          <select
            className={input}
            aria-label="Category"
            value={video.category_id ?? ""}
            onChange={(e) => void onSave(video.id, { category_id: e.target.value || null })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            className={input}
            type="number"
            aria-label="Order"
            placeholder="Order"
            value={draft.position}
            onChange={(e) => setDraft((d) => ({ ...d, position: e.target.value }))}
            onBlur={() => commit("position")}
          />
        </div>
        <div className="flex gap-2">
          <PillButton
            variant={live ? "primary" : "ghost"}
            onClick={() =>
              void onSave(
                video.id,
                live ? { status: "draft" } : { status: "published", published_at: new Date().toISOString() },
                live ? "Taken off the air" : "Published to the storefront",
              )
            }
          >
            <span className="inline-flex items-center gap-1.5">
              {live ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {live ? "Live" : "Draft"}
            </span>
          </PillButton>
          <PillButton variant="ghost" onClick={onDelete}>
            <span className="inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</span>
          </PillButton>
        </div>
      </div>
    </Card>
  );
}
