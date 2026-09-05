import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Coins, Crown, Trophy, Award as AwardIcon, Zap, Gift, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { useCelebration } from "@/components/ams/effects/Celebration";
import {
  playCoin, playCoinDrop, playWin, playUnveil, playLevelUp,
  playRankUp, playFireworks, playDiamond, playMythic,
} from "@/lib/celebrate";

export const Route = createFileRoute("/ams/awards/effects")({
  head: () => ({
    meta: [
      { title: "Effects Library — AMS" },
      { name: "description", content: "Reusable animations and audio cues for every unlock, level-up, rank-up and reward across the platform." },
      { property: "og:title", content: "Effects Library — AMS" },
      { property: "og:description", content: "Reusable animations and audio cues for every unlock, level-up, rank-up and reward across the platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EffectsPage,
});

type Effect = {
  key: string; title: string; description: string; icon: typeof Sparkles;
  run: () => void;
};

function EffectsPage() {
  const { celebrate } = useCelebration();
  const [enabled] = useState(true);

  const effects: Effect[] = [
    { key: "confetti",     title: "Confetti Burst",    description: "Classic celebratory confetti.", icon: Sparkles, run: () => celebrate({ kind: "surprise", title: "Confetti", subtitle: "Surprise reward" }) },
    { key: "coin-rain",    title: "Coin Rain",         description: "Gold coin shower.",            icon: Coins,    run: () => celebrate({ kind: "firstSale", title: "Coin Rain", subtitle: "Economy reward" }) },
    { key: "fireworks",    title: "Fireworks",         description: "Sky-bursts for rank ups.",     icon: Star,     run: () => celebrate({ kind: "rankUp", title: "Fireworks", subtitle: "Rank elevated" }) },
    { key: "badge-unlock", title: "Badge Unlock",      description: "Spotlight reveal.",            icon: AwardIcon,run: () => celebrate({ kind: "badge", title: "New Badge", subtitle: "Badge unlocked" }) },
    { key: "trophy-unlock",title: "Trophy Unlock",     description: "Full-screen unveil.",          icon: Trophy,   run: () => celebrate({ kind: "trophy", title: "New Trophy", subtitle: "Trophy unlocked" }) },
    { key: "xp-pop",       title: "XP Pop",            description: "Floating XP gain.",            icon: Zap,      run: () => celebrate({ kind: "levelUp", title: "+250 XP", xp: 250 }) },
    { key: "reward-claim", title: "Reward Claim",      description: "Reward gift animation.",       icon: Gift,     run: () => celebrate({ kind: "achievement", title: "Reward Claimed", subtitle: "Sent to wallet" }) },
    { key: "milestone",    title: "Milestone",         description: "Diamond cascade.",             icon: Crown,    run: () => celebrate({ kind: "milestone", title: "Milestone Reached" }) },
  ];

  const sounds: { key: string; label: string; play: () => void }[] = [
    { key: "coin",      label: "Coin chime",   play: playCoin },
    { key: "coin-drop", label: "Coin drop",    play: playCoinDrop },
    { key: "win",       label: "Win fanfare",  play: playWin },
    { key: "unveil",    label: "Trophy unveil",play: playUnveil },
    { key: "level-up",  label: "Level up",     play: playLevelUp },
    { key: "rank-up",   label: "Rank up",      play: playRankUp },
    { key: "fireworks", label: "Fireworks",    play: playFireworks },
    { key: "diamond",   label: "Diamond",      play: playDiamond },
    { key: "mythic",    label: "Mythic gong",  play: playMythic },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        kicker="Award Management"
        title="Celebration effects & sounds"
        description="Reusable animations and audio cues for every unlock, level-up, rank-up and reward across the platform."
      />

      <section>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Animations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {effects.map((e) => {
            const Icon = e.icon;
            return (
              <div key={e.key} className="surface-card p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-trophy/15 text-trophy"><Icon className="h-4 w-4" /></span>
                  <div className="text-sm font-semibold">{e.title}</div>
                </div>
                <p className="text-xs text-muted-foreground flex-1">{e.description}</p>
                <Button variant="outline" size="sm" onClick={e.run} disabled={!enabled} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Trigger
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Sound effects</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {sounds.map((s) => (
            <Button key={s.key} variant="outline" onClick={s.play} className="justify-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-trophy" /> {s.label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
