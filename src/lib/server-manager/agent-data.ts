export interface AgentHeartbeatRow {
  server_id: string;
  status: 'pending_agent' | 'connected' | 'revoked';
  last_seen: string | null;
}

export interface AgentMetricRow {
  server_id: string;
  agent_id: string;
  recorded_at: string;
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  network_in_mbps: number;
  network_out_mbps: number;
  uptime_seconds: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isMetricRow(value: unknown): value is AgentMetricRow {
  if (!isRecord(value)) return false;
  const numericFields = [
    'cpu_usage',
    'ram_usage',
    'disk_usage',
    'network_in_mbps',
    'network_out_mbps',
    'uptime_seconds',
  ] as const;
  if (!numericFields.every((field) => isFiniteNumber(value[field]))) return false;
  const cpu = value.cpu_usage;
  const ram = value.ram_usage;
  const disk = value.disk_usage;
  const networkIn = value.network_in_mbps;
  const networkOut = value.network_out_mbps;
  const uptime = value.uptime_seconds;
  if (
    !isFiniteNumber(cpu) ||
    !isFiniteNumber(ram) ||
    !isFiniteNumber(disk) ||
    !isFiniteNumber(networkIn) ||
    !isFiniteNumber(networkOut) ||
    !isFiniteNumber(uptime)
  ) return false;
  return (
    typeof value.server_id === 'string' &&
    typeof value.agent_id === 'string' &&
    typeof value.recorded_at === 'string' &&
    Number.isFinite(Date.parse(value.recorded_at)) &&
    Date.parse(value.recorded_at) <= Date.now() &&
    cpu >= 0 && cpu <= 100 &&
    ram >= 0 && ram <= 100 &&
    disk >= 0 && disk <= 100 &&
    networkIn >= 0 &&
    networkOut >= 0 &&
    Number.isSafeInteger(uptime) && uptime >= 0
  );
}

export function parseAgentMetricRows(value: unknown): AgentMetricRow[] {
  if (!Array.isArray(value) || !value.every(isMetricRow)) {
    throw new Error('Agent metrics response is invalid.');
  }
  return value;
}

export async function loadAgentRows(accessToken: string): Promise<AgentHeartbeatRow[]> {
  const url = import.meta.env['VITE_SUPABASE_URL'];
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Agent status configuration is unavailable.');

  const response = await fetch(
    `${url.replace(/\/+$/, '')}/rest/v1/server_agents?select=server_id,status,last_seen`,
    { headers: { apikey: key, Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new Error('Agent status could not be loaded.');
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('Agent status response is invalid.');
  return rows.map((row): AgentHeartbeatRow => {
    if (
      typeof row !== 'object' ||
      row === null ||
      !('server_id' in row) ||
      typeof row.server_id !== 'string' ||
      !('status' in row) ||
      (row.status !== 'pending_agent' && row.status !== 'connected' && row.status !== 'revoked') ||
      !('last_seen' in row) ||
      (row.last_seen !== null && typeof row.last_seen !== 'string')
    ) {
      throw new Error('Agent status response is invalid.');
    }
    return { server_id: row.server_id, status: row.status, last_seen: row.last_seen };
  });
}

export async function loadAgentMetrics(
  accessToken: string,
  since: Date,
): Promise<AgentMetricRow[]> {
  const url = import.meta.env['VITE_SUPABASE_URL'];
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Agent metrics configuration is unavailable.');
  if (!Number.isFinite(since.getTime())) throw new RangeError('A valid telemetry start time is required.');

  const query = new URLSearchParams({
    select: 'server_id,agent_id,recorded_at,cpu_usage,ram_usage,disk_usage,network_in_mbps,network_out_mbps,uptime_seconds',
    agent_id: 'not.is.null',
    recorded_at: `gte.${since.toISOString()}`,
    order: 'recorded_at.desc',
    limit: '1000',
  });
  const response = await fetch(
    `${url.replace(/\/+$/, '')}/rest/v1/server_metrics_history?${query.toString()}`,
    { headers: { apikey: key, Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new Error('Agent metrics could not be loaded.');
  return parseAgentMetricRows(await response.json());
}
