import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Trophy, Award as AwardIcon, Crown, Sparkles } from "lucide-react";
import { RarityBadge } from "./RarityBadge";
import { StatusPill } from "./StatusPill";
import { DepartmentBadge } from "./DepartmentBadge";
import { ProceduralEmblem } from "./ProceduralEmblem";
import { RARITY_META, type Award } from "@/lib/ams/types";

const ICON: Record<Award["type"], typeof Trophy> = {
  trophy: Trophy, badge: AwardIcon, rank: Crown,
  milestone: Sparkles, achievement: AwardIcon, streak: Sparkles,
};

export function AwardCard({
  award, footer, className,
}: {
  award: Award;
  footer?: ReactNode;
  className?: string;
}) {
  const Icon = ICON[award.type];
  const meta = RARITY_META[award.rarity];
  return (
    <Link
      to="/awards/$id"
      params={{ id: award.id }}
      className={cn(
        "group surface-card motion-card award-reveal trophy-highlight focus-ring relative flex flex-col gap-3 p-4",
        className,
      )}
      style={{ boxShadow: meta.tier >= 5 ? `0 0 0 1px ${meta.hue}33, 0 18px 40px -22px ${meta.glow}` : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <RarityBadge rarity={award.rarity} />
          <StatusPill status={award.status} />
          <DepartmentBadge department={award.department} />
        </div>
        <Icon className="h-4 w-4 shrink-0" style={{ color: meta.hue }} />
      </div>
      <div className="relative grid h-36 place-items-center overflow-hidden rounded-md bg-background/40">
        {award.media.model3dUrl ? (
          <img src={award.media.model3dUrl} alt={award.name} className="h-32 transition-transform group-hover:scale-105" />
        ) : (
          <ProceduralEmblem award={award} size={140} className="transition-transform group-hover:scale-105" />
        )}
      </div>
      <div>
        <div className="text-sm font-semibold leading-tight">{award.name}</div>
        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{award.description || "No description provided."}</div>
      </div>
      <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="capitalize">{award.category}</span>
        <span className="font-mono tabular-nums" style={{ color: meta.hue }}>+{award.rewards.xp.toLocaleString()} XP</span>
      </div>
      {footer}
    </Link>
  );
}
