import { describe, expect, it } from 'vitest';
import { getServerHealth } from './health';

const now = Date.parse('2026-10-20T12:00:00.000Z');

describe('getServerHealth', () => {
  it('classifies heartbeats younger than 90 seconds as live', () => {
    expect(getServerHealth(new Date(now - 89_999), now)).toBe('live');
  });

  it('classifies a 90-second heartbeat as stale', () => {
    expect(getServerHealth(new Date(now - 90_000), now)).toBe('stale');
  });

  it('keeps a heartbeat at five minutes stale and marks older heartbeats offline', () => {
    expect(getServerHealth(new Date(now - 5 * 60_000), now)).toBe('stale');
    expect(getServerHealth(new Date(now - 5 * 60_000 - 1), now)).toBe('offline');
  });

  it.each([null, undefined, '', 'not-a-timestamp', new Date(now + 1), 0])(
    'returns unknown for unusable last_seen value %s',
    (lastSeen) => {
      expect(getServerHealth(lastSeen, now)).toBe('unknown');
    },
  );
});
