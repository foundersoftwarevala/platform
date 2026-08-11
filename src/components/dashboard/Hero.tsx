import { Play, Sparkles, ArrowRight } from "lucide-react";
import type { RoleConfig } from "@/lib/roles";

export function Hero({ role, onCta, onAnalytics }: { role: RoleConfig; onCta?: () => void; onAnalytics?: () => void }) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border shadow-card"
      style={{ background: role.banner.gradient }}
    >
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          background:
            `radial-gradient(700px 240px at 80% 20%, color-mix(in oklab, ${role.banner.accent} 35%, transparent), transparent),` +
            ` radial-gradient(500px 240px at 5% 100%, oklch(1 0 0 / 0.08), transparent)`,
        }}
      />
      {/* Grain */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none"
           style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      <div className="relative grid md:grid-cols-[1.4fr_1fr] gap-6 p-6 md:p-10">
        <div className="min-w-0 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em]">
            <Sparkles className="h-3 w-3" style={{ color: role.banner.accent }} />
            {role.banner.eyebrow}
          </div>
          <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">
            {role.banner.headline}
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/75 max-w-xl">{role.banner.sub}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={onCta}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:opacity-95"
              style={{ background: "white" }}
            >
              <Play className="h-4 w-4 fill-current" /> {role.banner.cta}
            </button>
            <button
              onClick={onAnalytics}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition"
            >
              View Analytics <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-5 text-xs text-white/70">
            <Stat label="Benchmarked" value={role.benchmarks.join(" + ")} />
            <Stat label="Role" value={role.name} />
            <Stat label="Status" value="Live workspace" />
          </div>
        </div>

        <div className="relative hidden md:block">
          <div className="absolute -top-10 -right-10 h-72 w-72 rounded-full blur-3xl opacity-50"
               style={{ background: role.banner.accent }} />
          <div className="relative h-full rounded-2xl bg-white/5 border border-white/15 backdrop-blur p-5 text-white">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-white/60">Performance</div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">Awaiting data</span>
            </div>
            <div className="mt-2 text-xl font-bold">Connect a data source</div>
            <div className="text-xs text-white/60">Charts populate once your backend is wired up.</div>
            <EmptySparkline accent={role.banner.accent} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {["Today", "Week", "Month"].map((l) => (
                <div key={l} className="rounded-lg bg-black/20 p-2">
                  <div className="text-[10px] opacity-70">{l}</div>
                  <div className="text-sm font-bold text-white/50">—</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

function EmptySparkline({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 200 80" className="mt-3 w-full h-24">
      <defs>
        <linearGradient id="sp-empty" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <pattern id="dash" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M 0 6 L 6 0" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="200" height="80" fill="url(#dash)" rx="8" />
      <path d="M0,55 C30,50 55,50 80,50 C120,50 150,50 200,50" stroke={accent} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
    </svg>
  );
}
