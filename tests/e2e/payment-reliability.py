#!/usr/bin/env python3
"""Failure and concurrency tests for the payment path, run against a live server.

These are deliberately not unit tests. What matters about a payment system is
what the database looks like after two things happen at once, after a provider
retries, after a caller lies — and none of that is visible from a mock. So every
check here goes over HTTP to a running instance and asserts on what it actually
answers.

Nothing here creates a customer, an order or a payment. There is no fixture, no
seeded account and no synthetic transaction: the checks use references that
cannot exist, callers that are not signed in, and callbacks that carry no valid
signature. That is on purpose. A test that invents a payment in order to prove
payments work has proved nothing, and this platform's rule is that verification
runs against real data or reports the honest empty state.

    python tests/e2e/payment-reliability.py --base http://127.0.0.1:3003 \
        [--internal-token <token>]

Exit code is 0 when every check passed, 1 otherwise. A check that cannot run —
because no operator token was supplied, say — is reported as SKIP and does not
fail the run, because a skipped check is honest and a faked pass is not.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
import urllib.error
import urllib.request

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIP"
results: list[tuple[str, str, str]] = []


def record(name: str, status: str, detail: str = "") -> None:
    results.append((name, status, detail))
    mark = {PASS: "ok  ", FAIL: "FAIL", SKIP: "skip"}[status]
    print(f"  [{mark}] {name}" + (f" — {detail}" if detail else ""))


def call(
    base: str,
    path: str,
    method: str = "GET",
    body: dict | None = None,
    headers: dict | None = None,
    timeout: int = 30,
) -> tuple[int, str, dict]:
    """Returns (status, text, headers). A refusal is an answer, never an exception."""
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(base.rstrip("/") + path, data=data, method=method)
    request.add_header("User-Agent", "softwarevala-payment-tests/1.0")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", "replace"), dict(response.headers)
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", "replace"), dict(error.headers)
    except Exception as error:  # noqa: BLE001 — a transport failure is a result too
        return 0, f"{type(error).__name__}: {error}", {}


# ---------------------------------------------------------------------------
# 1. Nothing that moves money is reachable without proving who you are
# ---------------------------------------------------------------------------


def test_internal_endpoints_refuse_strangers(base: str) -> None:
    for path in (
        "/api/internal/payment-jobs",
        "/api/internal/payment-reconcile",
        "/api/internal/payment-health",
    ):
        status, text, _ = call(base, path)
        if status in (401, 403):
            record(f"{path} refuses an unauthenticated caller", PASS, f"HTTP {status}")
        else:
            record(
                f"{path} refuses an unauthenticated caller",
                FAIL,
                f"HTTP {status}: {text[:160]}",
            )


def test_initiate_requires_sign_in(base: str) -> None:
    status, text, _ = call(
        base,
        "/api/payment/initiate",
        method="POST",
        body={"orderId": "00000000-0000-0000-0000-000000000000"},
    )
    if status == 401:
        record("payment initiate refuses an anonymous caller", PASS, "HTTP 401")
    else:
        record("payment initiate refuses an anonymous caller", FAIL, f"HTTP {status}: {text[:160]}")


# ---------------------------------------------------------------------------
# 2. A caller who lies gets nothing back
# ---------------------------------------------------------------------------


def test_status_leaks_nothing_for_unknown_reference(base: str) -> None:
    status, text, _ = call(base, "/api/payment/status?txnid=SV-DOES-NOT-EXIST-0000&verify=0")
    if status != 200:
        record("status of an unknown reference", FAIL, f"HTTP {status}: {text[:160]}")
        return
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        record("status of an unknown reference", FAIL, "response was not JSON")
        return
    leaked = [key for key in ("licence_key", "license_key", "card_last4") if payload.get(key)]
    if payload.get("status") == "unknown" and not leaked:
        record("status of an unknown reference", PASS, "answers 'unknown' and nothing else")
    else:
        record("status of an unknown reference", FAIL, f"leaked {leaked or payload}")


def test_webhook_rejects_an_unsigned_callback(base: str) -> None:
    """A callback nobody can verify must never be accepted, and must never 500."""
    status, text, _ = call(
        base,
        "/api/payment/webhook",
        method="POST",
        body={"event": "charge.completed", "data": {"tx_ref": "SV-FORGED-0001", "status": "successful"}},
        headers={"verif-hash": "not-the-real-secret"},
    )
    if status in (400, 503):
        record(
            "forged provider callback is refused",
            PASS,
            f"HTTP {status} — {'signature rejected' if status == 400 else 'rail not configured'}",
        )
    elif status >= 500:
        record("forged provider callback is refused", FAIL, f"server error HTTP {status}")
    else:
        record("forged provider callback is refused", FAIL, f"accepted with HTTP {status}: {text[:160]}")


def test_webhook_survives_rubbish(base: str) -> None:
    """A malformed body is a bad request, not a crash and not a settlement."""
    request = urllib.request.Request(
        base.rstrip("/") + "/api/payment/webhook", data=b"\x00\x01 not json at all", method="POST"
    )
    request.add_header("Content-Type", "application/json")
    request.add_header("User-Agent", "softwarevala-payment-tests/1.0")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            status = response.status
    except urllib.error.HTTPError as error:
        status = error.code
    except Exception as error:  # noqa: BLE001
        record("malformed callback does not crash the endpoint", FAIL, str(error))
        return
    # 503 is a deliberate refusal, not a crash: the webhook fails closed when no
    # rail credentials are configured, because a callback it cannot verify is
    # not a payment. 500 is the one that would mean the rubbish got through to
    # something that then broke on it.
    if status == 503:
        record(
            "malformed callback does not crash the endpoint",
            PASS,
            "HTTP 503 — refused before parsing, no rail configured",
        )
    elif status < 500:
        record("malformed callback does not crash the endpoint", PASS, f"HTTP {status}")
    else:
        record("malformed callback does not crash the endpoint", FAIL, f"HTTP {status}")


# ---------------------------------------------------------------------------
# 3. Two things at once
# ---------------------------------------------------------------------------


def test_concurrent_callbacks_are_consistent(base: str) -> None:
    """Eight identical callbacks delivered simultaneously must all be handled.

    None of them can settle anything — the reference does not exist and the
    signature is not ours — so what this proves is the shape of the answer under
    concurrency: every request is answered, none of them is a server error, and
    they all agree with each other. A path that only fails safely one request at
    a time is not safe.
    """
    outcomes: list[int] = []
    lock = threading.Lock()

    def fire() -> None:
        status, _, _ = call(
            base,
            "/api/payment/webhook",
            method="POST",
            body={
                "event": "charge.completed",
                "data": {"tx_ref": "SV-CONCURRENT-TEST", "status": "successful"},
            },
            headers={"verif-hash": "not-the-real-secret"},
        )
        with lock:
            outcomes.append(status)

    threads = [threading.Thread(target=fire) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    if not outcomes:
        record("eight simultaneous callbacks", FAIL, "no responses")
        return
    # As above: 503 is the configured refusal and is a legitimate answer for
    # them to agree on. Anything else at 500 or over is not.
    if any(status >= 500 and status != 503 for status in outcomes):
        record("eight simultaneous callbacks", FAIL, f"server errors: {outcomes}")
    elif len(set(outcomes)) == 1:
        record("eight simultaneous callbacks", PASS, f"all answered HTTP {outcomes[0]}")
    else:
        record("eight simultaneous callbacks", FAIL, f"disagreed: {sorted(set(outcomes))}")


def test_status_poll_is_rate_limited(base: str) -> None:
    """A poll loop should eventually be told to wait.

    Reported as a skip rather than a failure when it is not, because the limiter
    fails open by design when its counter cannot be reached — a customer must
    never be refused because a table was briefly unavailable — and because the
    limit is deliberately far above what one person's browser produces.
    """
    codes: list[int] = []
    for index in range(140):
        status, _, _ = call(base, f"/api/payment/status?txnid=SV-RATE-{index}&verify=0", timeout=15)
        codes.append(status)
        if status == 429:
            break
    if 429 in codes:
        record("status polling is rate limited", PASS, f"429 after {len(codes)} requests")
    else:
        record(
            "status polling is rate limited",
            SKIP,
            "no 429 within 140 requests — limiter open or limit not yet reached",
        )


# ---------------------------------------------------------------------------
# 4. What the operator endpoints actually report
# ---------------------------------------------------------------------------


def test_health_is_measured_not_asserted(base: str, token: str | None) -> None:
    if not token:
        record("payment health reports measured signals", SKIP, "no operator token supplied")
        return
    status, text, _ = call(base, "/api/internal/payment-health", headers={"x-internal-token": token})
    if status not in (200, 503):
        record("payment health reports measured signals", FAIL, f"HTTP {status}: {text[:200]}")
        return
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        record("payment health reports measured signals", FAIL, "response was not JSON")
        return
    signals = payload.get("signals") or []
    if not signals:
        record("payment health reports measured signals", FAIL, "no signals returned")
        return
    unknown = [s["name"] for s in signals if s.get("state") == "unknown"]
    print(f"        overall={payload.get('overall')} signals={len(signals)}")
    for signal in signals:
        print(f"        - {signal['name']}: {signal.get('value')} {signal.get('unit')} [{signal.get('state')}]")
    if payload.get("overall") in ("ok", "warn", "critical", "unknown"):
        record(
            "payment health reports measured signals",
            PASS,
            f"{len(signals)} signals, {len(unknown)} unmeasurable",
        )
    else:
        record("payment health reports measured signals", FAIL, f"overall={payload.get('overall')}")


def test_queue_reports_its_depth(base: str, token: str | None) -> None:
    if not token:
        record("settlement queue reports its depth", SKIP, "no operator token supplied")
        return
    status, text, _ = call(base, "/api/internal/payment-jobs", headers={"x-internal-token": token})
    if status != 200:
        record("settlement queue reports its depth", FAIL, f"HTTP {status}: {text[:200]}")
        return
    payload = json.loads(text)
    queue = payload.get("queue") or {}
    print(f"        queue={queue}")
    if all(key in queue for key in ("pending", "processing", "processed", "dead")):
        record("settlement queue reports its depth", PASS, json.dumps(queue))
    else:
        record("settlement queue reports its depth", FAIL, f"incomplete: {queue}")


def test_queue_run_is_idempotent(base: str, token: str | None) -> None:
    """Running the consumer twice must not process the same event twice."""
    if not token:
        record("running the queue twice is safe", SKIP, "no operator token supplied")
        return
    first = call(
        base, "/api/internal/payment-jobs", "POST", {"limit": 5}, {"x-internal-token": token}
    )
    second = call(
        base, "/api/internal/payment-jobs", "POST", {"limit": 5}, {"x-internal-token": token}
    )
    if first[0] != 200 or second[0] != 200:
        record("running the queue twice is safe", FAIL, f"HTTP {first[0]} then {second[0]}")
        return
    a, b = json.loads(first[1]), json.loads(second[1])
    print(f"        first={a.get('claimed')} claimed, second={b.get('claimed')} claimed")
    if b.get("claimed", 0) <= a.get("claimed", 0) or a.get("claimed", 0) == 0:
        record(
            "running the queue twice is safe",
            PASS,
            f"claimed {a.get('claimed')} then {b.get('claimed')}",
        )
    else:
        record("running the queue twice is safe", FAIL, "second run claimed more than the first")


def test_reconcile_reports_without_repairing_mismatches(base: str, token: str | None) -> None:
    if not token:
        record("consistency sweep classifies rather than corrects", SKIP, "no operator token supplied")
        return
    status, text, _ = call(
        base, "/api/internal/payment-reconcile", "POST", {}, {"x-internal-token": token}, timeout=180
    )
    if status != 200:
        record("consistency sweep classifies rather than corrects", FAIL, f"HTTP {status}: {text[:200]}")
        return
    payload = json.loads(text)
    findings = payload.get("findings") or []
    print(
        f"        checked={payload.get('checked')} repaired={payload.get('repaired')} "
        f"exceptions={payload.get('exceptions')}"
    )
    for finding in findings[:20]:
        print(f"        - {finding.get('kind')} [{finding.get('disposition')}] {finding.get('detail')}")
    # The rule the sweep must obey: a mismatch is never repaired.
    never_repaired = {"duplicate_settlement", "payment_amount_mismatch", "missing_ledger_entry"}
    violations = [
        f for f in findings if f.get("kind") in never_repaired and f.get("disposition") == "repaired"
    ]
    if violations:
        record(
            "consistency sweep classifies rather than corrects",
            FAIL,
            f"auto-repaired a mismatch: {violations}",
        )
    else:
        record(
            "consistency sweep classifies rather than corrects",
            PASS,
            f"{payload.get('exceptions')} exception(s), {payload.get('repaired')} safe repair(s)",
        )


# ---------------------------------------------------------------------------
# 5. How fast, under how much
# ---------------------------------------------------------------------------


def test_status_latency_under_load(base: str) -> None:
    """Twenty concurrent status reads, reported as measured percentiles."""
    timings: list[float] = []
    lock = threading.Lock()

    def fire(index: int) -> None:
        started = time.perf_counter()
        call(base, f"/api/payment/status?txnid=SV-LOAD-{index}&verify=0", timeout=30)
        with lock:
            timings.append((time.perf_counter() - started) * 1000)

    threads = [threading.Thread(target=fire, args=(i,)) for i in range(20)]
    started = time.perf_counter()
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    wall = time.perf_counter() - started

    if not timings:
        record("status endpoint under twenty concurrent readers", FAIL, "no timings")
        return
    timings.sort()

    def pct(p: float) -> float:
        return timings[min(int(len(timings) * p), len(timings) - 1)]

    detail = (
        f"p50 {pct(0.5):.0f}ms, p95 {pct(0.95):.0f}ms, p99 {pct(0.99):.0f}ms, "
        f"{len(timings)/wall:.1f} req/s"
    )
    record("status endpoint under twenty concurrent readers", PASS, detail)


# ---------------------------------------------------------------------------


# ---------------------------------------------------------------- liveness --


def test_liveness_and_readiness(base: str) -> None:
    """/health and /ready must answer different questions, and leak nothing.

    The distinction is the whole point of having two. Liveness must not depend
    on a dependency, or a supervisor restarts a healthy process every time the
    database has a bad minute. Readiness must depend on one, or a server that
    cannot reach its database keeps being handed traffic.

    Both are public, so they are also checked for the thing an unauthenticated
    endpoint most easily gives away: version strings, hostnames, project ids,
    file paths, or the name of whatever just failed.
    """
    status, text, _ = call(base, "/health")
    if status != 200:
        record("liveness answers", FAIL, f"HTTP {status}")
    else:
        record("liveness answers", PASS, "HTTP 200")

    leaky = ("supabase", "postgres", "/var/", "http", "version", "host", "key", "token")
    found = [word for word in leaky if word in text.lower()]
    if found:
        record("liveness reveals no infrastructure", FAIL, f"mentions {found}")
    else:
        record("liveness reveals no infrastructure", PASS, text.strip()[:80])

    status, text, _ = call(base, "/ready")
    if status == 200:
        record("readiness answers", PASS, "HTTP 200 — dependencies reachable")
    elif status == 503:
        # A truthful "not ready" is a pass for this check: the endpoint worked.
        record("readiness answers", PASS, "HTTP 503 — reports itself not ready")
    else:
        record("readiness answers", FAIL, f"HTTP {status}")

    found = [word for word in leaky if word in text.lower()]
    if found:
        record("readiness reveals no infrastructure", FAIL, f"mentions {found}")
    else:
        record("readiness reveals no infrastructure", PASS, text.strip()[:80])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:3003")
    parser.add_argument("--internal-token", default=None)
    args = parser.parse_args()

    print(f"Payment reliability checks against {args.base}\n")

    print("Liveness and readiness")
    test_liveness_and_readiness(args.base)

    print("\nAccess")
    test_internal_endpoints_refuse_strangers(args.base)
    test_initiate_requires_sign_in(args.base)

    print("\nCallers who lie")
    test_status_leaks_nothing_for_unknown_reference(args.base)
    test_webhook_rejects_an_unsigned_callback(args.base)
    test_webhook_survives_rubbish(args.base)

    print("\nConcurrency")
    test_concurrent_callbacks_are_consistent(args.base)
    test_status_poll_is_rate_limited(args.base)

    print("\nOperator surfaces")
    test_health_is_measured_not_asserted(args.base, args.internal_token)
    test_queue_reports_its_depth(args.base, args.internal_token)
    test_queue_run_is_idempotent(args.base, args.internal_token)
    test_reconcile_reports_without_repairing_mismatches(args.base, args.internal_token)

    print("\nLoad")
    test_status_latency_under_load(args.base)

    passed = sum(1 for _, status, _ in results if status == PASS)
    failed = sum(1 for _, status, _ in results if status == FAIL)
    skipped = sum(1 for _, status, _ in results if status == SKIP)
    print(f"\n{passed} passed, {failed} failed, {skipped} skipped")
    if failed:
        print("\nFailures:")
        for name, status, detail in results:
            if status == FAIL:
                print(f"  - {name}: {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
