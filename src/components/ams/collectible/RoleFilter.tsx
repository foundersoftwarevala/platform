import { ROLES, type RoleSlug } from "@/lib/ams/roles";

export type RoleFilterValue = RoleSlug | "all";

export function RoleFilter({
  value,
  onChange,
  accent = "#facc15",
}: {
  value: RoleFilterValue;
  onChange: (v: RoleFilterValue) => void;
  accent?: string;
}) {
  const items: { key: RoleFilterValue; label: string; hue: string; glyph: string }[] = [
    { key: "all", label: "All Roles", hue: accent, glyph: "★" },
    ...ROLES.map((r) => ({ key: r.slug as RoleFilterValue, label: r.name, hue: r.accent, glyph: r.glyph })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 p-1.5">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className="group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium tracking-wide transition-all"
            style={{
              color: active ? "#08121f" : `${it.hue}dd`,
              background: active
                ? `linear-gradient(135deg, ${it.hue}, ${it.hue}cc)`
                : "transparent",
              boxShadow: active ? `0 6px 18px -6px ${it.hue}aa` : "none",
              border: `1px solid ${active ? it.hue : `${it.hue}33`}`,
            }}
          >
            <span className="text-sm leading-none">{it.glyph}</span>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
