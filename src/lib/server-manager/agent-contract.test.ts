import { describe, expect, it } from "vitest";
import {
  generateAgentToken,
  isAgentHeartbeat,
  parseEnrollmentInput,
  parseIdempotencyKey,
  sha256Hex,
  type AgentHeartbeat,
} from "./agent-contract";

const enrollment = {
  serverName: "production-web",
  os: "linux",
  provider: null,
  region: null,
  enrollmentKey: "eea95a32-2e5a-4cec-8a2b-a9d1ce6857c2",
  agentToken: `sv_agent_${"a".repeat(64)}`,
};

const heartbeat: AgentHeartbeat = {
  cpu_usage: 23.5,
  ram_usage: 41,
  disk_usage: 52,
  network_in_mbps: 1.2,
  network_out_mbps: 0.8,
  uptime_seconds: 3600,
  failed_logins: null,
  open_ports: null,
  patch_status: "updates_available",
  suspicious_process: null,
  timestamp: new Date().toISOString(),
};

describe("server agent enrollment contract", () => {
  it("accepts an owner enrollment with optional provider and region", () => {
    expect(parseEnrollmentInput(enrollment)).toEqual(enrollment);
  });

  it("rejects passwords and unexpected enrollment fields", () => {
    expect(parseEnrollmentInput({ ...enrollment, password: "must-not-be-accepted" })).toBeNull();
    expect(parseEnrollmentInput({ ...enrollment, serverName: " " })).toBeNull();
  });

  it("generates a high-entropy token in the expected wire format", () => {
    const token = generateAgentToken();
    expect(token).toMatch(/^sv_agent_[0-9a-f]{64}$/);
    expect(generateAgentToken()).not.toBe(token);
  });

  it("hashes the exact token without retaining a plaintext representation", async () => {
    await expect(sha256Hex("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("requires a UUID idempotency key", () => {
    expect(parseIdempotencyKey(enrollment.enrollmentKey)).toBe(enrollment.enrollmentKey);
    expect(parseIdempotencyKey("not-a-uuid")).toBeNull();
  });
});

describe("server agent heartbeat contract", () => {
  it("accepts the complete supported read-only payload", () => {
    expect(isAgentHeartbeat(heartbeat)).toBe(true);
  });

  it("rejects command, password, and unknown payload fields", () => {
    expect(isAgentHeartbeat({ ...heartbeat, command: "restart" })).toBe(false);
    expect(isAgentHeartbeat({ ...heartbeat, password: "secret" })).toBe(false);
  });

  it("rejects invalid percentages, ports, negative counters, and non-finite numbers", () => {
    expect(isAgentHeartbeat({ ...heartbeat, cpu_usage: 101 })).toBe(false);
    expect(isAgentHeartbeat({ ...heartbeat, open_ports: [0] })).toBe(false);
    expect(isAgentHeartbeat({ ...heartbeat, failed_logins: -1 })).toBe(false);
    expect(isAgentHeartbeat({ ...heartbeat, network_in_mbps: Number.NaN })).toBe(false);
  });

  it("rejects unsupported statuses and malformed timestamps", () => {
    expect(isAgentHeartbeat({ ...heartbeat, patch_status: "applied" })).toBe(false);
    expect(isAgentHeartbeat({ ...heartbeat, timestamp: "not-a-date" })).toBe(false);
  });
});
