import { readFileSync } from "node:fs";
function readEnv(f){const o={};for(const l of readFileSync(f,"utf8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)o[m[1]]=m[2].trim().replace(/^'|'$/g,"");}return o;}
const ops = readEnv(".env.ops");
const url = ops.SUPABASE_URL, key = ops.SUPABASE_SERVICE_ROLE_KEY;
const email = ops.SV_LOGIN_RESELLER, password = ops.SV_PW_TEST;

const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json());
if (!auth.access_token) { console.error("sign-in failed"); process.exit(1); }
console.log("signed in as the reseller account\n");

const as = { apikey: key, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" };
for (const table of ["crm_customers", "leads", "licenses", "resellers", "reseller_commissions"]) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers: as });
  const body = await res.text();
  console.log(`read  ${table.padEnd(22)} http ${res.status} ${res.ok ? `rows:${JSON.parse(body).length}` : body.slice(0, 90)}`);
}
console.log();
const probe = await fetch(`${url}/rest/v1/crm_customers`, {
  method: "POST", headers: { ...as, Prefer: "return=representation" },
  body: JSON.stringify({ contact_name: "__rls probe__", company_name: "__rls probe__" }),
});
const probeBody = await probe.text();
console.log(`write crm_customers          http ${probe.status} ${probe.ok ? "accepted" : probeBody.slice(0, 120)}`);
if (probe.ok) {
  const id = JSON.parse(probeBody)[0]?.id;
  await fetch(`${url}/rest/v1/crm_customers?id=eq.${id}`, { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}` } });
  console.log("probe row removed again");
}
