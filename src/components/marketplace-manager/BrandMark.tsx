import logoAsset from "@/assets/software-vala-logo.asset.json";

/**
 * Real Software Vala brand mark with a 3D-ish glass ring, inner glow and
 * depth shadow. Used in the sidebar, header and hero banner.
 */
export function BrandMark({
  size = 36,
  className = "",
  glow = true,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-white/25 ${
        glow
          ? "shadow-[0_0_0_1px_oklch(1_0_0/0.12),0_10px_28px_-10px_oklch(0.62_0.19_255/0.85),inset_0_1px_0_oklch(1_0_0/0.6)]"
          : ""
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={logoAsset.url}
        alt="Software Vala"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <span className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_28%_18%,oklch(1_0_0/0.55),transparent_62%)]" />
    </span>
  );
}

export function BrandLockup({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandMark size={36} />
      {!collapsed && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold tracking-tight text-foreground">
            Software Vala
          </span>
          <span className="truncate text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            The Name of Trust
          </span>
        </span>
      )}
    </span>
  );
}
