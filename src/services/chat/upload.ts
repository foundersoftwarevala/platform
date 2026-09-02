import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string;

export interface UploadHandle {
  promise: Promise<{ path: string }>;
  cancel: () => void;
}

/**
 * Real resumable-free upload to Storage over XHR so the UI gets true byte
 * progress and can cancel an in-flight transfer (the JS SDK exposes neither).
 */
export function uploadToBucket(options: {
  bucket: string;
  path: string;
  file: File;
  onProgress?: (percent: number) => void;
}): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<{ path: string }>((resolve, reject) => {
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        reject(new Error("Your session expired. Sign in again to upload files."));
        return;
      }
      xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${options.bucket}/${options.path}`, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
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
      xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and retry."));
      xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
      xhr.send(options.file);
    })();
  });

  return { promise, cancel: () => xhr.abort() };
}

function parseStorageError(body: string, status: number) {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? `Upload failed (${status})`;
  } catch {
    return `Upload failed (${status})`;
  }
}
