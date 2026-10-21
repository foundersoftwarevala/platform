import { readFileSync, writeFileSync } from "node:fs";

const sqlPath = "supabase/migrations/20260907010000_operator_gate_fix.sql";
const outputPath = "src/lib/auth/operator-roles.generated.ts";
const sql = readFileSync(sqlPath, "utf8");
const match = sql.match(
  /create\s+or\s+replace\s+function\s+public\.mm_is_operator\b[\s\S]*?ur\.role\s+in\s*\(([^)]*)\)/i,
);

if (!match) {
  throw new Error(`Could not extract the mm_is_operator role list from ${sqlPath}.`);
}

const roles = [...match[1].matchAll(/'([a-z_]+)'/gi)].map(([, role]) => role);
if (roles.length === 0 || new Set(roles).size !== roles.length) {
  throw new Error(`The mm_is_operator role list in ${sqlPath} is empty or duplicated.`);
}

const generated = `// Generated from mm_is_operator() in the canonical migration. Do not edit by hand.
export const SQL_OPERATOR_ROLES = [
${roles.map((role) => `  "${role}",`).join("\n")}
] as const;

const SQL_OPERATOR_ROLE_SET: ReadonlySet<string> = new Set(SQL_OPERATOR_ROLES);

export function isOperatorRole(role: string): boolean {
  return SQL_OPERATOR_ROLE_SET.has(role);
}
`;

writeFileSync(outputPath, generated);
console.log(`Generated ${outputPath} from ${sqlPath} (${roles.length} roles).`);
