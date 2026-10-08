/**
 * Chat files in the existing Storage bucket, authorized here.
 *
 * The bytes stay in the `chat-files` bucket. Who may put a file there or read
 * one back is decided by the Chat server functions against the canonical
 * sv_platform conversation (the bucket's own policies look up participants in
 * a database that never holds these conversations). The server then signs one
 * short-lived URL with the service key.
 *
 * Signed URLs are returned relative to the Storage API root ("/object/..."):
 * the server reaches Storage through a loopback gateway the browser cannot
 * reach, and the browser prefixes its own public Storage address.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deploymentSetting } from "@/lib/seo/seo-store.server";

export const CHAT_BUCKET = "chat-files";
/** The gateway in front of Storage accepts 25 MB per request. */
export const CHAT_FILE_MAX_BYTES = 25 * 1024 * 1024;
const SIGNED_SECONDS = 300;

/**
 * The files live in the hosted Storage project, which accepts only that
 * project's own secret. The server's SUPABASE_SERVICE_ROLE_KEY is issued by
 * the VPS (for its PostgREST) and Storage refuses it ("signature verification
 * failed"), so Storage gets its own key: SUPABASE_STORAGE_SERVICE_KEY. Where it
 * is not set (a local setup pointing everything at the hosted project) the
 * service key is the hosted one and is used as before.
 */
let storageClient: SupabaseClient | undefined;
function storage(): SupabaseClient {
  if (storageClient) return storageClient;
  const url = deploymentSetting("SUPABASE_URL");
  const key =
    deploymentSetting("SUPABASE_STORAGE_SERVICE_KEY") ||
    deploymentSetting("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Chat file storage is not configured.");
  const opaque = key.startsWith("sb_secret_");
  storageClient = createClient(url, key, {
    global: {
      // New Supabase secret keys travel as apikey only, never as a bearer JWT.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (opaque && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return storageClient;
}

function storageRelative(url: string): string {
  const at = url.indexOf("/storage/v1/");
  if (at < 0) throw new Error("Storage returned an unexpected signed URL.");
  return url.slice(at + "/storage/v1".length);
}

export async function signChatUpload(path: string): Promise<{ path: string; signedPath: string }> {
  const { data, error } = await storage().storage.from(CHAT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "The upload could not be prepared.");
  return { path: data.path, signedPath: storageRelative(data.signedUrl) };
}

export async function signChatDownload(path: string, fileName?: string): Promise<string> {
  const { data, error } = await storage().storage
    .from(CHAT_BUCKET)
    .createSignedUrl(path, SIGNED_SECONDS, fileName ? { download: fileName } : undefined);
  if (error || !data) throw new Error(error?.message ?? "The file could not be opened.");
  return storageRelative(data.signedUrl);
}
