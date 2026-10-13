import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { studioOwner, studioViewer } from "./auth.functions";
import { PAGES } from "./manager-pages";

const name = z
  .string()
  .refine((value) => Object.hasOwn(PAGES, value), "Unknown module management page.");
const row = z.record(z.union([z.string(), z.boolean()]));
const state = z.object({ rows: z.array(row).max(2000), version: z.string().nullable() });
const READ_ONLY = new Set([
  "Users",
  "Roles",
  "Sessions",
  "AI Providers",
  "API Integration",
  "Settings",
  "Languages",
  "Database",
  "Usage",
]);

export const loadManagerRecordsFn = createServerFn({ method: "POST" })
  .middleware([studioViewer])
  .inputValidator((data: unknown) => z.object({ name }).parse(data))
  .handler(async ({ data, context }) => {
    const { all, one } = await import("../db.server");
    let rows: z.infer<typeof row>[] | null = null;
    if (["Users", "Sessions", "Roles"].includes(data.name)) {
      rows = all<{ id: string; email: string; role: string; last_seen_at: string }>(
        "select * from people order by last_seen_at desc",
      ).map((person) => ({
        id: person.id,
        name: person.email,
        email: person.email,
        user: person.email,
        role: person.role,
        active: true,
        device: "Control Panel",
        since: person.last_seen_at,
        access: "Managed by the Control Panel",
        deploy: person.role === "owner",
      }));
      if (!rows.length)
        rows = [
          {
            id: context.studioOperator.id,
            name: context.studioOperator.email,
            email: context.studioOperator.email,
            role: context.studioOperator.role,
            active: true,
          },
        ];
    } else if (["AI Providers", "API Integration"].includes(data.name)) {
      const { modelStatus } = await import("../model.server");
      const model = await modelStatus();
      rows = [
        {
          id: "configured-model",
          name: model.source,
          model: model.model ?? "UNVERIFIED",
          url: model.url,
          status: model.online ? "Connected" : `Unavailable: ${model.error ?? "UNVERIFIED"}`,
        },
      ];
    } else if (data.name === "Settings") {
      rows = [
        { id: "access", name: "Access", value: "Existing Control Panel session" },
        { id: "model", name: "Model configuration", value: "Managed in Vala AI Settings" },
      ];
    } else if (data.name === "Database") {
      rows = [
        {
          id: "vala-sqlite",
          name: "Vala AI SQLite",
          purpose: "Projects, source copies, build snapshots and append-only history",
        },
      ];
    } else if (READ_ONLY.has(data.name)) {
      rows = [];
    }
    if (rows) return { rows, version: null, readOnly: true };
    const saved = one<{ value_json: string; updated_at: string }>(
      "select value_json, updated_at from settings where key = ?",
      `studio.manager.${data.name}`,
    );
    return {
      rows: saved ? state.shape.rows.parse(JSON.parse(saved.value_json)) : [],
      version: saved?.updated_at ?? null,
      readOnly: false,
    };
  });

export const saveManagerRecordsFn = createServerFn({ method: "POST" })
  .middleware([studioOwner])
  .inputValidator((data: unknown) => state.extend({ name }).parse(data))
  .handler(async ({ data, context }) => {
    if (READ_ONLY.has(data.name))
      throw new Error("This page is managed by the existing Control Panel or Vala AI Settings.");
    const { one, run, tx } = await import("../db.server");
    const { audit } = await import("./developer/developer.server");
    const version = tx(() => {
      const key = `studio.manager.${data.name}`;
      const current = one<{ updated_at: string }>(
        "select updated_at from settings where key = ?",
        key,
      );
      if ((current?.updated_at ?? null) !== data.version)
        throw new Error("These records changed. Reload before saving.");
      const next = new Date(
        Math.max(Date.now(), Date.parse(current?.updated_at ?? "") + 1 || 0),
      ).toISOString();
      run(
        "insert into settings(key,value_json,updated_at,updated_by) values(?,?,?,?) on conflict(key) do update set value_json=excluded.value_json, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
        key,
        JSON.stringify(data.rows),
        next,
        context.studioOperator.id,
      );
      return next;
    });
    await audit("studio.manager.save", { page: data.name, rows: data.rows.length });
    return { version };
  });
