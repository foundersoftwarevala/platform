import type { AgentMetricRow } from '@/lib/server-manager/agent-data';

interface TelemetryTrendProps {
  samples: AgentMetricRow[];
  metric: 'cpu_usage' | 'ram_usage' | 'disk_usage';
  label: string;
}

export function TelemetryTrend({ samples, metric, label }: TelemetryTrendProps) {
  if (samples.length === 0) {
    return <p className="text-muted-foreground text-sm">Waiting for fresh agent data.</p>;
  }

  const ordered = [...samples].sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
  const byTime = new Map<string, number[]>();
  for (const sample of ordered) {
    const valuesAtTime = byTime.get(sample.recorded_at) ?? [];
    valuesAtTime.push(sample[metric]);
    byTime.set(sample.recorded_at, valuesAtTime);
  }
  const values = [...byTime.values()].map((atTime) =>
    atTime.reduce((sum, value) => sum + value, 0) / atTime.length,
  );
  const points = values.map((value, index) => {
    const x = values.length < 2 ? 50 : (index / (values.length - 1)) * 100;
    const y = 96 - value * 0.92;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div>
      <svg
        className="h-32 w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} agent telemetry trend`}
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="text-primary"
        />
      </svg>
      <p className="text-xs text-muted-foreground">
        Source: Agent · {values.length} samples · Latest {values.at(-1)?.toFixed(1)}%
      </p>
    </div>
  );
}
