// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDb } from "./db.server.ts";
import { generateSite } from "./builder.server.ts";

const root = mkdtempSync(join(tmpdir(), "vala-builder-"));

beforeAll(() => {
  process.env.VALA_AI_DATA_DIR = root;
  closeDb();
});
afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

describe("website builder", () => {
  it("falls back to an offline template containing the business name and theme color", async () => {
    const html = await generateSite("clinic", "City Pet Clinic", "modern");
    expect(html).toContain("City Pet Clinic");
    expect(html).toContain("#2563eb");
    expect(html.toLowerCase()).toContain("<html");
  });

  it("uses the requested theme color", async () => {
    const html = await generateSite("store", "Rangrez Store", "playful");
    expect(html).toContain("#db2777");
  });
});
