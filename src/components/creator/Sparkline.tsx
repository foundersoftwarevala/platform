import type { MetricSeriesPoint } from "@/lib/creator/types";

export function Sparkline({
  data,
  stroke = "currentColor",
  fill,
  height = 36,
  width = 120,
  strokeWidth = 1.75,
}: {
  data: MetricSeriesPoint[];
  stroke?: string;
  fill?: string;
  height?: number;
  width?: number;
  strokeWidth?: number;
}) {
  if (!data || data.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full opacity-40">
        <line
          x1="0"
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke="currentColor"
          strokeDasharray="2 3"
          strokeWidth="1"
        />
      </svg>
    );
  }

  const values = data.map((d) => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((d, i) => {
    const x = i * stepX;
    const y = height - ((d.v - min) / span) * (height - 4) - 2;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full" preserveAspectRatio="none">
      {fill && <path d={area} fill={fill} />}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
