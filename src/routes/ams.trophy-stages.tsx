import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { TrophyStageGallery } from "@/components/ams/collectible/TrophyStageGallery";
import { DuplicateSilhouetteChecker } from "@/components/ams/collectible/DuplicateSilhouetteChecker";
import { RoleCredentialWall } from "@/components/ams/collectible/RoleCredentialWall";
import { TROPHIES, ROLE_LIST } from "@/lib/ams/trophy-catalog";

export const Route = createFileRoute("/ams/trophy-stages")({
  head: () => ({
    meta: [
      { title: "Trophy Stage Vault — 180 Staged Role Trophies" },
      {
        name: "description",
        content:
          "Every role progression stage rendered as a distinct museum-grade trophy, with tier filters, 3D inspection and a duplicate silhouette checker.",
      },
      { property: "og:title", content: "Trophy Stage Vault — 180 Staged Role Trophies" },
      {
        property: "og:description",
        content: "18 roles × 10 escalating stages of Software Vala branded trophies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-400/80">
            Trophy Stage Vault
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-foreground lg:text-4xl">
            Staged Trophy Progression Collection
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Ten escalating trophies for every role — Foundation through Legacy — each a distinct
            silhouette, sealed with the Software Vala mark and collection number.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>
            {ROLE_LIST.length} roles · {TROPHIES.length} stages
          </span>
        </div>
      </header>

      <TrophyStageGallery />
      <RoleCredentialWall />
      <DuplicateSilhouetteChecker />
    </div>
  );
}
