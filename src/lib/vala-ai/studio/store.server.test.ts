// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { closeDb, all, schemaVersion } from "../db.server";
import { backupDatabase, inspectDatabase, restoreDatabase } from "../backup.server";
import { studioStore } from "./store.server";
import type { Operator } from "../auth.server";

const root = mkdtempSync(join(tmpdir(), "vala-studio-store-"));
const previous = process.env.VALA_AI_DATA_DIR;
const owner: Operator = {
  id: "owner",
  email: "owner@example.invalid",
  name: "Owner",
  role: "owner",
};
beforeEach(() => {
  closeDb();
  process.env.VALA_AI_DATA_DIR = join(root, crypto.randomUUID());
});
afterAll(() => {
  closeDb();
  if (previous === undefined) delete process.env.VALA_AI_DATA_DIR;
  else process.env.VALA_AI_DATA_DIR = previous;
  rmSync(root, { recursive: true, force: true });
});

describe("imported Vala studio persistence", () => {
  it("shares the backed-up module DB and migrates to schema 4", () => {
    expect(schemaVersion()).toBe(4);
    expect(all("select * from projects")).toEqual([]);
  });
  it("backs up and restores the imported source records with the existing backup engine", async () => {
    const store = studioStore(owner);
    const project = await store.from("dev_projects").insert({ name: "Backup fixture" }).single();
    const snapshot = backupDatabase({ dir: join(root, "backups"), keep: 7 });
    expect(inspectDatabase(snapshot.path).ok).toBe(true);
    closeDb();
    const restored = join(root, `restored-${crypto.randomUUID()}`);
    restoreDatabase(snapshot.path, restored);
    process.env.VALA_AI_DATA_DIR = restored;
    expect(schemaVersion()).toBe(4);
    const loaded = await studioStore(owner).from("dev_projects").eq("id", project.data.id).single();
    expect(loaded.data.name).toBe("Backup fixture");
  });
  it("persists defaults and stable project identifiers", async () => {
    const store = studioStore(owner);
    const { data } = await store
      .from("dev_projects")
      .insert({ name: "Client requirement" })
      .select()
      .single();
    expect(data.project_code).toMatch(/^SV-PROJECT-/);
    expect(data.status).toBe("intake");
    const loaded = await store.from("dev_projects").select().eq("id", data.id).single();
    expect(loaded.data).toEqual(data);
  });
  it("upserts library records by source key without replacing IDs", async () => {
    const store = studioStore(owner);
    const first = await store
      .from("library_items")
      .upsert(
        { source_key: "disk:one", name: "One", source_location: "local" },
        { onConflict: "source_key" },
      )
      .single();
    const next = await store
      .from("library_items")
      .upsert(
        { source_key: "disk:one", name: "Renamed", source_location: "local" },
        { onConflict: "source_key" },
      )
      .single();
    expect(next.data.id).toBe(first.data.id);
    expect(next.data.modules).toEqual([]);
    expect((await store.from("library_items").select()).count).toBe(1);
  });
  it("returns the imported project/client relationship", async () => {
    const store = studioStore(owner);
    const client = await store
      .from("dev_clients")
      .insert({ external_id: "cp:1", name: "Client" })
      .single();
    await store.from("dev_projects").insert({ name: "Project", client_id: client.data.id });
    const project = await store.from("dev_projects").select("*, dev_clients(name)").single();
    expect(project.data.dev_clients?.name).toBe("Client");
  });
  it("keeps audits and versions append-only at database level", async () => {
    const store = studioStore(owner);
    const audit = await store.from("dev_audit_logs").insert({ action: "project.create" }).single();
    expect(audit.data.actor).toBe(owner.id);
    await expect(
      store.from("dev_audit_logs").update({ action: "changed" }).eq("id", audit.data.id),
    ).rejects.toThrow(/immutable/);
    await expect(store.from("dev_audit_logs").delete().eq("id", audit.data.id)).rejects.toThrow(
      /immutable/,
    );
    const version = await store
      .from("dev_versions")
      .insert({ project_id: "p", version_code: "v1" })
      .single();
    await expect(
      store.from("dev_versions").update({ version_code: "v2" }).eq("id", version.data.id),
    ).rejects.toThrow(/immutable/);
  });
  it("enforces read-only viewers on mutation", async () => {
    const viewer = studioStore({ ...owner, role: "viewer" });
    await expect(viewer.from("dev_projects").insert({ name: "Denied" })).rejects.toThrow(
      /operator role/,
    );
    expect((await viewer.from("dev_projects").select()).data).toEqual([]);
  });
  it("does not expose or overwrite another operator's build by ID", async () => {
    const first = studioStore(owner);
    const build = await first
      .from("agent_builds")
      .insert({ data: { project: "private" } })
      .single();
    const second = studioStore({ ...owner, id: "other" });
    expect(
      (await second.from("agent_builds").eq("id", build.data.id).maybeSingle()).data,
    ).toBeNull();
    await expect(
      second.from("agent_builds").upsert({ id: build.data.id, data: {} }),
    ).rejects.toThrow(/another Control Panel/);
  });
  it("surfaces cardinality errors and applies numeric score ordering", async () => {
    const store = studioStore(owner);
    await expect(store.from("dev_projects").single()).rejects.toThrow(/found 0/);
    await store.from("dev_matches").insert([{ score: 9 }, { score: 100 }]);
    expect(
      (await store.from("dev_matches").order("score", { ascending: false }).limit(1)).data[0]
        ?.score,
    ).toBe(100);
  });
});
