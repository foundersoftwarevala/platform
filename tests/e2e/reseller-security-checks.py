"""Server-side authorization checks with real sessions.  python3 final-sec.py <accounts.json> <product-slug>"""
import json, os, sys, urllib.request, urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/"); ANON = os.environ["ANON"]
SITE = "https://softwarevala.net"
accts = {a["label"]: a for a in json.load(open(sys.argv[1]))}
PRODUCT = sys.argv[2]
results = []

def req(method, url, token=None, body=None, headers=None):
    h = {"apikey": ANON, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    if token: h["Authorization"] = "Bearer " + token
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as res:
            raw = res.read().decode(); return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw

def login(label):
    a = accts[label]
    st, body = req("POST", URL + "/auth/v1/token?grant_type=password", body={"email": a["email"], "password": a["password"]})
    return body["access_token"]

def rpc(tok, fn, args):
    return req("POST", f"{URL}/rest/v1/rpc/{fn}", tok, args)

def check(name, ok, detail=""):
    results.append((name, ok)); print(("PASS " if ok else "FAIL ") + name + (f" — {str(detail)[:200]}" if detail != "" else ""))

A, B, C, F = login("applicantA"), login("applicantB"), login("customer"), login("finance")
uA, uB = accts["applicantA"]["id"], accts["applicantB"]["id"]

# --- price protection
st, q = req("GET", f"{SITE}/api/partner/quote?product={PRODUCT}&discount=0.9&price=1&plan=master_reseller&tier=gold&final=1", A)
check("quote ignores injected price/discount/plan/tier (A has no membership → list price)", st == 200 and q.get("finalPriceUsd") == q.get("listPriceUsd") and q.get("listPriceUsd", 0) > 1, q)
st, qc = req("GET", f"{SITE}/api/partner/quote?product={PRODUCT}", C)
check("normal customer quote = list price", st == 200 and qc.get("finalPriceUsd") == qc.get("listPriceUsd"), qc)
st, qn = req("GET", f"{SITE}/api/partner/quote?product={PRODUCT}")
check("unauthenticated quote refused", st == 401, st)
st, r = rpc(A, "reseller_pricing_for", {"p_user": uB})
check("reseller cannot call the pricing rule for anyone (direct)", st in (401, 403, 404), (st, r))
st, r = rpc(A, "marketplace_create_checkout", {"p_idempotency_key": "x" * 20, "p_amount": 1, "p_discount": 99})
check("checkout rejects caller-supplied amount/discount parameters", st >= 400, (st, str(r)[:120]))
st, r = req("PATCH", f"{URL}/rest/v1/marketplace_orders?buyer_id=eq.{uA}", A, {"total": 1, "discount_total": 999}, {"Prefer": "return=representation"})
check("reseller cannot rewrite own order total/discount", (st in (401, 403)) or (st == 200 and r == []), (st, r))
st, r = req("PATCH", f"{URL}/rest/v1/marketplace_product_pricing?active=eq.true", A, {"amount": 1}, {"Prefer": "return=representation"})
check("reseller cannot change product prices", (st in (401, 403)) or (st == 200 and r == []), (st, str(r)[:80]))
st, r = req("PATCH", f"{URL}/rest/v1/reseller_membership_plans?code=eq.master_reseller", A, {"profit_percent": 90}, {"Prefer": "return=representation"})
check("reseller cannot change plan discount", (st in (401, 403)) or (st == 200 and r == []), (st, r))

# --- tier / entitlement / approval protection
st, r = req("PATCH", f"{URL}/rest/v1/resellers?user_id=eq.{uA}", A, {"tier": "gold", "plan_code": "master_reseller", "status": "active"}, {"Prefer": "return=representation"})
check("reseller cannot change own tier/plan/status", st >= 400 or r == [], (st, str(r)[:120]))
st, r = req("POST", f"{URL}/rest/v1/reseller_memberships", A, {"reseller_id": "00000000-0000-0000-0000-000000000000", "plan_code": "master_reseller", "status": "active"})
check("reseller cannot grant itself a membership", st >= 400, (st, str(r)[:100]))
st, r = req("GET", f"{URL}/rest/v1/resellers?select=id&user_id=eq.{uA}", A)
rid = r[0]["id"] if st == 200 and r else None
st, r = rpc(A, "mm_reseller_status", {"p_id": rid, "p_to": "active", "p_reason": "self"})
check("reseller cannot approve itself", st >= 400 or (isinstance(r, dict) and r.get("ok") is False), (st, r))
st, r = rpc(A, "activate_reseller_membership", {"p_order_id": "00000000-0000-0000-0000-000000000000", "p_actor": uA})
check("reseller cannot activate a membership directly", st >= 400, (st, str(r)[:100]))
st, r = rpc(A, "verify_reseller_membership_payment", {"p_order_id": "00000000-0000-0000-0000-000000000000", "p_status": "SUCCESS", "p_provider_reference": "x"})
check("reseller cannot verify payments", st >= 400, (st, str(r)[:100]))

# --- idempotency / duplicate orders
st, cart = rpc(A, "marketplace_cart_quote", {})
check("cart quote is served by the server for the caller", st == 200 and "total" in (cart or {}), cart)
st, orders_before = req("GET", f"{URL}/rest/v1/reseller_membership_orders?select=id", A)
st, o1 = rpc(A, "create_reseller_membership_order", {"p_plan_code": "starter_reseller", "p_idempotency_key": "e2e-final-dup-0001"})
st2, o2 = rpc(A, "create_reseller_membership_order", {"p_plan_code": "starter_reseller", "p_idempotency_key": "e2e-final-dup-0002"})
check("second membership order for the same plan returns the open one (no duplicate)", st == 200 and st2 == 200 and o1["order"]["id"] == o2["order"]["id"], (o1.get("duplicate") if isinstance(o1, dict) else o1, o2.get("duplicate") if isinstance(o2, dict) else o2))

# --- isolation
st, r = req("GET", f"{URL}/rest/v1/reseller_membership_orders?select=id,reseller_id", B)
check("B sees none of A's membership orders", st == 200 and all(x["reseller_id"] != rid for x in r), len(r) if isinstance(r, list) else r)
st, r = req("GET", f"{URL}/rest/v1/marketplace_orders?select=id&buyer_id=eq.{uA}", B)
check("B cannot read A's marketplace orders", st == 200 and r == [], r)
st, r = req("GET", f"{URL}/rest/v1/user_notifications?select=id&user_id=eq.{uA}", B)
check("B cannot read A's notifications", st == 200 and r == [], r)
st, r = rpc(B, "mm_notifications", {"p_limit": 50})
check("B's bell has none of A's membership events", st == 200 and not any(n.get("event") == "reseller.membership.order_created" for n in r.get("notifications", [])), [n.get("event") for n in r.get("notifications", [])])
st, r = req("POST", f"{URL}/rest/v1/user_notifications", B, {"user_id": uA, "type": "info", "message": "spoof", "action_url": "https://evil.example"})
check("B cannot write into A's inbox", st in (401, 403), (st, str(r)[:100]))
st, mine = rpc(A, "mm_notifications", {"p_limit": 5})
nid = (mine.get("notifications") or [{}])[0].get("id") if isinstance(mine, dict) else None
st, r = rpc(B, "mm_notification_read", {"p_id": nid, "p_dismiss": True})
check("B cannot mark or dismiss A's notification", isinstance(r, dict) and r.get("ok") is False, r)

# --- staff-only
st, r = rpc(A, "mm_reseller_attention", {})
check("reseller cannot read the Reseller Manager signals", isinstance(r, dict) and r.get("ok") is False, r)
st, r = rpc(F, "mm_reseller_attention", {})
check("finance/operator can read them", isinstance(r, dict) and r.get("ok") is True, r)
st, r = req("GET", f"{URL}/rest/v1/franchise_applications?select=id", A)
check("applicant cannot read franchise applications", st == 200 and r == [], r)
st, r = rpc(B, "review_franchise_application", {"p_id": "00000000-0000-0000-0000-000000000000", "p_status": "approved", "p_notes": None})
check("applicant cannot review franchise applications", st >= 400, (st, str(r)[:100]))
st, r = rpc(B, "review_influencer_application", {"p_application_id": "00000000-0000-0000-0000-000000000000", "p_status": "approved", "p_rejection_reason": None})
check("applicant cannot review influencer applications", st >= 400, (st, str(r)[:100]))
st, r = rpc(None, "submit_influencer_application", {"p_full_name": "x", "p_email": "x@example.com", "p_phone": None, "p_country": None, "p_region": None, "p_social_profiles": {}, "p_followers": 1, "p_niche": "x", "p_content_types": None, "p_engagement_rate": None, "p_payment_details": {}, "p_tax_details": {}, "p_agreement_accepted": True, "p_consent_accepted": True, "p_terms_accepted": True})
check("anonymous cannot submit an influencer application", st in (401, 403, 404), (st, str(r)[:100]))

print(f"\n{sum(1 for _, ok in results if ok)}/{len(results)} passed")
json.dump([{"check": n, "ok": ok} for n, ok in results], open(os.environ.get("REPORT", "reseller-security-checks.json"), "w"))
