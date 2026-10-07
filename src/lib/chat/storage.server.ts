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

export const CHAT_BUCKET = "chat-files";
/** The gateway in front of Storage accepts 25 MB per request. */
export const CHAT_FILE_MAX_BYTES = 25 * 1024 * 1024;
const SIGNED_SECONDS = 300;

function storageRelative(url: string): string {
  const at = url.indexOf("/storage/v1/");
  if (at < 0) throw new Error("Storage returned an unexpected signed URL.");
  return url.slice(at + "/storage/v1".length);
}

export async function signChatUpload(path: string): Promise<{ path: string; signedPath: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from(CHAT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "The upload could not be prepared.");
  return { path: data.path, signedPath: storageRelative(data.signedUrl) };
}

export async function signChatDownload(path: string, fileName?: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(path, SIGNED_SECONDS, fileName ? { download: fileName } : undefined);
  if (error || !data) throw new Error(error?.message ?? "The file could not be opened.");
  return storageRelative(data.signedUrl);
}
