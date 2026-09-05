// Detail modal for the Role Achievement Showcase.
// Opens when a showcase card is clicked and presents the real artwork plus the
// full description, unlock criteria and Software Vala collection metadata.

import { EnterpriseDialog } from "@/components/ams/ui/EnterpriseDialog";
import { SVSeal, SVMicroMark, svCollectionNumber } from "@/components/ams/brand/SVMark";
import type { RoleDNA } from "@/lib/ams/roles";

export type ShowcaseKind =
  | "Signature Trophy" | "Latest Award" | "Featured Badge" | "Current Rank"
  | "Digital Passport" | "Certificate" | "Membership" | "Identity Card"
  | "Trust Seal" | "Legacy Medal" | "Honor Coin" | "XP Crystal"
  | "Reward Chest" | "Guardian Shield";

export interface ShowcaseItem {
  kind: ShowcaseKind;
  label: string;
  src: string;
  /** Stable seed for the collection number. */
  seed: string;
}

const RARITY: Record<ShowcaseKind, string> = {
  "Signature Trophy": "Legendary",
  "Latest Award": "Elite",
  "Featured Badge": "Rare",
  "Current Rank": "Elite",
  "Digital Passport": "Identity",
  Certificate: "Official",
  Membership: "Elite",
  "Identity Card": "Identity",
  "Trust Seal": "Verified",
  "Legacy Medal": "Legendary",
  "Honor Coin": "Rare",
  "XP Crystal": "Rare",
  "Reward Chest": "Uncommon",
  "Guardian Shield": "Elite",
};

function describe(role: RoleDNA, item: ShowcaseItem): string {
  switch (item.kind) {
    case "Signature Trophy":
      return `${item.label} is the ${role.trophyStyle.toLowerCase()} centrepiece of the ${role.name} cabinet. ${role.philosophy}`;
    case "Latest Award":
      return `${item.label} belongs to the ${role.awardStyle.toLowerCase()} series, presented for outcomes that match: ${role.successDefinition}`;
    case "Featured Badge":
      return `${item.label} is worn on the ${role.name} crest to mark verified capability. ${role.mission}`;
    case "Current Rank":
      return `${item.label} is the standing rank in the ${role.name} progression ladder. ${role.vision}`;
    case "Digital Passport":
      return `The ${role.name} passport carries ${role.passport.cover} artwork with a ${role.passport.stamp} stamp and records every chapter of the journey.`;
    case "Certificate":
      return `${item.label} is an officially sealed ${role.name} certificate, countersigned by Software Vala. ${role.legacyLine}`;
    case "Membership":
      return `${item.label} membership grants tier privileges across the ${role.name} world. ${role.motivation}`;
    case "Identity Card":
      return `The ${role.name} identity card proves clearance level ${role.passport.verification} inside AMS Manager.`;
    default:
      return `${item.label} — a ${item.kind.toLowerCase()} minted for the ${role.name} collection. ${role.philosophy}`;
  }
}

function criteria(role: RoleDNA, item: ShowcaseItem): string[] {
  const stage = role.journey[Math.min(4, role.journey.length - 1)];
  switch (item.kind) {
    case "Signature Trophy":
      return [
        `Reach the ${stage.label} stage: ${stage.narrative}`,
        `Hold all ${role.trophies.length} tier trophies up to ${item.label}`,
        `Sustain the pillars: ${role.reputationPillars.slice(0, 2).join(", ")}`,
      ];
    case "Latest Award":
      return [
        `Deliver measurable ${role.language[0] ?? "impact"} in an active season`,
        `Nominated and reviewed inside the ${role.awardStyle}`,
        `Maintain ${role.reputationPillars[0]} with no open disputes`,
      ];
    case "Featured Badge":
      return [
        `Complete the ${role.name} verification track`,
        `Demonstrate ${role.behavior.join(" · ")}`,
        `Keep the badge active with recurring contribution`,
      ];
    case "Current Rank":
      return [
        `Progress through: ${role.careerPath.slice(0, 3).join(" → ")}`,
        `Meet the XP threshold for the ${item.label} band`,
        `No rank decay in the trailing season`,
      ];
    case "Digital Passport":
      return role.passport.timeline.map((t) => `Chapter unlocked: ${t}`);
    case "Certificate":
      return [
        `Complete the ${item.label} assessment`,
        `Verification level: ${role.passport.verification}`,
        `Signed off with: ${role.signature}`,
      ];
    case "Membership":
      return [
        `Hold an active ${role.name} profile in good standing`,
        `Qualify for the ${item.label} tier`,
        `Renewed each season on performance review`,
      ];
    case "Identity Card":
      return [
        `Identity verified at ${role.passport.verification}`,
        `Role assigned: ${role.name} (${role.archetype})`,
        `Clearance reviewed on every privilege change`,
      ];
    default:
      return [
        `Earned inside the ${role.name} collection track`,
        `Requires: ${role.successDefinition}`,
        `Recognised at the ${stage.label} stage and above`,
      ];
  }
}

export function ShowcaseDetailDialog({
  role, item, onOpenChange,
}: { role: RoleDNA; item: ShowcaseItem | null; onOpenChange: (open: boolean) => void }) {
  const accent = role.accent;
  const open = item !== null;

  return (
    <EnterpriseDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      eyebrow={`${role.name} · ${item?.kind ?? ""}`}
      title={item?.label ?? ""}
      icon={<SVSeal accent={accent} size={20} />}
      cancelLabel="Close"
    >
      {item && (
        <div className="grid gap-5 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
          <div
            className="relative grid aspect-square place-items-center overflow-hidden rounded-xl border p-3"
            style={{
              borderColor: `color-mix(in oklab, ${accent} 40%, var(--border))`,
              background: `radial-gradient(110% 80% at 50% 105%, color-mix(in oklab, ${accent} 30%, transparent), transparent 68%), linear-gradient(180deg, var(--card), var(--background))`,
              boxShadow: `inset 0 0 60px color-mix(in oklab, ${accent} 16%, transparent)`,
            }}
          >
            <img
              src={item.src}
              alt={`${role.name} ${item.kind} — ${item.label}`}
              decoding="async"
              className="max-h-full w-auto object-contain"
              style={{
                filter: `saturate(1.18) contrast(1.06) drop-shadow(0 20px 28px rgba(0,0,0,0.65)) drop-shadow(0 0 24px color-mix(in oklab, ${accent} 52%, transparent))`,
              }}
            />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <SVMicroMark accent={accent} />
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <section>
              <h3 className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Description</h3>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">{describe(role, item)}</p>
            </section>

            <section>
              <h3 className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Unlock criteria</h3>
              <ul className="mt-1.5 space-y-1.5">
                {criteria(role, item).map((c) => (
                  <li key={c} className="flex gap-2 text-[13px] leading-snug text-foreground/85">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
                    />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Collection metadata</h3>
              <dl className="mt-1.5 grid gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-2">
                <Meta label="Collection No." value={svCollectionNumber(item.seed, role.passportPrefix)} accent={accent} mono />
                <Meta label="Type" value={item.kind} accent={accent} />
                <Meta label="Rarity" value={RARITY[item.kind]} accent={accent} />
                <Meta label="Role" value={`${role.name} · ${role.archetype}`} accent={accent} />
                <Meta label="Holder ID" value={`${role.passportPrefix}-00001`} accent={accent} mono />
                <Meta label="Verification" value={role.passport.verification} accent={accent} />
                <Meta label="Signature" value={role.signature} accent={accent} />
                <Meta label="Issuer" value="Software Vala" accent={accent} />
              </dl>
            </section>
          </div>
        </div>
      )}
    </EnterpriseDialog>
  );
}

function Meta({
  label, value, accent, mono,
}: { label: string; value: string; accent: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 border-b border-border/40 pb-1">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`truncate text-right ${mono ? "font-mono text-[11px]" : ""}`} style={{ color: accent }}>{value}</dd>
    </div>
  );
}
