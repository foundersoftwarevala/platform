"""Section 38, with a test design that can actually tell the answers apart.

The first version of this suite reported six accepted writes. That was wrong,
and the way it was wrong is worth keeping in the file: an UPDATE aimed at an id
that matches nothing returns 204 whether the row-level policy permitted it or
refused it, so "204" proved nothing at all.

The fix is to ask a question that has two different answers. Each update below
targets a real row and sets a column to the value it already holds, with
return=representation. Nothing changes either way, and the reply is decisive:

  a row comes back  -> the policy let an anonymous caller update it
  []                -> the policy refused

Inserts stay as they were, with a deliberately invalid payload so that nothing
can be created whatever happens:

  401 / 403  refused by the policy
  400        allowed through, and stopped only by a missing column
  2xx        accepted, which would be a real hole

Deletes cannot be settled this way without deleting something, so they are not
claimed either way; what is reported instead is whether an anonymous caller can
even see the rows, since a row it cannot read is a row it cannot target.
"""
import json
import os
import urllib.error
import urllib.request

URL = os.environ["SUPABASE_URL"].strip()
ANON = (os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ["SUPABASE_ANON_KEY"]).strip()
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()
NOWHERE = "00000000-0000-0000-0000-000000000000"


def call(method, path, body=None, key=ANON, prefer=""):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + "/rest/v1/" + path, data=data, method=method)
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "software-vala-verify/1.0")
    if prefer:
        req.add_header("Prefer", prefer)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, r.read().decode()[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]
    except Exception as e:
        return None, str(e)[:120]


results = []


def record(label, verdict, detail):
    results.append({"attempt": label, "verdict": verdict, "detail": detail})
    print("%-36s %-28s %s" % (label, verdict, detail[:70]))


print("=== inserts: nothing can be created whatever the answer ===")
for label, table, payload in [
    ("Insert fake revenue", "payments", {"amount": 999999}),
    ("Insert fake payment intent", "marketplace_payment_intents", {"amount": 999999}),
    ("Insert fake order", "marketplace_orders", {"total": 999999}),
    ("Insert fake review", "marketplace_reviews", {"rating": 5}),
    ("Insert fake download", "marketplace_downloads", {"product_id": NOWHERE}),
    ("Insert fake licence", "marketplace_licenses", {"status": "active"}),
    ("Forge an audit row", "marketplace_audit_logs", {"action": "forged"}),
    ("Disable the policy by config", "system_settings", {"key": "no_fake_data_policy", "value": "off"}),
]:
    status, body = call("POST", table, payload, prefer="return=minimal")
    if status in (401, 403):
        record(label, "BLOCKED", "row-level policy refused (%s)" % status)
    elif status == 404:
        record(label, "BLOCKED", "table not exposed to this key")
    elif status == 400 and "PGRST204" in body:
        record(label, "INCONCLUSIVE",
               "PostgREST rejected the column before any policy was consulted, so this says nothing either way")
    elif status == 400:
        record(label, "ALLOWED THROUGH", "stopped only by the payload: %s" % body[:60])
    elif status and 200 <= status < 300:
        record(label, "ACCEPTED", "*** a record was created ***")
    else:
        record(label, "UNKNOWN", str(status))

print()
print("=== updates: real row, same value, decisive answer ===")
# Read the true current values with the service role first.
product = json.loads(call("GET", "marketplace_products?select=id,name,rating,downloads&limit=1", key=SERVICE)[1])[0]
order = json.loads(call("GET", "marketplace_orders?select=id,status&limit=1", key=SERVICE)[1])[0]
intent = json.loads(call("GET", "marketplace_payment_intents?select=id,status&limit=1", key=SERVICE)[1])[0]
audit = json.loads(call("GET", "marketplace_audit_logs?select=id,action&limit=1", key=SERVICE)[1])[0]

for label, path, payload in [
    ("Inflate a product rating", "marketplace_products?id=eq." + product["id"], {"rating": product["rating"]}),
    ("Inflate a download counter", "marketplace_products?id=eq." + product["id"], {"downloads": product["downloads"]}),
    ("Mark an order paid", "marketplace_orders?id=eq." + order["id"], {"status": order["status"]}),
    ("Mark a payment succeeded", "marketplace_payment_intents?id=eq." + intent["id"], {"status": intent["status"]}),
    ("Rewrite an audit row", "marketplace_audit_logs?id=eq." + audit["id"], {"action": audit["action"]}),
]:
    status, body = call("PATCH", path, payload, prefer="return=representation")
    changed = body.strip() not in ("[]", "")
    if status in (401, 403):
        record(label, "BLOCKED", "row-level policy refused (%s)" % status)
    elif status == 200 and not changed:
        record(label, "BLOCKED", "policy matched no row for an anonymous caller")
    elif status == 200 and changed:
        record(label, "PERMITTED", "*** an anonymous caller can update this ***")
    else:
        record(label, "UNKNOWN", "%s %s" % (status, body[:60]))

print()
print("=== read visibility: a row it cannot see is a row it cannot target ===")
for label, table in [
    ("Read the audit log", "marketplace_audit_logs"),
    ("Read orders", "marketplace_orders"),
    ("Read payments", "payments"),
    ("Read licences", "marketplace_licenses"),
    ("Read the permission matrix", "system_settings?key=eq.marketplace_role_permissions&select=value"),
]:
    path = table if "?" in table else table + "?select=id&limit=1"
    status, body = call("GET", path)
    refused = status is None or status >= 400
    visible = (not refused) and body.strip() not in ("[]", "")
    record(
        label,
        "VISIBLE" if visible else "HIDDEN",
        "%s %s" % (
            status,
            "refused outright" if refused
            else "no rows returned to anon" if not visible
            else body[:60],
        ),
    )

print()
print("=== nothing was changed ===")
after = json.loads(call("GET", "marketplace_products?select=rating,downloads&id=eq." + product["id"], key=SERVICE)[1])[0]
print("product rating %s -> %s | downloads %s -> %s" % (
    product["rating"], after["rating"], product["downloads"], after["downloads"]))

blocked = sum(1 for r in results if r["verdict"] in ("BLOCKED", "HIDDEN"))
weak = sum(1 for r in results if r["verdict"] in ("ALLOWED THROUGH", "VISIBLE"))
unclear = sum(1 for r in results if r["verdict"] in ("INCONCLUSIVE", "UNKNOWN"))
bad = sum(1 for r in results if r["verdict"] in ("ACCEPTED", "PERMITTED"))
print()
print("blocked/hidden: %d | allowed through or visible: %d | inconclusive: %d | accepted: %d" % (blocked, weak, unclear, bad))
print()
print(json.dumps({"results": results}, indent=1)[:80] + " …")
