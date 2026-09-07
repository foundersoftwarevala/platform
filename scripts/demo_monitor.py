#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Demo URL monitoring worker.

The Demo URL Manager already had CRUD, an audit trail and a "Test All" button.
What it did not have was a check that could tell the truth, or one that ran
without somebody pressing a button.

The existing check runs in the manager's browser and fetches each demo with
`mode: "no-cors"`. A cross-origin opaque response exposes no status at all, and
the code reads `res.status || 200` — so any address that does not raise a
network error is recorded as HTTP 200 and "working", a 404 and a 500 included.
That is why all thirteen demos read "unknown" with no response time: nothing
had ever produced a usable result.

This runs on the server, where the real status line and the real TLS handshake
are both observable:

  * a real HTTP GET, following redirects, with the status actually read
  * the real elapsed time, used against the same 2,500 ms slow threshold the
    manager already applies
  * a real certificate check — validity, hostname match, and days to expiry —
    rather than inferring SSL from the scheme

Results are written to the same columns the manager already reads, so its
screen shows this without any change, and every check is appended to
demo_health so uptime can be counted over time instead of declared.

Alerts are raised on demo_alerts for an offline endpoint or a certificate
that is invalid or close to expiry, and are deduplicated against the open
alerts already there so a repeatedly failing demo does not generate a storm.
"""

import datetime as dt
import json
import os
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

SLOW_MS = 2500          # the manager's own threshold
TIMEOUT_S = 10
SSL_WARN_DAYS = 21      # warn this far ahead of expiry

UA = "SoftwareVala-DemoMonitor/1.0"


def rest(path, method="GET", body=None, extra_headers=None):
    """One call against PostgREST as the service role."""
    url = "%s/rest/v1/%s" % (SUPABASE_URL, path)
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": "Bearer %s" % SERVICE_KEY,
        "Content-Type": "application/json",
        "User-Agent": UA,
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as res:
        raw = res.read().decode("utf-8")
        return json.loads(raw) if raw.strip() else []


def check_certificate(host, port=443):
    """Real certificate validity and days remaining.

    Returns (valid, days_left, reason). A hostname mismatch or an expired or
    untrusted certificate all come back as invalid with the reason, because
    each of them is something a visitor's browser would refuse.
    """
    context = ssl.create_default_context()
    try:
        with socket.create_connection((host, port), timeout=TIMEOUT_S) as sock:
            with context.wrap_socket(sock, server_hostname=host) as tls:
                cert = tls.getpeercert()
        not_after = cert.get("notAfter")
        if not not_after:
            return True, None, None
        expires = dt.datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(
            tzinfo=dt.timezone.utc
        )
        days = (expires - dt.datetime.now(dt.timezone.utc)).days
        return True, days, None
    except ssl.SSLCertVerificationError as exc:
        return False, None, "certificate verification failed: %s" % exc.verify_message
    except ssl.SSLError as exc:
        return False, None, "TLS error: %s" % exc
    except (socket.timeout, socket.gaierror, OSError) as exc:
        return False, None, "could not complete TLS handshake: %s" % exc


def check_once(url):
    """A real request. The status is read, not assumed."""
    started = time.time()
    status = 0
    error = None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA}, method="GET")
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
            status = res.status
            res.read(2048)          # touch the body so timing is honest
    except urllib.error.HTTPError as exc:
        # A 404 or a 500 is a real answer, and it is not "working".
        status = exc.code
        error = "HTTP %s" % exc.code
    except Exception as exc:                      # noqa: BLE001
        error = str(exc)[:300]

    ms = int((time.time() - started) * 1000)

    ssl_valid = None
    ssl_days = None
    if url.lower().startswith("https://"):
        host = url.split("/", 3)[2].split(":")[0]
        ssl_valid, ssl_days, ssl_reason = check_certificate(host)
        if not ssl_valid and error is None:
            error = ssl_reason

    if status and 200 <= status < 400:
        result = "slow" if ms > SLOW_MS else "working"
    else:
        result = "offline"

    return {
        "status": status,
        "ms": ms,
        "result": result,
        "ssl_valid": ssl_valid,
        "ssl_days": ssl_days,
        "error": error,
    }


def open_alerts():
    """Alert types already open, so a failing demo is not re-reported hourly."""
    rows = rest("demo_alerts?select=demo_id,alert_type&is_resolved=eq.false")
    return {(r.get("demo_id"), r.get("alert_type")) for r in rows}


def raise_alert(existing, demo_id, alert_type, severity, message):
    if (demo_id, alert_type) in existing:
        return False
    rest(
        "demo_alerts",
        method="POST",
        body=[{
            "demo_id": demo_id,
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "is_resolved": False,
        }],
        extra_headers={"Prefer": "return=minimal"},
    )
    existing.add((demo_id, alert_type))
    return True


def resolve_alerts(demo_id, alert_types):
    """A recovered demo closes its own alerts rather than leaving them open."""
    for alert_type in alert_types:
        rest(
            "demo_alerts?demo_id=eq.%s&alert_type=eq.%s&is_resolved=eq.false"
            % (demo_id, alert_type),
            method="PATCH",
            body={"is_resolved": True, "resolved_at": "now()"},
            extra_headers={"Prefer": "return=minimal"},
        )


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("monitor: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        return 1

    demos = rest(
        "product_demo_urls?select=id,demo_name,url,status,product_id"
        "&status=eq.active&order=created_at"
    )
    if not demos:
        print("monitor: no active demo URLs")
        return 0

    existing = open_alerts()
    checked = 0
    summary = {"working": 0, "slow": 0, "offline": 0}

    for demo in demos:
        url = (demo.get("url") or "").strip()
        if not url:
            continue

        outcome = check_once(url)
        checked += 1
        summary[outcome["result"]] = summary.get(outcome["result"], 0) + 1

        rest(
            "product_demo_urls?id=eq.%s" % demo["id"],
            method="PATCH",
            body={
                "last_checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "last_response_ms": outcome["ms"],
                "last_http_status": outcome["status"],
                "last_result": outcome["result"],
                "ssl_valid": outcome["ssl_valid"],
            },
            extra_headers={"Prefer": "return=minimal"},
        )

        # History, so uptime is counted rather than declared.
        rest(
            "demo_health",
            method="POST",
            body=[{
                "demo_url_id": demo["id"],
                "status": "active" if outcome["result"] != "offline" else "down",
                "response_time": outcome["ms"],
                "http_status": outcome["status"],
                "error_message": outcome["error"],
            }],
            extra_headers={"Prefer": "return=minimal"},
        )

        # Audit, in the same log the manager already shows.
        rest(
            "demo_url_audit_log",
            method="POST",
            body=[{
                "demo_url_id": demo["id"],
                "action": "demo_url.monitor",
                "actor_email": "monitor",
                "metadata": {
                    "http_status": outcome["status"],
                    "response_ms": outcome["ms"],
                    "result": outcome["result"],
                    "ssl_valid": outcome["ssl_valid"],
                    "ssl_days_left": outcome["ssl_days"],
                    "error": outcome["error"],
                },
            }],
            extra_headers={"Prefer": "return=minimal"},
        )

        if outcome["result"] == "offline":
            raise_alert(
                existing, demo["id"], "offline", "critical",
                "%s is not reachable (%s)"
                % (demo.get("demo_name") or url, outcome["error"] or "no response"),
            )
        else:
            resolve_alerts(demo["id"], ["offline"])

        if outcome["ssl_valid"] is False:
            raise_alert(
                existing, demo["id"], "ssl_invalid", "critical",
                "%s has an invalid certificate: %s"
                % (demo.get("demo_name") or url, outcome["error"] or "unknown"),
            )
        elif outcome["ssl_valid"] and outcome["ssl_days"] is not None:
            if outcome["ssl_days"] <= SSL_WARN_DAYS:
                raise_alert(
                    existing, demo["id"], "ssl_expiring", "warning",
                    "%s certificate expires in %s days"
                    % (demo.get("demo_name") or url, outcome["ssl_days"]),
                )
            else:
                resolve_alerts(demo["id"], ["ssl_invalid", "ssl_expiring"])

        print("  %-34s %-8s http=%-4s %5sms ssl=%s%s" % (
            (demo.get("demo_name") or url)[:34],
            outcome["result"], outcome["status"], outcome["ms"],
            outcome["ssl_valid"],
            "" if outcome["ssl_days"] is None else " (%sd)" % outcome["ssl_days"],
        ))

    print("monitor: checked %s — working %s, slow %s, offline %s" % (
        checked, summary.get("working", 0), summary.get("slow", 0),
        summary.get("offline", 0)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
