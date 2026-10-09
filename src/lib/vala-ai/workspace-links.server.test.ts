// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb } from "./db.server.ts";
import {
  deleteWorkspaceFile,
  readWorkspaceFile,
  resolveInside,
  writeWorkspaceFile,
  type Workspace,
} from "./workspace.server.ts";

/*
 * Links committed to a repository (or created by a check) must not let a read,
 * write or delete reach outside the workspace. Directory links are tested with
 * the "junction" type, which Windows allows without special privileges and which
 * is an ordinary symlink elsewhere. File symlinks and dangling links need a
 * privilege on Windows; where they cannot be created, those cases are skipped
 * and say so.
 */

const root = mkdtempSync(join(tmpdir(), "vala-links-"));
process.env.VALA_AI_DATA_DIR = join(root, "data");
const wsPath = join(root, "workspace");
const outside = join(root, "outside");
mkdirSync(wsPath, { recursive: true });
mkdirSync(join(wsPath, ".git"), { recursive: true });
mkdirSync(join(wsPath, "inner"), { recursive: true });
mkdirSync(outside, { recursive: true });
writeFileSync(join(outside, "secret.txt"), "outside secret");
writeFileSync(join(wsPath, "inner", "ok.txt"), "inside");
const ws = {
  id: "W-TEST",
  project_id: "VP-TEST",
  path: wsPath,
  base_commit: null,
  status: "ready",
  error: null,
  created_at: "",
} as Workspace;

function tryLink(target: string, path: string, type: "junction" | "file" | "dir"): boolean {
  try {
    symlinkSync(target, path, type);
    return true;
  } catch {
    return false;
  }
}

const dirLink = tryLink(outside, join(wsPath, "escape"), "junction");
const innerLink = tryLink(join(wsPath, "inner"), join(wsPath, "alias"), "junction");
const gitLink = tryLink(join(wsPath, ".git"), join(wsPath, "gitlink"), "junction");
const fileLink = tryLink(join(outside, "secret.txt"), join(wsPath, "secret-link.txt"), "file");
const dangling = tryLink(join(outside, "does-not-exist.txt"), join(wsPath, "dangling.txt"), "file");
if (!fileLink)
  console.warn(
    "[workspace-links] file symlinks cannot be created on this machine; file-link cases are skipped.",
  );
if (!dangling)
  console.warn(
    "[workspace-links] dangling symlinks cannot be created on this machine; that case is skipped.",
  );

afterAll(() => {
  closeDb();
  rmSync(root, { recursive: true, force: true });
});

describe("workspace path guard and links", () => {
  it("creates the directory links these tests depend on", () => {
    expect(dirLink).toBe(true);
    expect(innerLink).toBe(true);
    expect(gitLink).toBe(true);
  });

  it("refuses to read through a directory link that leads outside", () => {
    expect(() => readWorkspaceFile(ws, "escape/secret.txt")).toThrow(/through a link/);
  });

  it("refuses to write through a directory link that leads outside, and writes nothing there", () => {
    expect(() => writeWorkspaceFile(ws, "escape/new.txt", "x")).toThrow(/through a link/);
    expect(existsSync(join(outside, "new.txt"))).toBe(false);
  });

  it("refuses a not-yet-existing nested path below an outside link", () => {
    expect(() => writeWorkspaceFile(ws, "escape/deeper/new.txt", "x")).toThrow(/through a link/);
    expect(existsSync(join(outside, "deeper"))).toBe(false);
  });

  it("refuses to delete through an outside link", () => {
    expect(() => deleteWorkspaceFile(ws, "escape/secret.txt")).toThrow(/through a link/);
    expect(readFileSync(join(outside, "secret.txt"), "utf8")).toBe("outside secret");
  });

  it("refuses a link that leads into .git", () => {
    expect(() => readWorkspaceFile(ws, "gitlink/config")).toThrow(/not editable/);
  });

  it("allows a link that stays inside the workspace", () => {
    expect(readWorkspaceFile(ws, "alias/ok.txt").content).toBe("inside");
    writeWorkspaceFile(ws, "alias/written.txt", "fine");
    expect(readFileSync(join(wsPath, "inner", "written.txt"), "utf8")).toBe("fine");
  });

  it("allows new files and folders that do not exist yet", () => {
    writeWorkspaceFile(ws, "new/dir/file.txt", "hello");
    expect(readFileSync(join(wsPath, "new", "dir", "file.txt"), "utf8")).toBe("hello");
  });

  it("still refuses lexical escapes", () => {
    expect(() => resolveInside(ws, "../outside/secret.txt")).toThrow(/outside the workspace/);
    expect(() => resolveInside(ws, ".git/config")).toThrow(/not editable/);
  });

  it.skipIf(!fileLink)("refuses to read or overwrite through a file symlink to outside", () => {
    expect(() => readWorkspaceFile(ws, "secret-link.txt")).toThrow(/through a link/);
    expect(() => writeWorkspaceFile(ws, "secret-link.txt", "overwritten")).toThrow(
      /through a link/,
    );
    expect(readFileSync(join(outside, "secret.txt"), "utf8")).toBe("outside secret");
  });

  it.skipIf(!dangling)("refuses to write through a dangling link", () => {
    expect(() => writeWorkspaceFile(ws, "dangling.txt", "x")).toThrow(/through a link/);
    expect(existsSync(join(outside, "does-not-exist.txt"))).toBe(false);
  });
});
