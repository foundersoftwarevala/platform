import { Badge } from '@/components/ui/badge';
import { getServerHealth } from '@/lib/server-manager/health';

const styles = {
  live: 'border-accent-emerald/30 bg-accent-emerald/10 text-accent-emerald',
  stale: 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber',
  offline: 'border-destructive/30 bg-destructive/10 text-destructive',
  unknown: 'border-border bg-surface text-muted-foreground',
} as const;

export function ServerHealthBadge({ lastSeen }: { lastSeen?: string | null }) {
  const health = getServerHealth(lastSeen);
  const labels = { live: 'Live', stale: 'Stale', offline: 'Offline', unknown: 'Unknown' } as const;
  const label = labels[health];

  return (
    <Badge variant="outline" className={styles[health]} aria-label={`Server health: ${label}`}>
      {label}
    </Badge>
  );
}
