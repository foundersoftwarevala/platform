import { cn } from "@/lib/utils";
import { RARITY_META, type Rarity } from "@/lib/ams/types";

export function RarityBadge({ rarity, className }: { rarity: Rarity; className?: string }) {
  const meta = RARITY_META[rarity];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
        className,
      )}
      style={{
        color: meta.hue,
        borderColor: `${meta.hue}55`,
        background: `${meta.hue}11`,
        boxShadow: meta.tier >= 5 ? `0 0 12px -2px ${meta.glow}` : undefined,
      }}
    >
      {meta.label}
    </span>
  );
}
