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
let attachmentClient: ReturnType<typeof createClient> | undefined;

export function rdAttachmentStorage() {
  if (!attachmentClient) {
    const separate = Boolean(
      process.env.SUPABASE_STORAGE_URL || process.env.SUPABASE_STORAGE_SERVICE_KEY,
    );
    const url = separate ? process.env.SUPABASE_STORAGE_URL : process.env.SUPABASE_URL;
    const key = separate
      ? process.env.SUPABASE_STORAGE_SERVICE_KEY
      : process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("R&D attachment storage credentials are not configured.");
    attachmentClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: moduleFetch(key) },
    });
  }
  return attachmentClient.storage.from("rd-attachments");
}

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createModuleAdmin>, {
  get(_, property) {
    client ??= createModuleAdmin();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
