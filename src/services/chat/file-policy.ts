const EXECUTABLE_SUFFIX = /\.(?:app|bat|cmd|com|cpl|dll|dmg|exe|hta|jar|js|mjs|cjs|msi|php|pl|ps1|py|rb|scr|sh|vbs)$/i;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
]);

export function chatFileRejection(fileName: string, mimeType: string): string | null {
  if (EXECUTABLE_SUFFIX.test(fileName.trim())) {
    return "Executable files are not allowed in chat.";
  }
  const normalizedMime = mimeType.trim().toLowerCase().split(";", 1)[0] ?? "";
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return "This file type is not supported in chat.";
  }
  return null;
}
