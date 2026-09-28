#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Demo Sync Worker.

The relationship it synchronises is already canonical. demo-gateway serves
/demo/$slug by reading product_demo_urls directly, so there is no second copy
to keep in step and nothing for this worker to write into a store of its own.
That is why it verifies rather than copies, and why it adds no table.

What was missing is the answer to one question: is a verified demo actually
reachable from the marketplace, by the route a visitor takes? Several things
can be true separately and wrong together. A demo can be active while its
product is hidden. A product can hold a card slot while its demo points
somewhere else. Two demos can be active for one product, so the one an operator
verified is not the one the gateway picks.

Two halves:

  mm_demo_sync_check   everything the database can settle on its own — the demo
                       is active and passed verification, the product exists and
                       is published, it has a category and a card slot, and this
                       demo is the one demo-gateway would resolve to
  this worker          the half that needs a request: the public product page
                       and the demo route both answer

It writes nothing except the job's result and an audit entry. If a check fails
it says which one and stops; it does not repair anything, because every failure
it can find is a decision somebody should make — hiding a product, retiring a
demo, moving a card — and not a value to be corrected quietly.

  demo_sync.py --enqueue        one demo.sync job per verified demo
  demo_sync.py --work           claim a batch and verify those
  demo_sync.py --check <id>     verify one demo, without the queue
"""

import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# The helpers the health worker already uses: one REST client, one set of
# credentials, one place where the base URL is decided.
from demo_monitor import (  # noqa: E402
    SUPABASE_URL, SERVICE_KEY, rest, rest_all, agent_run_open, agent_run_close,
)

SITE = os.environ.get("SV_SITE") or "https://softwarevala.net"
TIMEOUT = 25


def reachable(path):
    """Does this address answer? Returns (ok, status, detail)."""
    url = path if path.startswith("http") else SITE.rstrip("/") + path
    request = urllib.request.Request(url, method="GET", headers={
        "user-agent": "SoftwareVala-DemoSync",
    })
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return True, response.status, response.geturl()
    except urllib.error.HTTPError as problem:
        return False, problem.code, "HTTP %s" % problem.code
    except Exception as problem:                         # noqa: BLE001
        return False, None, str(problem)[:200]


def audit(demo_id, action, metadata):
    rest("demo_url_audit_log", method="POST", body=[{
        "demo_url_id": demo_id,
        "action": action,
        "actor_email": "demo-sync",
        "metadata": metadata,
    }], extra_headers={"Prefer": "return=minimal"})


def check_one(demo_id):
    """Run both halves. Returns the full result."""
    answer = rest("rpc/mm_demo_sync_check", method="POST", body={"p_demo": demo_id})
    if not isinstance(answer, dict) or not answer.get("ok"):
        return {"ok": False, "reason": (answer or {}).get("reason", "unreadable"),
                "demo_id": demo_id}

    http = []
    path = answer.get("public_path")
    if path:
        ok, status, detail = reachable(path)
        http.append({"check": "the demo route answers", "ok": ok,
                     "path": path, "status": status, "detail": detail})
    else:
        http.append({"check": "the demo route answers", "ok": False,
                     "detail": "the product has no slug, so it has no public route"})

    slug = answer.get("product_slug")
    if slug:
        ok, status, detail = reachable("/marketplace/product/%s" % slug)
        http.append({"check": "the product page answers", "ok": ok,
                     "path": "/marketplace/product/%s" % slug,
                     "status": status, "detail": detail})

    answer["http"] = http
    answer["http_failed"] = sum(0 if c["ok"] else 1 for c in http)
    answer["verified"] = bool(answer.get("ready")) and answer["http_failed"] == 0
    return answer


def verified_demos():
    """Demos that have passed the second verification and so are worth syncing."""
    return rest_all(
        "product_demo_urls?select=id,product_id,demo_name"
        "&status=eq.active&processing_status=eq.live"
    )


def enqueue_all():
    demos = verified_demos()
    queued = 0
    waiting = 0
    for demo in demos:
        answer = rest("rpc/fa_enqueue", method="POST", body={
            "p_job_type": "demo.sync",
            "p_payload": {"demo_url_id": demo["id"], "product_id": demo.get("product_id")},
            "p_reference": demo["id"],
            "p_idempotency_key": "demo.sync:%s" % demo["id"],
        })
        if isinstance(answer, dict) and answer.get("duplicate"):
            waiting += 1
        else:
            queued += 1
    print("sync: %s verified demo(s) - %s queued, %s already waiting"
          % (len(demos), queued, waiting))
    return 0


def work_queue(worker, limit, lease):
    jobs = rest("rpc/fa_claim", method="POST", body={
        "p_worker": worker, "p_job_type": "demo.sync",
        "p_limit": limit, "p_lease_seconds": lease,
    }) or []
    if not jobs:
        print("sync: nothing queued for %s" % worker)
        return 0

    verified = 0
    for job in jobs:
        demo_id = (job.get("payload") or {}).get("demo_url_id")
        # EXECUTE_LOW_RISK rather than READ, because the check writes an audit
        # entry. It is the only permission beyond READ that demo-sync holds,
        # and the roster is not widened to suit the worker.
        run = agent_run_open(
            "demo-sync", "demo:%s" % (demo_id or "unknown"), "EXECUTE_LOW_RISK",
            "fa_jobs:%s" % job["id"],
            "verify the demo is reachable from the marketplace", job["id"])
        if not demo_id:
            reason = "the job carries no demo id"
            agent_run_close(run, "FAILED", error=reason)
            rest("rpc/fa_fail", method="POST", body={
                "p_id": job["id"], "p_worker": worker,
                "p_error": reason,
                "p_error_class": "validation"})
            continue

        try:
            result = check_one(demo_id)
        except Exception as problem:                     # noqa: BLE001
            agent_run_close(run, "FAILED", error=str(problem)[:500])
            rest("rpc/fa_fail", method="POST", body={
                "p_id": job["id"], "p_worker": worker,
                "p_error": str(problem)[:500], "p_error_class": "transient"})
            continue

        if not result.get("ok"):
            reason = "the check could not run: %s" % result.get("reason")
            agent_run_close(run, "FAILED", error=reason)
            rest("rpc/fa_fail", method="POST", body={
                "p_id": job["id"], "p_worker": worker,
                "p_error": reason,
                "p_error_class": "validation"})
            continue

        # A demo that is not reachable is a finding, not a failed job: the check
        # ran and the answer was no. Retrying would not change a hidden product
        # or a card that holds something else. The result records which check
        # failed so an operator can act on the actual thing.
        if result["verified"]:
            verified += 1
        # The run completed either way. What it verified is the demo; whether
        # the run itself was right is a separate judgement this worker is not
        # allowed to make, so its verification stays UNVERIFIED.
        agent_run_close(run, "COMPLETED", result=(
            "reachable from the marketplace" if result["verified"]
            else "not reachable: %s" % ", ".join(
                [c["label"] for c in result.get("checks", []) if not c.get("passed")]
                + [c["check"] for c in result.get("http", []) if not c.get("ok")]
            )))
        audit(demo_id, "demo_url.sync", {
            "verified": result["verified"],
            "failed": result.get("failed"),
            "http_failed": result.get("http_failed"),
            "public_path": result.get("public_path"),
            "worker": worker,
        })
        rest("rpc/fa_complete", method="POST", body={
            "p_id": job["id"], "p_worker": worker,
            "p_result": {
                "verified": result["verified"],
                "failed_checks": [c["label"] for c in result.get("checks", [])
                                  if not c.get("passed")],
                "failed_http": [c["check"] for c in result.get("http", [])
                                if not c.get("ok")],
                "public_path": result.get("public_path"),
            }})

    print("sync: %s job(s) - %s verified, %s with findings"
          % (len(jobs), verified, len(jobs) - verified))
    return 0


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("sync: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        return 1

    args = sys.argv[1:]
    if "--enqueue" in args:
        return enqueue_all()
    if "--check" in args:
        i = args.index("--check")
        if i + 1 >= len(args):
            print("sync: --check needs a demo id")
            return 1
        print(json.dumps(check_one(args[i + 1]), indent=2, default=str))
        return 0
    if "--work" in args:
        def arg(name, fallback):
            for a in args:
                if a.startswith(name + "="):
                    try:
                        return int(a.split("=", 1)[1])
                    except ValueError:
                        return fallback
            return fallback
        worker = "demo-sync-%s" % os.environ.get("HOSTNAME", "cron")
        return work_queue(worker, arg("--limit", 2), arg("--lease", 300))

    print(__doc__.strip().split("\n\n")[-1])
    return 0


if __name__ == "__main__":
    sys.exit(main())
