export type AgentOs = "linux" | "windows" | "other";

export interface EnrollmentInput {
  serverName: string;
  os: AgentOs;
  provider: string | null;
  region: string | null;
  enrollmentKey: string;
  agentToken: string;
}

export interface AgentHeartbeat {
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  network_in_mbps: number;
  network_out_mbps: number;
  uptime_seconds: number;
  failed_logins: number | null;
  open_ports: number[] | null;
  patch_status: "unknown" | "up_to_date" | "updates_available";
  suspicious_process: boolean | null;
  timestamp: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^sv_agent_[0-9a-f]{64}$/;
const HEARTBEAT_KEYS = [
  "cpu_usage",
  "ram_usage",
  "disk_usage",
  "network_in_mbps",
  "network_out_mbps",
  "uptime_seconds",
  "failed_logins",
  "open_ports",
  "patch_status",
  "suspicious_process",
  "timestamp",
] as const;
const SORTED_HEARTBEAT_KEYS = [...HEARTBEAT_KEYS].sort();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function generateAgentToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `sv_agent_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseEnrollmentInput(value: unknown): EnrollmentInput | null {
  if (!isRecord(value)) return null;
  if (
    Object.keys(value).some(
      (key) =>
        !["serverName", "os", "provider", "region", "enrollmentKey", "agentToken"].includes(key),
    )
  )
    return null;
  const { serverName, os, provider, region, enrollmentKey, agentToken } = value;
  if (
    typeof serverName !== "string" ||
    serverName.trim().length < 1 ||
    serverName.trim().length > 100
  )
    return null;
  if (os !== "linux" && os !== "windows" && os !== "other") return null;
  if (
    provider !== null &&
    provider !== undefined &&
    (typeof provider !== "string" || provider.length > 100)
  )
    return null;
  if (
    region !== null &&
    region !== undefined &&
    (typeof region !== "string" || region.length > 100)
  )
    return null;
  if (typeof enrollmentKey !== "string" || !UUID_PATTERN.test(enrollmentKey)) return null;
  if (typeof agentToken !== "string" || !TOKEN_PATTERN.test(agentToken)) return null;

  return {
    serverName: serverName.trim(),
    os,
    provider: typeof provider === "string" && provider.trim() ? provider.trim() : null,
    region: typeof region === "string" && region.trim() ? region.trim() : null,
    enrollmentKey,
    agentToken,
  };
}

export function isAgentHeartbeat(value: unknown): value is AgentHeartbeat {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== SORTED_HEARTBEAT_KEYS.length ||
    keys.some((key, index) => key !== SORTED_HEARTBEAT_KEYS[index])
  ) {
    return false;
  }

  const percentages = [value.cpu_usage, value.ram_usage, value.disk_usage];
  if (percentages.some((n) => !isFiniteNumber(n) || n < 0 || n > 100)) return false;
  const networkIn = value.network_in_mbps;
  const networkOut = value.network_out_mbps;
  const uptimeSeconds = value.uptime_seconds;
  const failedLogins = value.failed_logins;
  if (
    !isFiniteNumber(networkIn) ||
    networkIn < 0 ||
    networkIn > 99_999_999.99 ||
    !isFiniteNumber(networkOut) ||
    networkOut < 0 ||
    networkOut > 99_999_999.99 ||
    !isFiniteNumber(uptimeSeconds) ||
    !Number.isSafeInteger(uptimeSeconds) ||
    (failedLogins !== null &&
      (!isFiniteNumber(failedLogins) || failedLogins < 0 || !Number.isInteger(failedLogins))) ||
    (value.open_ports !== null &&
      (!Array.isArray(value.open_ports) || value.open_ports.length > 1024))
  )
    return false;
  if (
    Array.isArray(value.open_ports) &&
    value.open_ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)
  )
    return false;
  if (
    value.patch_status !== "unknown" &&
    value.patch_status !== "up_to_date" &&
    value.patch_status !== "updates_available"
  ) {
    return false;
  }
  if (
    (value.suspicious_process !== null && typeof value.suspicious_process !== "boolean") ||
    typeof value.timestamp !== "string"
  )
    return false;
  return Number.isFinite(Date.parse(value.timestamp));
}

export function parseIdempotencyKey(value: string | null): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}
