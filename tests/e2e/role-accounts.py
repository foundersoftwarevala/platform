"""Temporary accounts for the role language test.

  python3 role-accounts.py create /root/role-accounts.json
  python3 role-accounts.py delete /root/role-accounts.json   (deletes and verifies)

Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
"""
import json
import secrets
import sys
import time
import urllib.error
import urllib.request

import os

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

# role -> the role's workspace, and a second module of the same role.
MATRIX = [
    ("visitor", None, ["/", "/marketplace"]),
    ("customer", "customer", ["/account/purchases", "/checkout"]),
    ("vendor", "vendor", ["/dashboard/vendor", "/chat"]),
    ("author", "author", ["/dashboard/author", "/chat"]),
    ("reseller", "reseller", ["/dashboard/reseller", "/chat"]),
    ("franchise", "franchise", ["/dashboard/franchise", "/chat"]),
    ("affiliate", "affiliate", ["/dashboard/affiliate", "/chat"]),
    ("influencer", "influencer", ["/dashboard/influencer", "/chat"]),
    ("admin", "admin", ["/control-panel", "/language-manager"]),
    ("super_admin", "super_admin", ["/boss", "/admin"]),
    ("boss", "boss", ["/boss", "/marketplace-manager"]),
    ("marketplace manager (marketing)", "marketing", ["/marketplace-manager", "/seo-manager"]),
    ("support", "support", ["/support", "/support-agent"]),
    ("sales", "sales", ["/sales-crm", "/lead-manager"]),
    ("finance", "finance", ["/finance-manager", "/manager/finance"]),
    ("developer", "developer", ["/server-manager", "/dev-manager"]),
    ("seo", "seo", ["/seo-manager", "/keywords"]),
    ("employee", "employee", ["/manager/people", "/chat"]),
    ("legal", "legal", ["/legal-manager", "/chat"]),
]


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, method=method, headers=H)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def create(out):
    accounts = []
    stamp = int(time.time())
    for label, role, routes in MATRIX:
        if role is None:
            accounts.append({"role": label, "routes": routes})
            continue
        email = f"i18n-role-{role}-{stamp}@example.com"
        password = "E2e-" + secrets.token_hex(12)
        status, user = call("POST", "/auth/v1/admin/users", {
            "email": email, "password": password, "email_confirm": True,
            "user_metadata": {"full_name": f"i18n role test ({role}, temporary)"},
        })
        if status >= 300:
            print("create failed", role, status, user)
            continue
        uid = user["id"]
        status, res = call("POST", "/rest/v1/user_roles", {"user_id": uid, "role": role})
        print(label, uid, "role row", status)
        accounts.append({"role": label, "id": uid, "email": email, "password": password, "routes": routes})
    with open(out, "w") as fh:
        json.dump(accounts, fh)
    os.chmod(out, 0o600)


def delete(path):
    accounts = json.load(open(path))
    left = 0
    for a in accounts:
        uid = a.get("id")
        if not uid:
            continue
        call("DELETE", f"/rest/v1/user_roles?user_id=eq.{uid}")
        status, _ = call("DELETE", f"/auth/v1/admin/users/{uid}")
        after, _ = call("GET", f"/auth/v1/admin/users/{uid}")
        _, roles = call("GET", f"/rest/v1/user_roles?select=user_id&user_id=eq.{uid}")
        _, profiles = call("GET", f"/rest/v1/profiles?select=id&id=eq.{uid}")
        gone = after == 404 and roles == [] and profiles == []
        left += 0 if gone else 1
        print(a["role"], "delete", status, "lookup", after, "roles", roles, "profiles", profiles)
    os.remove(path)
    print("accounts still present:", left)


if __name__ == "__main__":
    {"create": create, "delete": delete}[sys.argv[1]](sys.argv[2])
