"""Temporary accounts for the final reseller E2E.  python3 final-accts.py create|delete <file>"""
import importlib.util, json, pathlib, secrets, sys, time, os
spec = importlib.util.spec_from_file_location("ra", str(pathlib.Path(__file__).with_name("role-accounts.py")))
ra = importlib.util.module_from_spec(spec); spec.loader.exec_module(ra)
PEOPLE = [("applicantA", ["customer"], "Arjun Mehta"), ("applicantB", ["customer"], "Priya Nair"),
          ("admin", ["admin"], "Platform admin (E2E)"),
          ("staff", ["finance"], "Partner desk (E2E)")]
cmd, path = sys.argv[1], sys.argv[2]
if cmd == "create":
    out = []; stamp = int(time.time())
    for label, roles, name in PEOPLE:
        email = f"e2e-{label.lower()}-{stamp}@example.com"; password = "E2e-" + secrets.token_hex(12)
        st, user = ra.call("POST", "/auth/v1/admin/users", {"email": email, "password": password, "email_confirm": True, "user_metadata": {"full_name": name}})
        if st >= 300: print("create failed", label, st, str(user)[:120]); continue
        for role in roles:
            st2, _ = ra.call("POST", "/rest/v1/user_roles", {"user_id": user["id"], "role": role})
            print(label, "role", role, st2)
        out.append({"label": label, "role": label, "id": user["id"], "email": email, "password": password, "name": name})
    json.dump(out, open(path, "w")); os.chmod(path, 0o600)
else:
    ra.delete(path)
