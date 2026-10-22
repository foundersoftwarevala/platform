export type ServerHealth = 'live' | 'stale' | 'offline' | 'unknown';

const LIVE_WINDOW_MS = 90_000;
const OFFLINE_WINDOW_MS = 5 * 60_000;

export function getServerHealth(
  lastSeen: unknown,
  now = Date.now(),
): ServerHealth {
  if (typeof lastSeen !== 'string' && !(lastSeen instanceof Date)) return 'unknown';

  const lastSeenAt = lastSeen instanceof Date ? lastSeen.getTime() : Date.parse(lastSeen);
  if (!Number.isFinite(lastSeenAt) || lastSeenAt > now) return 'unknown';

  const age = now - lastSeenAt;
  if (age < LIVE_WINDOW_MS) return 'live';
  if (age <= OFFLINE_WINDOW_MS) return 'stale';
  return 'offline';
}
