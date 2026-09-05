import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Play, Video } from "lucide-react";
import { embedUrl, hasPlayableVideo, listPublishedVideos, VIDEO_CATEGORIES } from "@/lib/site-content/videos";
import "@/styles/marketplace-home.css";

/**
 * The full Vala TV listing. Videos are managed from
 * Marketplace Manager -> Growth -> Vala TV; this page shows whatever is
 * published there and says plainly when a film has no URL set yet rather than
 * opening something unrelated.
 */
function ValaTvPage() {
  const videos = useMemo(() => listPublishedVideos(), []);
  const [filter, setFilter] = useState<string>("All");
  const [playing, setPlaying] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All", ...VIDEO_CATEGORIES.filter((c) => videos.some((v) => v.category === c))],
    [videos],
  );
  const shown = filter === "All" ? videos : videos.filter((v) => v.category === filter);

  return (
    <main className="min-h-screen bg-[#050b18] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
          &larr; Back to marketplace
        </a>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Vala TV</h1>
        <p className="mt-1.5 text-sm text-white/60">Demos, walkthroughs and customer films.</p>

        {videos.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center text-sm text-white/60">
            No videos are published yet.
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Video categories">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={filter === category}
                  onClick={() => setFilter(category)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                    filter === category
                      ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                      : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((video) => {
                const playable = hasPlayableVideo(video.url);
                return (
                  <article key={video.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className="relative aspect-video bg-black/40">
                      {playing === video.id && playable ? (
                        <iframe
                          src={embedUrl(video.url)}
                          title={video.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                          allowFullScreen
                          className="h-full w-full"
                        />
                      ) : (
                        <>
                          {video.thumbnail ? (
                            <img
                              src={video.thumbnail}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10">
                              <Video className="h-8 w-8 text-white/25" aria-hidden="true" />
                            </div>
                          )}
                          {playable ? (
                            <button
                              type="button"
                              onClick={() => setPlaying(video.id)}
                              aria-label={`Play ${video.title}`}
                              className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                            >
                              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900">
                                <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
                              </span>
                            </button>
                          ) : (
                            <span className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-1.5 text-center text-[11px] text-white/70">
                              Film not published yet
                            </span>
                          )}
                        </>
                      )}
                      {video.duration && (
                        <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold">
                          {video.duration}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                        {video.category}
                      </span>
                      <h2 className="mt-1.5 text-sm font-bold leading-snug">{video.title}</h2>
                      {video.views && <p className="mt-1 text-[11px] text-white/50">{video.views} views</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export const Route = createFileRoute("/vala-tv")({
  head: () => ({
    meta: [
      { title: "Vala TV | Software Vala" },
      { name: "description", content: "Product demos, walkthroughs and customer films from the Software Vala marketplace." },
      { property: "og:title", content: "Vala TV | Software Vala" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ValaTvPage,
});
