import { createFileRoute } from "@tanstack/react-router";
import { DEVELOPER_STAGES } from "@/lib/ams/developer-stages";
import { StageCard } from "@/components/ams/trophy-gallery/StageCard";

export const Route = createFileRoute("/ams/developer-progression")({
  head: () => ({
    meta: [
      { title: "Developer Progression — 10 Stage Career" },
      { name: "description", content: "A cinematic 10-stage developer progression: Apprentice through Chief Architect, each with unique trophies, materials, animations and unlock sounds." },
      { property: "og:title", content: "Developer Progression — 10 Stage Career" },
      { property: "og:description", content: "A cinematic 10-stage developer progression: Apprentice through Chief Architect, each with unique trophies, materials, animations and unlock sounds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      <header className="rounded-2xl border border-amber-500/30 p-8 relative overflow-hidden"
        style={{
          background:
            "radial-gradient(1200px 400px at 20% 0%, rgba(245,197,66,0.18), transparent 60%), radial-gradient(1200px 400px at 90% 100%, rgba(192,132,252,0.18), transparent 60%), linear-gradient(160deg, #0f0a04, #05030a)",
        }}>
        <div className="text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/80">Master Role Progression · Reference Model</div>
        <h1 className="mt-3 text-3xl lg:text-4xl font-semibold text-white">
          Developer — Ten Stages of a Career
        </h1>
        <p className="mt-3 text-sm text-white/70 max-w-3xl">
          A cinematic engineering journey from first commit to Chief Architect. Every stage changes
          material, trophy silhouette, medal shape, ribbon, passport motif, nameplate, background
          theme and unlock sound. Ten leagues. No two stages alike.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-mono">
          {DEVELOPER_STAGES.map((s) => (
            <a key={s.n} href={`#stage-${s.n}`}
              className="rounded-full border px-2.5 py-1 uppercase tracking-widest transition hover:brightness-125"
              style={{ borderColor: `${s.bg.accent}66`, color: s.bg.accent, background: `${s.bg.accent}18` }}>
              LV {String(s.n).padStart(2, "0")} · {s.material}
            </a>
          ))}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {DEVELOPER_STAGES.map((s) => (
          <div key={s.n} id={`stage-${s.n}`} className="scroll-mt-24">
            <StageCard stage={s} />
          </div>
        ))}
      </div>
    </div>
  );
}
