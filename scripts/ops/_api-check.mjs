import { readFileSync } from "node:fs";
function readEnv(f){const o={};for(const l of readFileSync(f,"utf8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)o[m[1]]=m[2].trim().replace(/^'|'$/g,"");}return o;}
const ops = readEnv(".env.ops");
const auth = await fetch(`${ops.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method:"POST", headers:{ apikey: ops.SUPABASE_SERVICE_ROLE_KEY, "Content-Type":"application/json" },
  body: JSON.stringify({ email: ops.SV_LOGIN_CONTROL_PANEL, password: ops.SV_PW_CONTROL_PANEL }),
}).then(r=>r.json());
if(!auth.access_token){ console.error("sign-in failed"); process.exit(1); }
const site = "https://softwarevala.net";
for (const r of ["resellers","customers","reseller_commission_rules","reseller_payouts","reseller_memberships","licences","orders","products","audit_logs","reseller_notifications"]) {
  const res = await fetch(`${site}/api/manager/resource?resource=${r}&limit=3`, {
    headers: { Authorization: `Bearer ${auth.access_token}` },
  });
  const text = await res.text();
  let note = text.slice(0,90);
  if (res.ok) { try { const j = JSON.parse(text); note = `rows:${(j.rows??j.data??j).length ?? "?"}`; } catch {} }
  console.log(`${String(res.status).padEnd(4)} ${r.padEnd(28)} ${note}`);
}
