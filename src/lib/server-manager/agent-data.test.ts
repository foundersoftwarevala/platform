import { describe, expect, it } from 'vitest';
import { parseAgentMetricRows } from './agent-data';

const metric = {
  server_id: 'server-1',
  agent_id: 'agent-1',
  recorded_at: '2026-10-20T10:00:00.000Z',
  cpu_usage: 42,
  ram_usage: 51,
  disk_usage: 20,
  network_in_mbps: 1.5,
  network_out_mbps: 2.5,
  uptime_seconds: 3600,
};

describe('parseAgentMetricRows', () => {
  it('accepts well-formed agent metric history', () => {
    expect(parseAgentMetricRows([metric])).toEqual([metric]);
  });

  it('rejects rows that do not prove agent provenance', () => {
    const { agent_id: _agentId, ...legacyMetric } = metric;
    expect(() => parseAgentMetricRows([legacyMetric])).toThrow('Agent metrics response is invalid.');
  });

  it('rejects invalid timestamps and non-finite metrics', () => {
    expect(() => parseAgentMetricRows([{ ...metric, recorded_at: 'invalid' }])).toThrow();
    expect(() => parseAgentMetricRows([{ ...metric, cpu_usage: Number.NaN }])).toThrow();
    expect(() => parseAgentMetricRows([{ ...metric, cpu_usage: 101 }])).toThrow();
    expect(() => parseAgentMetricRows([{ ...metric, network_in_mbps: -1 }])).toThrow();
    expect(() => parseAgentMetricRows([{ ...metric, recorded_at: new Date(Date.now() + 60_000).toISOString() }])).toThrow();
  });
});
