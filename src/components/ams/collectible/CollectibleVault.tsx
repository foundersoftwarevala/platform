import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Collectible3D } from "./Collectible3D";
import { RoleFilter, type RoleFilterValue } from "./RoleFilter";
import { VaultToolbar } from "./VaultToolbar";
import type { CelebrateKind } from "@/components/ams/effects/Celebration";
import type { RoleSlug } from "@/lib/ams/roles";
import { ROLES } from "@/lib/ams/roles";
import { PageHeader } from "@/components/ams/shared/PageHeader";


interface Props {
  kicker: string;
  title: string;
  description: string;
  suffix: string; // e.g. "reputation-medal"
  singular: string; // e.g. "Reputation Medal"
  assets: Record<RoleSlug, string>;
  unlockKind?: CelebrateKind;
  accent?: string;
}

export function CollectibleVault({
  kicker, title, description, suffix, singular, assets,
  unlockKind = "trophy", accent = "#facc15",
}: Props) {
  const [filter, setFilter] = useState<RoleFilterValue>("all");
  const visible = useMemo(
    () => (filter === "all" ? ROLES : ROLES.filter((r) => r.slug === filter)),
    [filter],
  );
  const exportItems = useMemo(
    () => visible.map((role) => ({ src: assets[role.slug], filename: `${role.slug}-${suffix}.png` })),
    [visible, assets, suffix],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={kicker}
        title={title}
        description={description}
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>{ROLES.length} {suffix.replace(/-/g, " ")}s · {visible.length} shown</span>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoleFilter value={filter} onChange={setFilter} />
        <VaultToolbar items={exportItems} accent={accent} exportLabel={`Export ${singular.toLowerCase()} set`} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((role) => (
          <article key={role.slug} className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/35">
            <Collectible3D
              src={assets[role.slug]}
              filename={`${role.slug}-${suffix}.png`}
              accent={role.accent}
              label={`${role.passportPrefix} · ${singular}`}
              height={340}
              showUnlock
              unlockKind={unlockKind}
              unlockTitle={`${role.name} ${singular} Unlocked`}
              unlockSubtitle={role.motto}
            />
            <div className="p-4">
              <div className="text-base font-semibold text-foreground">{role.name}</div>
              <div className="text-[11px] uppercase tracking-widest" style={{ color: `${role.accent}bb` }}>
                {role.archetype} · {singular}
              </div>
              <p className="mt-2 text-xs italic text-muted-foreground">"{role.motto}"</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

