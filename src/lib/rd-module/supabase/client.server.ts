import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { moduleFetch } from "./fetch";

function createModuleAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("R&D Manager requires platform server database credentials.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: moduleFetch(key) },
  });
}

let client: ReturnType<typeof createModuleAdmin> | undefined;
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createModuleAdmin>, {
  get(_, property) {
    client ??= createModuleAdmin();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
