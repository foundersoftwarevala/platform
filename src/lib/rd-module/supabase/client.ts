import { createClient } from "@supabase/supabase-js";
import { supabase as platform } from "@/integrations/supabase/client";
import type { Database } from "./types";
import { moduleFetch } from "./fetch";

function createModuleClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("R&D Manager requires the platform Supabase configuration.");
  return createClient<Database>(url, key, {
    global: { fetch: moduleFetch(key) },
    accessToken: async () => {
      const { data, error } = await platform.auth.getSession();
      if (error) throw error;
      return data.session?.access_token ?? null;
    },
  });
}

let client: ReturnType<typeof createModuleClient> | undefined;
export const supabase = new Proxy({} as ReturnType<typeof createModuleClient>, {
  get(_, property) {
    client ??= createModuleClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
