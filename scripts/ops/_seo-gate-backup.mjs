import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export function backupGate(url, root = "/root/sv-seo-backup", expectedDatabase) {
  const connection = new URL(url);
  const database = decodeURIComponent(connection.pathname.slice(1));
  if (!/^[a-z][a-z0-9_]*$/.test(database) || database !== expectedDatabase)
    throw new Error("Backup database does not match the application's active gate store");
  const directory = resolve(root, `gate-${new Date().toISOString().replace(/[-:.]/g, "")}`);
  mkdirSync(directory, { recursive: false, mode: 0o700 });
  const dump = join(directory, "gate.dump");
  try {
    execFileSync(
      "pg_dump",
      [
        "--format=custom",
        "--table=public.seo_indexing_decisions",
        "--table=public.seo_fingerprints",
        "--file",
        dump,
      ],
      {
        env: {
          ...process.env,
          PGHOST: connection.hostname,
          PGPORT: connection.port || "5432",
          PGDATABASE: database,
          PGUSER: decodeURIComponent(connection.username),
          PGPASSWORD: decodeURIComponent(connection.password),
          PGSSLMODE: connection.searchParams.get("sslmode") || "prefer",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const listing = execFileSync("pg_restore", ["--list", dump], { encoding: "utf8" });
    for (const table of ["seo_indexing_decisions", "seo_fingerprints"])
      if (!listing.includes(`TABLE DATA public ${table} `))
        throw new Error(`Backup is missing ${table} data`);
    execFileSync("pg_restore", ["--file", "/dev/null", dump], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(
      `Gate backup failed; no evaluation/save permitted: ${error.stderr?.toString().trim() || error.message}`,
    );
  }
  const checksum = createHash("sha256").update(readFileSync(dump)).digest("hex");
  writeFileSync(join(directory, "SHA256SUMS"), `${checksum}  gate.dump\n`, { mode: 0o600 });
  if (createHash("sha256").update(readFileSync(dump)).digest("hex") !== checksum)
    throw new Error("Gate backup checksum verification failed");
  writeFileSync(
    join(directory, "restore.sh"),
    [
      "#!/bin/sh",
      "set -eu",
      'cd "$(dirname "$0")"',
      "sha256sum -c SHA256SUMS",
      "# Run as root on the original VPS; PostgreSQL owner restores ACLs too.",
      `test "\${PGDATABASE:-}" = "${database.replace(/"/g, '\\"')}"`,
      'sudo -u postgres pg_restore --dbname "$PGDATABASE" --clean --if-exists --single-transaction --exit-on-error < gate.dump',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  const completed = readdirSync(resolve(root), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^gate-\d{8}T\d{9}Z$/.test(entry.name))
    .filter((entry) => {
      const files = readdirSync(join(resolve(root), entry.name));
      return (
        files.includes("SHA256SUMS") && files.includes("gate.dump") && files.includes("restore.sh")
      );
    })
    .map((entry) => entry.name)
    .sort();
  const previous = completed.filter((name) => name !== basename(directory));
  for (const name of previous.slice(0, Math.max(0, previous.length - 6)))
    rmSync(join(resolve(root), name), { recursive: true });
  return { directory, checksum };
}
