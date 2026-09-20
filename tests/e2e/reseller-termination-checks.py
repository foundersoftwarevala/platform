"""Termination-is-final verification with real sessions.
   python3 term-e2e.py <accounts.json> <state.json> phase1|phase2
   phase1: apply, approve, terminate, bypass attempts, re-apply   (then the browser step approves the new application)
   phase2: after-approval checks, audit, isolation, pricing protection."""
import json, os, sys, urllib.request, urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/"); ANON = os.environ["ANON"]
SITE = "https://softwarevala.net"
accts = {a["label"]: a for a in json.load(open(sys.argv[1]))}
STATE, PHASE = sys.argv[2], sys.argv[3]
state = json.load(open(STATE)) if PHASE == "phase2" else {}
results = []

def req(method, url, token=None, body=None, headers=None):
    h = {"apikey": ANON, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    if token: h["Authorization"] = "Bearer " + token
    h.update(headers or {})
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as res:
            raw = res.read().decode(); return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw

def login(label):
    a = accts[label]
    return req("POST", URL + "/auth/v1/token?grant_type=password", body={"email": a["email"], "password": a["password"]})[1]["access_token"]

def rpc(tok, fn, args): return req("POST", f"{URL}/rest/v1/rpc/{fn}", tok, args)
def check(name, ok, detail=""):
    results.append((name, bool(ok))); print(("PASS " if ok else "FAIL ") + name + (f" — {str(detail)[:220]}" if detail != "" else ""))

A, B, S, ADM = login("applicantA"), login("applicantB"), login("staff"), login("admin")
uA = accts["applicantA"]["id"]
APP = lambda name, co: {"fullName": name, "email": "unused@example.com", "phone": "+91 98200 41736", "country": "India",
                         "companyName": co, "businessType": "Individual", "agreementAccepted": True}

def roles(uid):
    st, r = req("GET", f"{URL}/rest/v1/user_roles?select=role&user_id=eq.{uid}", ADM)
    return sorted(x["role"] for x in r) if isinstance(r, list) else r

if PHASE == "phase1":
    st, r1 = rpc(A, "submit_reseller_application", {"p_application": APP("Arjun Mehta", "Mehta Digital Solutions")})
    check("A applies: pending application with a number", st == 200 and r1.get("status") == "pending", r1)
    st, rb = rpc(B, "submit_reseller_application", {"p_application": APP("Priya Nair", "Nair Tech Partners")})
    check("B applies: pending application", st == 200 and rb.get("status") == "pending", rb)
    st, r = rpc(S, "mm_reseller_status", {"p_id": r1["id"], "p_to": "active", "p_reason": None})
    check("staff approves A's pending application", r.get("ok") is True, r.get("reason"))
    st, r = rpc(S, "mm_reseller_status", {"p_id": rb["id"], "p_to": "active", "p_reason": None})
    check("staff approves B", r.get("ok") is True, r.get("reason"))
    check("A holds the reseller role while active", "reseller" in roles(uA), roles(uA))
    st, r = rpc(S, "mm_reseller_status", {"p_id": r1["id"], "p_to": "terminated", "p_reason": None})
    check("termination without a reason is refused", r.get("ok") is False and r.get("reason") == "reason_required", r)
    st, r = rpc(S, "mm_reseller_status", {"p_id": r1["id"], "p_to": "terminated", "p_reason": "Agreement breach (E2E verification)"})
    check("staff terminates A with a reason", r.get("ok") is True, r.get("reason"))
    check("termination removes the reseller role", "reseller" not in roles(uA), roles(uA))
    for to in ("active", "pending", "paused"):
        st, r = rpc(S, "mm_reseller_status", {"p_id": r1["id"], "p_to": to, "p_reason": "try"})
        check(f"approval function refuses terminated → {to}", r.get("ok") is False and r.get("reason") == "terminated_final", r.get("reason"))
    st, r = req("PATCH", f"{URL}/rest/v1/resellers?id=eq.{r1['id']}", ADM, {"status": "active"}, {"Prefer": "return=representation"})
    check("admin direct API update terminated → active is refused", st >= 400 and "terminated" in json.dumps(r), (st, r))
    st, r = req("PATCH", f"{URL}/rest/v1/resellers?id=eq.{r1['id']}", ADM, {"status": "pending"}, {"Prefer": "return=representation"})
    check("admin direct API update terminated → pending is refused", st >= 400, (st, str(r)[:120]))
    st, r = req("PATCH", f"{URL}/rest/v1/resellers?id=eq.{r1['id']}", ADM, {"application": {"reused": True}, "code": "RSA-REUSED0000"}, {"Prefer": "return=representation"})
    check("old application/number cannot be edited or re-used", st >= 400, (st, str(r)[:120]))
    st, r = req("PATCH", f"{URL}/rest/v1/resellers?id=eq.{r1['id']}", A, {"status": "active"}, {"Prefer": "return=representation"})
    check("the terminated person cannot reactivate themselves", st >= 400 or r == [], (st, str(r)[:120]))
    st, r2 = rpc(A, "submit_reseller_application", {"p_application": dict(APP("Arjun Mehta", "Mehta Digital Solutions"), previous_reseller_id="forged")})
    check("re-application creates a NEW pending record and number", st == 200 and r2.get("duplicate") is False and r2.get("status") == "pending" and r2.get("application_number") != r1.get("application_number"), r2)
    check("re-application is linked to the terminated record (not forgeable)", r2.get("previous_application_number") == r1.get("application_number"), r2.get("previous_application_number"))
    st, again = rpc(A, "submit_reseller_application", {"p_application": APP("Arjun Mehta", "Mehta Digital Solutions")})
    check("submitting again returns the new application (no duplicate)", again.get("id") == r2.get("id") and again.get("duplicate") is True, again)
    st, old = req("GET", f"{URL}/rest/v1/resellers?select=code,status,approved_at,application&id=eq.{r1['id']}", ADM)
    check("old record kept: same number, terminated, approval and application intact",
          old and old[0]["code"] == r1["application_number"] and old[0]["status"] == "terminated" and old[0]["approved_at"] and old[0]["application"].get("companyName") == "Mehta Digital Solutions", old)
    json.dump({"r1": r1, "rb": rb, "r2": r2}, open(STATE, "w"))
else:
    r1, rb, r2 = state["r1"], state["rb"], state["r2"]
    st, new = req("GET", f"{URL}/rest/v1/resellers?select=status,approved_at&id=eq.{r2['id']}", ADM)
    check("new application approved through the normal Reseller Manager button", new and new[0]["status"] == "active", new)
    check("A holds the reseller role again (new record)", "reseller" in roles(uA), roles(uA))
    st, q = req("GET", f"{SITE}/api/partner/quote", A)
    check("A's standing resolves to the new live record (no membership yet)", st == 200 and q["partner"] and q["partner"]["state"] == "no_active_membership", q.get("partner"))
    st, q = req("GET", f"{SITE}/api/partner/quote?product=academyenroll&discount=0.9&price=1&plan=master_reseller", A)
    check("pricing protection: injected discount/price/plan ignored (list price)", st == 200 and q.get("finalPriceUsd") == q.get("listPriceUsd"), {k: q.get(k) for k in ("listPriceUsd", "finalPriceUsd", "reason")})
    st, m = req("GET", f"{URL}/rest/v1/reseller_memberships?select=id", A)
    check("membership state: none (nothing activated without payment)", st == 200 and m == [], m)
    st, aud = req("GET", f"{URL}/rest/v1/marketplace_audit_logs?select=action,created_at&entity_id=eq.{r1['id']}&order=created_at", ADM)
    acts = [x["action"] for x in aud] if isinstance(aud, list) else aud
    check("old record's audit trail intact (approved, terminated)", acts == ["reseller.active", "reseller.terminated"], acts)
    st, aud2 = req("GET", f"{URL}/rest/v1/marketplace_audit_logs?select=action&entity_id=eq.{r2['id']}&order=created_at", ADM)
    acts2 = [x["action"] for x in aud2] if isinstance(aud2, list) else aud2
    check("new record's audit trail: re-applied, then approved", acts2[:2] == ["reseller.reapplied", "reseller.active"], acts2)
    st, r = req("GET", f"{URL}/rest/v1/resellers?select=id&user_id=eq.{uA}", B)
    check("isolation: B cannot read A's reseller records", st == 200 and r == [], r)
    st, r = req("GET", f"{URL}/rest/v1/resellers?select=id,status&user_id=eq.{uA}", A)
    check("A sees own history (old terminated + new active)", st == 200 and sorted(x["status"] for x in r) == ["active", "terminated"], r)
    st, r = rpc(A, "mm_reseller_status", {"p_id": rb["id"], "p_to": "terminated", "p_reason": "x"})
    check("authorization: a reseller cannot change another reseller's status", r.get("ok") is False and r.get("reason") == "not_permitted", r)
    st, r = rpc(A, "mm_reseller_status", {"p_id": r2["id"], "p_to": "active", "p_reason": None})
    check("authorization: a reseller cannot act on their own record", r.get("ok") is False, r)
    st, r = req("PATCH", f"{URL}/rest/v1/resellers?id=eq.{r2['id']}", A, {"tier": "gold", "plan_code": "master_reseller"}, {"Prefer": "return=representation"})
    check("tier/plan protection on the live record", st >= 400 or r == [], (st, str(r)[:120]))
    st, r = rpc(A, "reseller_pricing_for", {"p_user": uA})
    check("pricing rule not callable directly", st in (401, 403), st)
    st, r = rpc(S, "mm_reseller_attention", {})
    check("manager signals still served", isinstance(r, dict) and r.get("ok") is True, r.get("ok") if isinstance(r, dict) else r)
    # Close the test accounts' live records through the normal workflow.
    for rid in (r2["id"], rb["id"]):
        st, r = rpc(S, "mm_reseller_status", {"p_id": rid, "p_to": "terminated", "p_reason": "E2E test account"})
        check("cleanup: test reseller terminated via the workflow", r.get("ok") is True, r.get("reason"))

print(f"\n{sum(1 for _, ok in results if ok)}/{len(results)} passed ({PHASE})")
