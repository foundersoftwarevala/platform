// Role credential wall — shield + certificate for every catalog role,
// each sealed with the Software Vala brand mark and collection number.

import { useMemo, useState } from "react";
import { ShieldCheck, ScrollText } from "lucide-react";
import { SVSeal, SVMicroMark, svCollectionNumber } from "@/components/ams/brand/SVMark";
import { ROLE_LIST } from "@/lib/ams/trophy-catalog";

const shields = import.meta.glob<string>("/src/assets/shields/*.png", {
  eager: true, query: "?url", import: "default",
});
const certificates = import.meta.glob<string>("/src/assets/certificates/*.png", {
  eager: true, query: "?url", import: "default",
});

function keyed(map: Record<string, string>, suffix: string) {
  return Object.fromEntries(
    Object.entries(map).map(([p, url]) => [
      p
        .slice(p.lastIndexOf("/") + 1)
        .replace(/\.png$/, "")
        .replace(new RegExp(`-${suffix}$`), ""),
      url,
    ]),
  ) as Record<string, string>;
}

const SHIELD = keyed(shields, "shield");
const CERT = keyed(certificates, "certificate");

const ACCENTS = [
  "#60a5fa", "#f472b6", "#facc15", "#34d399", "#a78bfa", "#fb923c",
  "#22d3ee", "#f87171", "#4ade80", "#e879f9", "#38bdf8", "#fcd34d",
  "#818cf8", "#2dd4bf", "#fda4af", "#c084fc", "#93c5fd", "#fbbf24",
];

type Kind = "shield" | "certificate";

function Credential({
  src, role, slug, kind, accent,
}: { src: string; role: string; slug: string; kind: Kind; accent: string }) {
  const Icon = kind === "shield" ? ShieldCheck : ScrollText;
  return (
    <figure
      className="group relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 34%, var(--border))`,
        background: `radial-gradient(120% 90% at 50% 0%, color-mix(in oklab, ${accent} 12%, var(--card)) 0%, var(--card) 55%, var(--background) 100%)`,
        boxShadow: `0 22px 60px -34px color-mix(in oklab, ${accent} 70%, transparent)`,
      }}
    >
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <SVSeal accent={accent} size={20} />
      </div>
      <div className="pointer-events-none absolute right-3 top-4 z-10">
        <SVMicroMark accent={accent} />
      </div>
      <div className="grid h-48 place-items-center">
        <img
          src={src}
          alt={`${role} ${kind}`}
          loading="lazy"
          width={1024}
          height={1024}
          className="max-h-44 w-auto object-contain transition-transform duration-500 group-hover:scale-[1.06]"
          style={{
            filter: `saturate(1.16) contrast(1.06) drop-shadow(0 18px 26px rgba(0,0,0,0.55)) drop-shadow(0 0 26px color-mix(in oklab, ${accent} 40%, transparent))`,
          }}
        />
      </div>
      <figcaption className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-foreground">{role}</div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]" style={{ color: `${accent}cc` }}>
            <Icon className="h-3.5 w-3.5" />
            {kind === "shield" ? "Trust Shield" : "Certificate"}
          </div>
        </div>
        <span className="font-mono text-[10px] tabular-nums" style={{ color: `${accent}aa` }}>
          {svCollectionNumber(`${slug}-${kind}`, kind.slice(0, 3))}
        </span>
      </figcaption>
    </figure>
  );
}

export function RoleCredentialWall() {
  const [kind, setKind] = useState<Kind>("shield");
  const items = useMemo(
    () =>
      ROLE_LIST.map((r, i) => ({
        ...r,
        accent: ACCENTS[i % ACCENTS.length]!,
        src: (kind === "shield" ? SHIELD : CERT)[r.slug],
      })).filter((r) => Boolean(r.src)),
    [kind],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Role Credential Wall</h2>
          <p className="text-sm text-muted-foreground">
            Trust shields and certificates for all {ROLE_LIST.length} roles — every piece sealed with the Software Vala mark.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border/60 bg-black/20 p-1">
          {(["shield", "certificate"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${
                kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k}s
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((r) => (
          <Credential key={`${r.slug}-${kind}`} src={r.src!} role={r.role} slug={r.slug} kind={kind} accent={r.accent} />
        ))}
      </div>
    </section>
  );
}
