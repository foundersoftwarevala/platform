#!/usr/bin/env python3
"""Software Vala — logical database backup.

Why this shape. There is no pg_dump on this server, no Postgres client, no
Supabase CLI, and no database password anywhere on disk. The Supabase project
reports pitr_enabled=false and zero stored backups, so nothing restorable
exists upstream either. What does exist is the service-role key, so the backup
is taken through PostgREST: every table, every row, paginated, gzipped, with a
manifest carrying a row count and a SHA-256 per table.

Honest limitation, stated here rather than discovered later: this is a
per-table export, so it is NOT a single-transaction snapshot. Tables are read
one after another and a write landing mid-run can leave two tables fractionally
out of step. For a catalogue that changes slowly this is a sound restore point;
it is not a substitute for PITR, which is the real fix and costs money.

The schema is not captured here — it is captured by schema-snapshot.sql, taken
through the Management API, because DDL cannot be read through PostgREST.

Usage:  sv-db-backup.py [--out DIR] [--keep N] [--verify]
"""
import argparse
import gzip
import hashlib
import json
import os
import pathlib
import shutil
import sys
import time
import urllib.error
import urllib.request

ENV_FILE = "/var/www/softwarevala/.env"
PAGE = 1000


def load_env(path=ENV_FILE):
    env = {}
    for line in pathlib.Path(path).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def request(url, headers, timeout=120):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, dict(r.headers), r.read()


def discover_tables(base, headers):
    """PostgREST publishes its own schema at the API root. That is the table
    list the application can actually see, which is exactly what a restore
    would need to put back."""
    status, _, body = request(f"{base}/rest/v1/", headers)
    doc = json.loads(body)
    paths = doc.get("paths", {})
    tables = sorted(
        p.lstrip("/") for p in paths
        if p.startswith("/") and p != "/" and "{" not in p and not p.startswith("/rpc/")
    )
    return tables


def dump_table(base, headers, table, fh):
    """Pages through a table and writes one JSON object per line."""
    offset, total = 0, 0
    while True:
        h = dict(headers)
        h["Range-Unit"] = "items"
        h["Range"] = f"{offset}-{offset + PAGE - 1}"
        url = f"{base}/rest/v1/{table}?select=*"
        try:
            status, hdrs, body = request(url, h)
        except urllib.error.HTTPError as e:
            return total, f"HTTP {e.code}: {e.read().decode()[:120]}"
        rows = json.loads(body)
        for row in rows:
            fh.write((json.dumps(row, separators=(",", ":"), default=str) + "\n").encode())
        total += len(rows)
        if len(rows) < PAGE:
            return total, None
        offset += PAGE


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/var/backups/softwarevala")
    ap.add_argument("--keep", type=int, default=7)
    ap.add_argument("--only", default=None, help="comma-separated table list, for testing")
    args = ap.parse_args()

    env = load_env()
    base = env["SUPABASE_URL"].rstrip("/")
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": "Bearer " + key, "Accept": "application/json"}

    stamp = time.strftime("%Y%m%d-%H%M%S")
    root = pathlib.Path(args.out) / stamp
    (root / "data").mkdir(parents=True, exist_ok=True)

    started = time.time()
    tables = discover_tables(base, headers)
    if args.only:
        wanted = set(args.only.split(","))
        tables = [t for t in tables if t in wanted]
    print(f"backup {stamp}: {len(tables)} tables discovered")

    manifest = {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "project": env.get("SUPABASE_PROJECT_ID", "unknown"),
        "method": "postgrest logical export (service role), gzipped JSONL per table",
        "consistency": "per-table, NOT a single-transaction snapshot",
        "tables": {},
        "totals": {},
    }
    total_rows, failures, empty = 0, [], 0

    for i, table in enumerate(tables, 1):
        path = root / "data" / f"{table}.jsonl.gz"
        with gzip.open(path, "wb") as fh:
            rows, err = dump_table(base, headers, table, fh)
        if err:
            failures.append({"table": table, "error": err})
            path.unlink(missing_ok=True)
            print(f"  [{i}/{len(tables)}] {table}: FAILED {err}")
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest["tables"][table] = {
            "rows": rows, "bytes": path.stat().st_size, "sha256": digest,
        }
        total_rows += rows
        if rows == 0:
            empty += 1
        if rows > 0 and i % 50 == 0:
            print(f"  [{i}/{len(tables)}] {table}: {rows} rows")

    manifest["totals"] = {
        "tables": len(manifest["tables"]),
        "failed": len(failures),
        "rows": total_rows,
        "empty_tables": empty,
        "seconds": round(time.time() - started, 1),
    }
    manifest["failures"] = failures

    (root / "manifest.json").write_text(json.dumps(manifest, indent=2))

    # The schema snapshot lives beside the data. It is refreshed separately,
    # by whoever holds the Management API token, and copied in.
    src = pathlib.Path("/root/sv-audit/phase2/schema-snapshot.sql")
    if src.exists():
        shutil.copy2(src, root / "schema-snapshot.sql")

    size = sum(f.stat().st_size for f in root.rglob("*") if f.is_file())
    print(f"\n  tables backed up : {manifest['totals']['tables']}")
    print(f"  rows             : {total_rows:,}")
    print(f"  empty tables     : {empty}")
    print(f"  failures         : {len(failures)}")
    print(f"  size on disk     : {size / 1_048_576:.1f} MB")
    print(f"  duration         : {manifest['totals']['seconds']}s")
    print(f"  location         : {root}")

    # Retention.
    parent = pathlib.Path(args.out)
    runs = sorted((d for d in parent.iterdir() if d.is_dir()), reverse=True)
    for old in runs[args.keep:]:
        shutil.rmtree(old)
        print(f"  retired old backup {old.name}")

    # A backup that could not read a table is not a backup.
    if failures:
        print(f"\nBACKUP INCOMPLETE — {len(failures)} tables failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
