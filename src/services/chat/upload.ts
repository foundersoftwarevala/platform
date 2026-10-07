import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string;
const PUBLISHABLE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

export interface UploadHandle {
  promise: Promise<{ path: string }>;
  cancel: () => void;
}

/** Public Storage address for a path the server signed ("/object/..."). */
export function storageUrl(signedPath: string): string {
  return `${SUPABASE_URL}/storage/v1${signedPath}`;
}

/**
 * Real resumable-free upload to Storage over XHR so the UI gets true byte
 * progress and can cancel an in-flight transfer (the JS SDK exposes neither).
 */
function xhrUpload(options: {
  method: "POST" | "PUT";
  url: string;
  path: string;
  file: File;
  token: string | null;
  onProgress?: ((percent: number) => void) | undefined;
}): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<{ path: string }>((resolve, reject) => {
    xhr.open(options.method, options.url, true);
    if (options.token) xhr.setRequestHeader("Authorization", `Bearer ${options.token}`);
    if (PUBLISHABLE_KEY) xhr.setRequestHeader("apikey", PUBLISHABLE_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    if (options.file.type) xhr.setRequestHeader("Content-Type", options.file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
        resolve({ path: options.path });
      } else {
        reject(new Error(parseStorageError(xhr.responseText, xhr.status)));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Network error while uploading. Check your connection and retry."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    xhr.send(options.file);
  });
  return { promise, cancel: () => xhr.abort() };
}

/** Upload under the person's own session, decided by the bucket's policies (avatars). */
export function uploadToBucket(options: {
  bucket: string;
  path: string;
  file: File;
  onProgress?: (percent: number) => void;
}): UploadHandle {
  let inner: UploadHandle | null = null;
  let cancelled = false;
  const promise = (async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again to upload files.");
    if (cancelled) throw new DOMException("Upload cancelled", "AbortError");
    inner = xhrUpload({
      method: "POST",
      url: `${SUPABASE_URL}/storage/v1/object/${options.bucket}/${options.path}`,
      path: options.path,
      file: options.file,
      token,
      onProgress: options.onProgress,
    });
    return inner.promise;
  })();
  return {
    promise,
    cancel: () => {
      cancelled = true;
      inner?.cancel();
    },
  };
}

/** Upload into a one-time slot the server signed after authorizing it (chat files). */
export function uploadToSignedPath(options: {
  signedPath: string;
  path: string;
  file: File;
  onProgress?: (percent: number) => void;
}): UploadHandle {
  return xhrUpload({
    method: "PUT",
    url: storageUrl(options.signedPath),
    path: options.path,
    file: options.file,
    token: null,
    onProgress: options.onProgress,
  });
}

function parseStorageError(body: string, status: number) {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? `Upload failed (${status})`;
  } catch {
    return `Upload failed (${status})`;
  }
}
