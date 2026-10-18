import postgres, { type Sql } from "postgres";

let pool: Sql | undefined;

/** The existing canonical VPS database; never an HTTP database gateway. */
export async function db(): Promise<Sql> {
  if (pool) return pool;
  const url = (process.env.I18N_DATABASE_URL ?? process.env.VPS_DATABASE_URL)?.trim();
  if (!url)
    throw new Error("A canonical native PostgreSQL URL is required for the language module.");
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("The language database must be a PostgreSQL connection.");
  }
  if (decodeURIComponent(parsed.pathname.slice(1)) !== "sv_platform")
    throw new Error("The language module must use the canonical sv_platform database.");
  pool = postgres(url, {
    max: 4,
    idle_timeout: 30,
    connect_timeout: 10,
    connection: { statement_timeout: 30_000, application_name: "sv-i18n" },
    onnotice: () => {},
  });
  return pool;
}
