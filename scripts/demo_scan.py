#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Demo Scanner Worker.

The scan itself is not here and must not be. investigateDemo already does it,
in the application: an SSRF-guarded fetch, the evidence pulled out of the page,
the AI API Manager asked through the gateway, and — the part that makes it
trustworthy — every finding checked against the page before it is kept, with
the rest recorded as dropped and why. Reimplementing any of that in a worker
would give the platform two scanners that could disagree.

So this worker decides *when* a scan happens, and the application decides what
a scan is. It claims a demo.scan job and calls /api/demo/process, which is the
same door the Demo Manager screen uses, with the same operator guard.

What it will not do is activate.

Activation publishes a demo to the storefront. activateDemo refuses unless the
Software Vala favicon is in place and none of the developer's contact details
survive, so it is safe in the sense that it cannot publish something unclean —
but "cannot publish something unclean" is not the same as "should publish
without anybody deciding to". A scan leaves the demo at review, which is where
an operator picks it up. The queue's job is to make sure every demo gets looked
at, not to make the decision at the end of looking.

  demo_scan.py --enqueue     one demo.scan job per demo that has not been scanned
  demo_scan.py --work        claim a batch and scan those
"""

import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# One REST client, one set of credentials, one place the base URL is decided.
from demo_monitor import (  # noqa: E402
    SUPABASE_URL, SERVICE_KEY, rest, rest_all, agent_run_open, agent_run_close,
)

APP = os.environ.get("SV_APP_ORIGIN") or "http://127.0.0.1:3000"
TOKEN = os.environ.get("INTERNAL_API_TOKEN") or ""

# A scan fetches somebody else's site and then waits on a language model. The
# two measured runs took 20.8 and 33.5 seconds, so the ceiling here is about the
# provider, not about us.
TIMEOUT = 300


def investigate(product_id, url):
    """Ask the application to scan one demo. Returns (ok, demo, error)."""
    body = json.dumps({"action": "investigate", "productId": product_id, "url": url}).encode()
    request = urllib.request.Request(
        APP.rstrip("/") + "/api/demo/process",
        data=body,
        method="POST",
        headers={"content-type": "application/json", "x-internal-token": TOKEN},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return True, json.loads(response.read().decode()).get("demo") or {}, None
    except urllib.error.HTTPError as problem:
        detail = problem.read().decode("utf-8", "replace")[:400]
        return False, None, "HTTP %s %s" % (problem.code, detail)
    except Exception as problem:                          # noqa: BLE001
        return False, None, str(problem)[:400]


def unscanned():
    """Demos nothing has looked at, and demos whose last look failed.

    A demo already at review or live is left alone: it has been scanned and the
    next move is a decision, not another scan.
    """
    # Selected by the database rather than fetched and filtered here. Reading
    # every demo row to keep the few that need scanning meant the whole table
    # crossed the wire, and PostgREST stops at 10,000 rows without saying so -
    # so past that point the demos needing a scan could be in the part that was
    # never sent. The filter belongs in the query for the same reason the
    # counts do.
    # A row whose processing_status was never set is unscanned too, which is
    # why null is asked for explicitly rather than left to fall through.
    rows = rest_all(
        "product_demo_urls?select=id,product_id,url,demo_name,processing_status"
        "&or=(processing_status.is.null,processing_status.in.(unprocessed,failed))"
        "&product_id=not.is.null"
    )
    # An address of spaces is not one the database can reject with a filter,
    # and it is the only check left that the query cannot make.
    return [row for row in rows if (row.get("url") or "").strip()]


def enqueue_all():
    demos = unscanned()
    queued = 0
    waiting = 0
    for demo in demos:
        answer = rest("rpc/fa_enqueue", method="POST", body={
            "p_job_type": "demo.scan",
            "p_payload": {
                "demo_url_id": demo["id"],
                "product_id": demo["product_id"],
                "url": demo["url"],
            },
            "p_reference": demo["id"],
            # One open scan per demo. A demo still waiting from the last run is
            # not queued again, and a demo scanned last week can be scanned
            # again because the earlier job is no longer open.
            "p_idempotency_key": "demo.scan:%s" % demo["id"],
        })
        if isinstance(answer, dict) and answer.get("duplicate"):
            waiting += 1
        else:
            queued += 1
    print("scan: %s unscanned demo(s) - %s queued, %s already waiting"
          % (len(demos), queued, waiting))
    return 0


def work_queue(worker, limit, lease):
    if not TOKEN:
        print("scan: INTERNAL_API_TOKEN is not set; the application would refuse this")
        return 1

    jobs = rest("rpc/fa_claim", method="POST", body={
        "p_worker": worker, "p_job_type": "demo.scan",
        "p_limit": limit, "p_lease_seconds": lease,
    }) or []
    if not jobs:
        print("scan: nothing queued for %s" % worker)
        return 0

    reviewed = 0
    failed = 0
    for job in jobs:
        payload = job.get("payload") or {}
        product_id = payload.get("product_id")
        url = payload.get("url")
        # Opened before the work, so a worker that dies mid-scan still leaves a
        # run saying it started; the reaper closes those.
        run = agent_run_open(
            "demo-scanner", "demo:%s" % (payload.get("demo_url_id") or "unknown"),
            "CREATE", "fa_jobs:%s" % job["id"],
            "scan the demo and identify the software", job["id"])
        if not product_id or not url:
            reason = "the job carries no product or address"
            agent_run_close(run, "FAILED", error=reason)
            rest("rpc/fa_fail", method="POST", body={
                "p_id": job["id"], "p_worker": worker,
                "p_error": reason,
                "p_error_class": "validation"})
            continue

        ok, demo, error = investigate(product_id, url)
        if not ok:
            agent_run_close(run, "FAILED", error=error)
            # The application answering badly is worth trying again; the
            # classification decides whether it actually will be.
            rest("rpc/fa_fail", method="POST", body={
                "p_id": job["id"], "p_worker": worker,
                "p_error": error, "p_error_class": "transient"})
            failed += 1
            continue

        state = demo.get("processing_status")
        processing = demo.get("processing") or {}
        identity = processing.get("identity") or {}

        if state == "failed":
            # The scan ran and the scan failed. That is the job's result, and
            # the reason it failed is already recorded on the demo row, so the
            # class decides whether another attempt could help.
            reason = str(processing.get("error") or "the scan failed")
            agent_run_close(run, "FAILED", error=reason[:500])
            transient = any(word in reason.lower() for word in
                            ("timeout", "timed out", "econnreset", "eai_again",
                             "rate limit", "overloaded", "credit balance"))
            rest("rpc/fa_fail", method="POST", body={
                "p_id": job["id"], "p_worker": worker,
                "p_error": reason[:500],
                "p_error_class": "transient" if transient else "permanent"})
            failed += 1
            continue

        reviewed += 1
        agent_run_close(run, "COMPLETED", result="%s identified as %s (%.2f), awaiting review" % (
            demo.get("demo_name") or url,
            identity.get("category_slug") or "no category",
            identity.get("confidence") or 0.0))
        rest("rpc/fa_complete", method="POST", body={
            "p_id": job["id"], "p_worker": worker,
            "p_result": {
                "processing_status": state,
                "software_name": identity.get("software_name"),
                "category_slug": identity.get("category_slug"),
                "confidence": identity.get("confidence"),
                "product_category_matches": identity.get("product_category_matches"),
            }})
        print("  %-34s %s  %s (%.2f)" % (
            (demo.get("demo_name") or url)[:34],
            state,
            identity.get("category_slug") or "no category",
            identity.get("confidence") or 0.0,
        ))

    print("scan: %s job(s) - %s awaiting review, %s failed" % (len(jobs), reviewed, failed))
    return 0


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("scan: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        return 1

    args = sys.argv[1:]
    if "--enqueue" in args:
        return enqueue_all()
    if "--work" in args:
        def arg(name, fallback):
            for a in args:
                if a.startswith(name + "="):
                    try:
                        return int(a.split("=", 1)[1])
                    except ValueError:
                        return fallback
            return fallback
        worker = "demo-scan-%s" % os.environ.get("HOSTNAME", "cron")
        return work_queue(worker, arg("--limit", 2), arg("--lease", 600))

    print(__doc__.strip().split("\n\n")[-1])
    return 0


if __name__ == "__main__":
    sys.exit(main())
