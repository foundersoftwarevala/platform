import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("real gate CLI with isolated application/pg tools", () => {
  it.each([
    ["--expected-hreflang", "0"],
    ["--expected-hreflang", "-1"],
    ["--expected-hreflang", "1.5"],
    ["--expected-hreflang", "abc"],
    ["--kind", "product", "--expected-hreflang", "80"],
    ["--cross-only", "--expected-hreflang", "80"],
  ])("rejects invalid or unused fallback arguments %s", (...args) => {
    const result = spawnSync(
      process.execPath,
      [resolve("scripts", "ops", "seo-gate-run.mjs"), ...args],
      { encoding: "utf8" },
    );
    if (result.error) throw result.error;
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("hreflang fallback");
    expect(result.stderr).not.toContain("Application gate/catalogue");
  });
  it.each([
    "dry",
    "drop",
    "legacy",
    "backup-fail",
    "hreflang-fallback",
    "unsupported-fallback",
    "unsupported-report",
  ])("%s cannot save gate or audit rows", (scenario) => {
    const directory = mkdtempSync(join(tmpdir(), "sv-gate-test-"));
    const root = join(directory, "backups");
    mkdirSync(root);
    for (let at = 1; at <= 9; at++) {
      const old = join(root, `gate-20261001T00000${at}000Z`);
      mkdirSync(old);
      for (const name of ["gate.dump", "SHA256SUMS", "restore.sh"])
        writeFileSync(join(old, name), "fixture");
    }
    mkdirSync(join(root, "kaam2b-manual"));
    const calls = join(directory, "calls.jsonl");
    writeFileSync(calls, "");
    const preload = `
      import fs from "node:fs";
      import cp from "node:child_process";
      import { syncBuiltinESMExports } from "node:module";
      cp.execFileSync = (command, args) => {
        if (command === "pg_dump") {
          if(process.env.FIXTURE_CASE === "backup-fail") throw new Error("fixture backup failure");
          fs.writeFileSync(args[args.indexOf("--file")+1], "dump fixture"); return "";
        }
        if (command === "pg_restore") return "TABLE DATA public seo_indexing_decisions fixture\\nTABLE DATA public seo_fingerprints fixture\\n";
        throw new Error("unexpected child command");
      };
      syncBuiltinESMExports();
      globalThis.fetch = async (raw, init) => {
        const url = new URL(raw);
        fs.appendFileSync(process.env.FIXTURE_CALLS, JSON.stringify({url:String(url),method:init?.method})+"\\n");
        const phase = url.searchParams.get("phase");
        if (phase === "preflight") return Response.json(process.env.FIXTURE_CASE === "legacy"
          ? {decisions:100} : {protocol:2,dryRun:true,atomicCommit:true,detailedReport:process.env.FIXTURE_CASE !== "unsupported-report",
            hreflangFallback:process.env.FIXTURE_CASE !== "unsupported-fallback",
            database:"fixture",signature:"a".repeat(32),decisions:[]});
        if (phase === "evaluate") {
          if (url.searchParams.get("dry_run") !== "1") throw new Error("saving evaluation");
          if(process.env.FIXTURE_CASE === "hreflang-fallback" && url.searchParams.get("expected_hreflang") !== "80")
            throw new Error("fallback not forwarded");
          return Response.json({protocol:2,dryRun:true,evaluated:1,done:true,rows:[{url:"/a"}],fingerprints:[],
            warnings:process.env.FIXTURE_CASE === "hreflang-fallback"?["fixture sibling query unavailable; explicit fallback 80"]:[],
            hreflangFallbackPages:process.env.FIXTURE_CASE === "hreflang-fallback"?1:0});
        }
        if (phase === "plan") return Response.json({protocol:2,saved:false,stopped:process.env.FIXTURE_CASE === "drop",
          evaluated:1,currentTotal:100,projectedTotal:100,currentBlocked:0,
          projectedBlocked:process.env.FIXTURE_CASE === "drop"?5:0,
          projectedIneligible:process.env.FIXTURE_CASE === "drop"?5:0,
          currentByState:{READY_FOR_INDEX:100},
          projectedByState:process.env.FIXTURE_CASE === "drop"?{READY_FOR_INDEX:95,BLOCKED:5}:{READY_FOR_INDEX:100},
          currentEligible:100,projectedEligible:process.env.FIXTURE_CASE === "drop"?95:100,
          lossPercent:process.env.FIXTURE_CASE === "drop"?5:0,verdictChanges:5});
        throw new Error("unexpected write request "+String(url));
      };
    `;
    try {
      let output = "";
      let exit = 0;
      {
        const result = spawnSync(
          process.execPath,
          [
            "--import",
            `data:text/javascript,${encodeURIComponent(preload)}`,
            resolve("scripts", "ops", "seo-gate-run.mjs"),
            "--kind",
            "slot",
            "--slice",
            "50",
            "--dry-run",
            "--max-drop-percent",
            "2",
            ...(["hreflang-fallback", "unsupported-fallback"].includes(scenario)
              ? ["--expected-hreflang", "80"]
              : []),
          ],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              SUPABASE_URL: "http://fixture.invalid",
              SUPABASE_SERVICE_ROLE_KEY: "fixture",
              INTERNAL_API_TOKEN: "fixture",
              SEO_STORE: "vps",
              VPS_DATABASE_URL: "postgres://fixture@localhost/fixture",
              SEO_GATE_BACKUP_ROOT: root,
              FIXTURE_CALLS: calls,
              FIXTURE_CASE: scenario,
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        if (result.error) throw result.error;
        if (result.status === null) throw new Error(`CLI terminated by signal ${result.signal}`);
        exit = result.status;
        output = `${result.stdout}${result.stderr}`;
      }
      expect(exit).toBe(
        ["dry", "hreflang-fallback"].includes(scenario) ? 0 : scenario === "drop" ? 2 : 1,
      );
      const requests: { url: string; method: string }[] = readFileSync(calls, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      expect(
        requests.every(
          (request) => !request.url.includes("phase=commit") && !request.url.includes("/rest/v1/"),
        ),
      ).toBe(true);
      expect(readdirSync(root)).toContain("kaam2b-manual");
      expect(readdirSync(root)).not.toContain(".gate-run.lock");
      if (["legacy", "unsupported-fallback", "unsupported-report"].includes(scenario)) {
        expect(requests).toHaveLength(1);
        expect(output).toContain(
          scenario === "legacy"
            ? "protocol is not deployed"
            : scenario === "unsupported-report"
              ? "Detailed gate report capability is not deployed"
              : "fallback capability is not deployed",
        );
      } else if (scenario === "backup-fail") {
        expect(requests.every((call) => call.url.includes("phase=preflight"))).toBe(true);
        expect(output).toContain("fixture backup failure");
      } else {
        const backups = readdirSync(root).filter((name) => name.startsWith("gate-"));
        expect(backups).toHaveLength(7);
        const newest = join(root, backups.sort().at(-1)!);
        const checksum = createHash("sha256")
          .update(readFileSync(join(newest, "gate.dump")))
          .digest("hex");
        expect(readFileSync(join(newest, "SHA256SUMS"), "utf8")).toContain(checksum);
        expect(readFileSync(join(newest, "restore.sh"), "utf8")).toContain("--single-transaction");
        expect(output).toContain(scenario === "drop" ? "NO SAVES" : "DRY RUN");
        const projected = JSON.parse(output.match(/PROJECTED (.+)/)![1]);
        expect(projected).toMatchObject({
          evaluated: 1,
          currentEligible: 100,
          projectedEligible: scenario === "drop" ? 95 : 100,
          projectedBlocked: scenario === "drop" ? 5 : 0,
          projectedIneligible: scenario === "drop" ? 5 : 0,
          currentByState: { READY_FOR_INDEX: 100 },
        });
        if (scenario === "hreflang-fallback") {
          expect(output).toContain('"hreflangFallbackPages":1');
          expect(output).toContain("WARNING:");
        }
      }
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});
