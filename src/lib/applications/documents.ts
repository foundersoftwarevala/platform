import { getRole } from "./config";

/**
 * The rules for a document attached to an application, shared by the form
 * (to say no before anything is sent) and the server (which decides).
 */

/** Five megabytes: a scanned ID or a certificate, not a video of one. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const DOCUMENT_TYPES = [
  { mime: "application/pdf", ext: "pdf", label: "PDF" },
  { mime: "image/jpeg", ext: "jpg", label: "JPEG" },
  { mime: "image/png", ext: "png", label: "PNG" },
  { mime: "image/webp", ext: "webp", label: "WebP" },
] as const;

export type DocumentMime = (typeof DOCUMENT_TYPES)[number]["mime"];

/** What the <input type="file"> offers, so the picker shows only these. */
export const DOCUMENT_ACCEPT = DOCUMENT_TYPES.map((t) => t.mime).join(",");

/**
 * What a file actually is, from its first bytes.
 *
 * A browser reports a type from the file's name, and a name is whatever the
 * sender chose, so the type is read from the content instead. Anything that is
 * not one of the four accepted formats is refused, whatever it is called.
 */
export function sniffDocumentType(head: Uint8Array): DocumentMime | null {
  const at = (i: number) => head[i];
  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46) return "application/pdf"; // %PDF
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "image/png";
  const text = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (head.length >= 12 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function extensionFor(mime: DocumentMime): string {
  return DOCUMENT_TYPES.find((t) => t.mime === mime)?.ext ?? "bin";
}

/** The document fields a role's form has - the only fields a file may be attached to. */
export function documentFields(role: string): { name: string; label: string }[] {
  const config = getRole(role);
  if (!config) return [];
  return config.sections
    .flatMap((section) => section.fields)
    .filter((field) => field.type === "file")
    .map((field) => ({ name: field.name, label: field.label }));
}

/** A reason to refuse a file before it is sent, or null when it is acceptable. */
export function checkDocument(file: { size: number; type: string }): string | null {
  if (file.size <= 0) return "The file is empty.";
  if (file.size > MAX_DOCUMENT_BYTES) return "The file is larger than 5 MB.";
  if (file.type && !DOCUMENT_TYPES.some((t) => t.mime === file.type)) {
    return "Upload a PDF, JPEG, PNG or WebP file.";
  }
  return null;
}
