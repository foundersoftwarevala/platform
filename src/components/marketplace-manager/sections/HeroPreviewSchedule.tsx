// Storefront-accurate hero preview + scheduling controls for the Hero Banner Manager.
import { useState } from "react";
import {
  X, Monitor, Tablet, Smartphone, ArrowRight, Clock, Rocket, CalendarClock, Loader2, Ban,
} from "lucide-react";
import { PillButton } from "../ui";
import { iconFromName, isSlideLive, type HeroSlideRow } from "@/lib/hero-slides";
import {
  TIMEZONES, browserTimezone, wallToUtcIso, utcIsoToWall, formatInTz, relativeFromNow,
} from "@/lib/timezone";

const DEVICES = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: "100%" },
  { id: "tablet", label: "Tablet", icon: Tablet, width: "820px" },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: "390px" },
] as const;
type DeviceId = (typeof DEVICES)[number]["id"];

/** Renders the slide exactly as the storefront hero carousel does. */
export function HeroStorefrontFrame({ slide, compact }: { slide: HeroSlideRow; compact?: boolean }) {
  const Icon = iconFromName(slide.icon ?? "Sparkles");
  const highlight = slide.highlight?.trim();
  const headline = slide.headline ?? "";
  const parts = highlight && headline.includes(highlight) ? headline.split(highlight) : null;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${slide.bg_gradient}`}>
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_25%_40%,white,transparent_60%)]" />
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className={`relative ${compact ? "px-6 py-8" : "px-8 py-14 sm:px-12 sm:py-20"}`}>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur ${slide.ring_class} ${slide.badge_class}`}>
          <Icon className={`h-3.5 w-3.5 ${slide.accent_class}`} />
          {slide.kicker || "Kicker"}
        </div>

        <h2 className={`mt-5 font-bold leading-tight text-white ${compact ? "text-2xl" : "text-3xl sm:text-5xl"}`}>
          {parts ? (
            <>
              {parts[0]}
              <span className={slide.accent_class}>{highlight}</span>
              {parts.slice(1).join(highlight)}
            </>
          ) : (
            headline || "Headline preview"
          )}
        </h2>

        <p className={`mt-4 max-w-2xl text-white/75 ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
          {slide.sub || "Sub headline preview"}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[oklch(0.18_0.06_262)]">
            {slide.cta_label || "Learn more"} <ArrowRight className="h-4 w-4" />
          </span>
          {slide.secondary_label && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur">
              {slide.secondary_label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function HeroPreviewModal({ slide, onClose }: { slide: HeroSlideRow; onClose: () => void }) {
  const [device, setDevice] = useState<DeviceId>("desktop");
  const dev = DEVICES.find((d) => d.id === device)!;
  const live = isSlideLive(slide);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">Storefront preview · {slide.headline || slide.slug}</div>
            <div className="text-[11px] text-muted-foreground">
              {live ? "Currently live on the homepage" : "Not currently visible to visitors"} · slot #{slide.sort_order}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full border border-border bg-background/40 p-1">
              {DEVICES.map((d) => {
                const I = d.icon;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDevice(d.id)}
                    title={d.label}
                    className={`inline-flex h-7 w-8 items-center justify-center rounded-full transition ${
                      device === d.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <I className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
            <button onClick={onClose} className="rounded-md p-1 hover:bg-muted" aria-label="Close preview">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="bg-[oklch(0.12_0.03_262)] p-5">
          <div className="mx-auto transition-all" style={{ width: dev.width, maxWidth: "100%" }}>
            <HeroStorefrontFrame slide={slide} compact={device !== "desktop"} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          <span>CTA → {slide.cta_href || "/marketplace"}</span>
          <PillButton variant="ghost" onClick={onClose}>Close</PillButton>
        </div>
      </div>
    </div>
  );
}

export function HeroScheduleModal({
  slide, busy, onClose, onSave,
}: {
  slide: HeroSlideRow;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: Partial<HeroSlideRow>) => void;
}) {
  const [tz, setTz] = useState<string>(() => {
    const b = browserTimezone();
    return TIMEZONES.includes(b as (typeof TIMEZONES)[number]) ? b : "UTC";
  });
  const [publishAt, setPublishAt] = useState<string | null>(slide.publish_at);
  const [unpublishAt, setUnpublishAt] = useState<string | null>(slide.unpublish_at);

  const publishNow = () =>
    onSave({ status: "published", enabled: true, publish_at: new Date().toISOString(), unpublish_at: null });

  const reschedule = () => {
    if (!publishAt) {
      onSave({ publish_at: null, unpublish_at: unpublishAt });
      return;
    }
    const future = new Date(publishAt).getTime() > Date.now();
    onSave({
      publish_at: publishAt,
      unpublish_at: unpublishAt,
      status: future ? "scheduled" : "published",
      enabled: true,
    });
  };

  const clearSchedule = () => onSave({ publish_at: null, unpublish_at: null });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-sm">
      <div className="my-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="inline-flex items-center gap-2 text-sm font-bold">
            <CalendarClock className="h-4 w-4 text-accent" /> Schedule · {slide.headline || slide.slug}
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Timezone</div>
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Times below are entered in this timezone and stored in UTC.
            </p>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Publish at</div>
            <input
              type="datetime-local"
              value={utcIsoToWall(publishAt, tz)}
              onChange={(e) => setPublishAt(wallToUtcIso(e.target.value, tz))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatInTz(publishAt, tz)} {publishAt ? `· ${relativeFromNow(publishAt)}` : ""}
            </p>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unpublish at</div>
            <input
              type="datetime-local"
              value={utcIsoToWall(unpublishAt, tz)}
              onChange={(e) => setUnpublishAt(wallToUtcIso(e.target.value, tz))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatInTz(unpublishAt, tz)} {unpublishAt ? `· ${relativeFromNow(unpublishAt)}` : ""}
            </p>
          </div>

          <div className="md:col-span-2 rounded-xl border border-border bg-background/40 p-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <Clock className="h-3.5 w-3.5" /> Current state
            </span>
            <div className="mt-1">
              Status <b className="text-foreground">{slide.status}</b> · {slide.enabled ? "enabled" : "disabled"} ·{" "}
              {isSlideLive(slide) ? "live now" : "not live"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <PillButton variant="ghost" onClick={clearSchedule}>
            <span className="inline-flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" /> Clear schedule</span>
          </PillButton>
          <PillButton variant="ghost" onClick={publishNow}>
            <span className="inline-flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5" /> Publish now</span>
          </PillButton>
          <PillButton variant="primary" onClick={reschedule}>
            <span className="inline-flex items-center gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
              Reschedule
            </span>
          </PillButton>
        </div>
      </div>
    </div>
  );
}
