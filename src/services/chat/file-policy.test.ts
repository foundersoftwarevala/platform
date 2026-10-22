import { describe, expect, it } from "vitest";
import { chatFileRejection } from "./file-policy";

describe("chat file policy", () => {
  it("rejects executable names even if the browser reports a document MIME type", () => {
    expect(chatFileRejection("invoice.exe", "application/pdf")).toContain("Executable");
    expect(chatFileRejection("script.PS1", "text/plain")).toContain("Executable");
  });

  it("rejects unsupported and missing MIME types", () => {
    expect(chatFileRejection("page.html", "text/html")).toContain("not supported");
    expect(chatFileRejection("unknown.bin", "")).toContain("not supported");
  });

  it("accepts approved non-executable documents and media", () => {
    expect(chatFileRejection("notes.txt", "text/plain")).toBeNull();
    expect(chatFileRejection("image.png", "image/png")).toBeNull();
    expect(chatFileRejection("report.pdf", "application/pdf")).toBeNull();
  });
});
