import { useId, useMemo, useState } from "react";

export type Point = { label: string; value: number };

function path(values: number[], w: number, h: number, pad = 2) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

/* ---------------- Sparkline ---------------- */
export function Sparkline({
  values, color = "currentColor", w = 96, h = 28, area = true,
}: { values: number[]; color?: string; w?: number; h?: number; area?: boolean }) {
  const d = useMemo(() => path(values, w, h), [values, w, h]);
  const id = `spk${useId().replace(/[:]/g, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={`${d} L${w - 2},${h} L2,${h} Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- Tooltip shell ---------------- */
function Tip({ x, y, children }: { x: string; y: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-lg"
      style={{ left: x, top: y - 6 }}
    >
      {children}
    </div>
  );
}

/* ---------------- Line chart ---------------- */
export function LineChart({
  data, height = 200, color = "oklch(0.72 0.2 265)", format = (n: number) => n.toLocaleString(),
}: { data: Point[]; height?: number; color?: string; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 600;
  const h = height;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const d = path(values, w, h - 22, 6);
  const xAt = (i: number) => 6 + (i / Math.max(1, data.length - 1)) * (w - 12);
  const yAt = (v: number) => (h - 22) - 6 - ((v - min) / span) * (h - 22 - 12);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} role="img" aria-label="Trend chart">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1="0" x2={w} y1={(h - 22) * (1 - g)} y2={(h - 22) * (1 - g)} stroke="currentColor" className="text-border" strokeWidth="1" strokeDasharray="3 5" />
        ))}
        <path d={`${d} L${w - 6},${h - 22} L6,${h - 22} Z`} fill={color} opacity="0.12" />
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((p, i) => (
          <g key={p.label}>
            <circle cx={xAt(i)} cy={yAt(p.value)} r={hover === i ? 5 : 3} fill={color} />
            <rect
              x={xAt(i) - (w / data.length) / 2} y="0" width={w / data.length} height={h - 22}
              fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            />
            <text x={xAt(i)} y={h - 6} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>{p.label}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <Tip x={`${(xAt(hover) / w) * 100}%`} y={(yAt(data[hover].value) / h) * height}>
          <span className="text-muted-foreground">{data[hover].label}</span> {format(data[hover].value)}
        </Tip>
      )}
    </div>
  );
}

/* ---------------- Bar chart ---------------- */
export function BarChart({
  data, height = 200, color = "oklch(0.7 0.18 200)", format = (n: number) => n.toLocaleString(), horizontal = false,
}: { data: Point[]; height?: number; color?: string; format?: (n: number) => string; horizontal?: boolean }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (horizontal) {
    return (
      <div className="space-y-2.5">
        {data.map((d) => (
          <div key={d.label} className="group">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate">{d.label}</span>
              <span className="font-semibold text-foreground">{format(d.value)}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${(d.value / max) * 100}%`, background: color }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="relative flex items-end gap-2" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="group flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
          <span className="opacity-0 group-hover:opacity-100 transition text-[10px] font-semibold text-foreground">{format(d.value)}</span>
          <div
            className="w-full rounded-t-lg transition-all duration-500 group-hover:brightness-125"
            style={{ height: `${Math.max(3, (d.value / max) * 100)}%`, background: `linear-gradient(180deg, ${color}, color-mix(in oklab, ${color} 45%, transparent))` }}
          />
          <span className="text-[10px] text-muted-foreground truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Pie / Donut ---------------- */
export function PieChart({
  data, size = 180, donut = false, format = (n: number) => n.toLocaleString(), colors,
}: { data: Point[]; size?: number; donut?: boolean; format?: (n: number) => string; colors?: string[] }) {
  const palette = colors ?? [
    "oklch(0.68 0.2 265)", "oklch(0.72 0.17 165)", "oklch(0.78 0.16 85)",
    "oklch(0.66 0.22 25)", "oklch(0.7 0.2 320)", "oklch(0.72 0.15 210)",
  ];
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const [hover, setHover] = useState<number | null>(null);
  const r = size / 2;
  const inner = donut ? r * 0.58 : 0;
  let acc = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Distribution chart">
          {data.map((d, i) => {
            const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
            acc += d.value;
            const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
            const large = a1 - a0 > Math.PI ? 1 : 0;
            const off = hover === i ? 4 : 0;
            const mid = (a0 + a1) / 2;
            const cx = r + Math.cos(mid) * off;
            const cy = r + Math.sin(mid) * off;
            // Fixed precision keeps SSR and client markup byte-identical.
            const n = (v: number) => v.toFixed(3);
            const p = [
              `M${n(cx + Math.cos(a0) * r)},${n(cy + Math.sin(a0) * r)}`,
              `A${n(r)},${n(r)} 0 ${large} 1 ${n(cx + Math.cos(a1) * r)},${n(cy + Math.sin(a1) * r)}`,
              inner
                ? `L${n(cx + Math.cos(a1) * inner)},${n(cy + Math.sin(a1) * inner)} A${n(inner)},${n(inner)} 0 ${large} 0 ${n(cx + Math.cos(a0) * inner)},${n(cy + Math.sin(a0) * inner)} Z`
                : `L${n(cx)},${n(cy)} Z`,
            ].join(" ");
            return (
              <path
                key={d.label} d={p} fill={palette[i % palette.length]}
                className="transition-all duration-300 cursor-default"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </svg>
        {donut && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-lg font-black text-foreground">{format(hover !== null ? data[hover].value : total)}</div>
              <div className="text-[10px] text-muted-foreground">{hover !== null ? data[hover].label : "Total"}</div>
            </div>
          </div>
        )}
      </div>
      <ul className="space-y-1.5 text-xs min-w-[140px]">
        {data.map((d, i) => (
          <li
            key={d.label}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2 rounded-md px-1.5 py-1 transition ${hover === i ? "bg-muted/60" : ""}`}
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: palette[i % palette.length] }} />
            <span className="text-muted-foreground flex-1">{d.label}</span>
            <span className="font-semibold text-foreground">{format(d.value)}</span>
            <span className="text-muted-foreground/70">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DonutChart(props: Omit<Parameters<typeof PieChart>[0], "donut">) {
  return <PieChart {...props} donut />;
}