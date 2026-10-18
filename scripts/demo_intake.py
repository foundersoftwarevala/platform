#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Demo Intake Worker.

The address rules are not here. demoIdentity and findByIdentity already decide
whether two addresses are the same demo - the same site arrives as http and
https, with and without a trailing slash and with a utm_ tail on it, and each
of those used to become its own row with its own scan and its own AI spend. A
second copy of those rules in Python would give the platform two answers to
"is this the same demo", so this worker calls the application, which holds the
one answer, through /api/demo/process.

What it adds is that taking a demo in no longer means scanning it on the spot.
investigateDemo does four things: work out whether the address is already
known, put a row there to hold the outcome, fetch the page, and ask the AI
Manager about it. Only the last two are slow and only they cost anything.
Submitting a thousand demos held a thousand fetches and a thousand model calls
open on one request; now intake writes the row and the Demo Scanner Worker
picks it up on its own schedule.

It queues nothing itself. demo_scan.py --enqueue already queues every demo
sitting at 'unprocessed', and two workers deciding when a scan happens would
eventually disagree about it.

  demo_intake.py --submit <product_id> <url>   take one address in, now
  demo_intake.py --enqueue <file>              one demo.intake job per line
  demo_intake.py --work                        claim a batch and take those in

The file for --enqueue is one "<product_id> <url>" per line; blank lines and
lines beginning with # are skipped.
"""

import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from demo_monitor import (  # noqa: E402
    SUPABASE_URL, SERVICE_KEY, rest, agent_run_open, agent_run_close,
)

APP = os.environ.get("SV_APP_ORIGIN") or "http://127.0.0.1:3000"
TOKEN = os.environ.get("INTERNAL_API_TOKEN") or ""

# No fetch of the demo and no model call, so this is a database round trip and
# nothing else.
TIMEOUT = 60


def take_in(product_id, url):
    """Ask the application to take one address in. Returns (ok, answer, error)."""
    body = json.dumps({"action": "intake", "productId": product_id, "url": url}).encode()
    request = urllib.request.Request(
        APP.rstrip("/") + "/api/demo/process",
        data=body,
        method="POST",
        headers={"content-type": "application/json", "x-internal-token": TOKEN},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return True, json.loads(response.read().decode()), None
    except urllib.error.HTTPError as problem:
        detail = problem.read().decode("utf-8", "replace")[:400]
        return False, None, "HTTP %s %s" % (problem.code, detail)
    except Exception as problem:                          # noqa: BLE001
        return False, None, str(problem)[:400]


def read_list(path):
    """Pairs of product id and address, one per line."""
    pairs = []
    with open(path, encoding="utf-8") as handle:
        for number, line in enumerate(handle, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) != 2:
                print("  line %s ignored: expected '<product_id> <url>'" % number)
                continue
            pairs.append((parts[0], parts[1]))
    return pairs


def enqueue_file(path):
    pairs = read_list(path)
    queued = 0
    waiting = 0
    for product_id, url in pairs:
        answer = rest("rpc/fa_enqueue", method="POST", body={
            "p_job_type": "demo.intake",
            "p_payload": {"product_id": product_id, "url": url},
            "p_reference": product_id,
            # One open intake per product and address. The same address
            # submitted twice while the first is still waiting is the same
            # request, not two.
            "p_idempotency_key": "demo.intake:%s:%s" % (product_id, url),
        })
        if isinstance(answer, dict) and answer.get("duplicate"):
            waiting += 1
        else:
            queued += 1
    print("intake: %s address(es) - %s queued, %s already waiting"
          % (len(pairs), queued, waiting))
    return 0


def describe(answer, url):
    demo = (answer or {}).get("demo") or {}
    if (answer or {}).get("duplicate"):
        return "already known as %s" % (demo.get("url") or url)
    return "taken in, awaiting scan"


def work_queue(worker, limit, lease):
    if not TOKEN:
        print("intake: INTERNAL_API_TOKEN is not set; the application would refuse this")
        return 1

    jobs = rest("rpc/fa_claim", method="POST", body={
        "p_worker": worker, "p_job_type": "demo.intake",
        "p_limit": limit, "p_lease_seconds": lease,
    }) or []
    if not jobs:
        print("intake: nothing queued for %s" % worker)
        return 0

    taken = 0
    known = 0
    failed = 0
    for job in jobs:
        payload = job.get("payload") or {}
        product_id = payload.get("product_id")
        url = payload.get("url")
        run = agent_run_open(
            "demo-intake", "product:%s" % (product_id or "unknown"), "CREATE",
            "fa_jobs:%s" % job["id"],
            "take a demo address in and decide whether it is already known",
            job["id"])

        if not product_id or not url:
            reason = "the job carries no product or address"
            agent_run_close(run, "FAILED", error=reason)
            rest("rpc/fa_fail", method="POST", body={
                "p_id": job["id"], "p_worker": worker,
                "p_error": reason, "p_error_class": "validation"})
            continue

        ok, answer, error = take_in(product_id, url)
        if not ok:
            agent_run_close(run, "FAILED", error=error)
            # An address the application refuses - not public, too long, no
            # such product - will be refused again however many times it is
            # tried, so it is not worth five attempts to learn that. Anything
            # else is the application being briefly unavailable.
            permanent = error.startswith("HTTP 4")
            rest("rpc/fa_fail", method="POST", body={
                "p_id": job["id"], "p_worker": worker,
                "p_error": error,
                "p_error_class": "validation" if permanent else "transient"})
            failed += 1
            continue

        # "Already known" is the answer, not a failure: the job asked whether
        # this demo is new and it was told no.
        duplicate = bool((answer or {}).get("duplicate"))
        if duplicate:
            known += 1
        else:
            taken += 1
        agent_run_close(run, "COMPLETED", result=describe(answer, url))
        rest("rpc/fa_complete", method="POST", body={
            "p_id": job["id"], "p_worker": worker,
            "p_result": {
                "duplicate": duplicate,
                "demo_url_id": ((answer or {}).get("demo") or {}).get("id"),
                "url": ((answer or {}).get("demo") or {}).get("url") or url,
            }})
        print("  %-46s %s" % (url[:46], describe(answer, url)))

    print("intake: %s job(s) - %s taken in, %s already known, %s failed"
          % (len(jobs), taken, known, failed))
    return 0


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("intake: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        return 1

    args = sys.argv[1:]

    if "--submit" in args:
        i = args.index("--submit")
        if i + 2 >= len(args):
            print("intake: --submit needs a product id and an address")
            return 1
        if not TOKEN:
            print("intake: INTERNAL_API_TOKEN is not set; the application would refuse this")
            return 1
        ok, answer, error = take_in(args[i + 1], args[i + 2])
        if not ok:
            print("intake: %s" % error)
            return 1
        print("intake: %s" % describe(answer, args[i + 2]))
        return 0

    if "--enqueue" in args:
        i = args.index("--enqueue")
        if i + 1 >= len(args):
            print("intake: --enqueue needs a file of '<product_id> <url>' lines")
            return 1
        return enqueue_file(args[i + 1])

    if "--work" in args:
        def arg(name, fallback):
            for a in args:
                if a.startswith(name + "="):
                    try:
                        return int(a.split("=", 1)[1])
                    except ValueError:
                        return fallback
            return fallback
        worker = "demo-intake-%s" % os.environ.get("HOSTNAME", "cron")
        return work_queue(worker, arg("--limit", 4), arg("--lease", 300))

    print(__doc__.strip().split("\n\n")[-2])
    return 0


if __name__ == "__main__":
    sys.exit(main())
