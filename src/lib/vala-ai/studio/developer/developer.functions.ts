import { studioOperator, studioViewer } from "@/lib/vala-ai/studio/auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Every endpoint uses the existing Control Panel session and Vala role checks.
const uuid = z.string().uuid();
const S = () => import("./developer.server");

export const devDashboardFn = createServerFn({ method: "GET" })
  .middleware([studioViewer])
  .handler(async () => (await S()).dashboard());

export const devProjectFn = createServerFn({ method: "POST" })
  .middleware([studioViewer])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => (await S()).projectDetail(data.id));

export const devImportLibraryFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) => z.object({ json: z.string().max(5_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const s = await S();
    let raw: unknown;
    try {
      raw = JSON.parse(data.json);
    } catch {
      throw new Error("Index file is not valid JSON.");
    }
    const items = z.array(s.libraryItemInput).min(1).max(2000).safeParse(raw);
    if (!items.success)
      throw new Error(
        "Index format error: " +
          items.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")} ${i.message}`)
            .join("; "),
      );
    return s.importLibrary(items.data);
  });

export const devCreateProjectFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        client_name: z.string().max(200).nullish(),
        requirement: z.string().trim().min(5).max(10000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const r = await (await S()).createProject(data);
    return {
      projectId: r.project.id,
      projectCode: r.project.project_code,
      requirementId: r.requirement.id,
    };
  });

export const devAnalyzeFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) => z.object({ requirementId: uuid }).parse(d))
  .handler(async ({ data }) => (await S()).analyzeRequirement(data.requirementId));

export const devMatchFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) => z.object({ requirementId: uuid }).parse(d))
  .handler(async ({ data }) => (await S()).matchRequirement(data.requirementId));

export const devSelectSourceFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) => z.object({ projectId: uuid, itemId: uuid }).parse(d))
  .handler(async ({ data }) => {
    await (await S()).selectSource(data.projectId, data.itemId);
    return { ok: true };
  });

export const devCreateVersionFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: uuid,
        change_history: z.string().max(5000),
        test_status: z.enum(["not_tested", "passed", "failed"]),
        delivery_status: z.enum(["not_delivered", "delivered"]),
        license_type: z.string().max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const v = await (
      await S()
    ).createVersion({
      projectId: data.projectId,
      change_history: data.change_history,
      test_status: data.test_status,
      delivery_status: data.delivery_status,
      license_info: { type: data.license_type },
      build_info: { created_via: "developer-panel" },
    });
    return { id: v.id, version_code: v.version_code };
  });

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const devWorkspaceFn = createServerFn({ method: "POST" })
  .middleware([studioViewer])
  .inputValidator((d: unknown) => z.object({ projectId: uuid }).parse(d))
  .handler(async ({ data }) => (await S()).getWorkspace(data.projectId));

export const devCreateWorkspaceFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: uuid,
        files: z
          .array(z.object({ path: z.string().min(1).max(500), content: z.string().max(200_000) }))
          .min(1)
          .max(400),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.files.reduce((n, f) => n + f.content.length, 0) > 3_000_000)
      throw new Error("Workspace too large (max ~3 MB of text).");
    return (await S()).createWorkspace(data.projectId, data.files);
  });

export const devBrandWorkspaceFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: uuid,
        name: z.string().trim().min(1).max(100),
        primary: hex,
        secondary: hex,
        tagline: z.string().max(200).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { projectId, ...b } = data;
    return (await S()).applyBranding(projectId, b);
  });

const pid = (d: unknown) => z.object({ projectId: uuid }).parse(d);
export const devDevelopFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator(pid)
  .handler(async ({ data }) => (await S()).developWorkspace(data.projectId));
export const devTestFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator(pid)
  .handler(async ({ data }) => (await S()).testWorkspace(data.projectId));
export const devFixFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator(pid)
  .handler(async ({ data }) => (await S()).fixWorkspace(data.projectId));
export const devDeliverFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z.object({ projectId: uuid, license: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => (await S()).deliverProject(data.projectId, data.license));
export const devDeployFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: uuid,
        target: z.string().trim().min(1).max(200),
        url: z.string().url().max(500).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    (await S()).deployProject(data.projectId, data.target, data.url ?? null),
  );
export const devReportFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: uuid,
        kind: z.enum(["issue", "upgrade"]),
        text: z.string().trim().min(3).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => (await S()).reportIssue(data.projectId, data.kind, data.text));
export const devRecoverFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator(pid)
  .handler(async ({ data }) => (await S()).recoverIssue(data.projectId));
export const devUpgradeFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z.object({ projectId: uuid, license: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => (await S()).buildUpgrade(data.projectId, data.license));
export const devFindProjectFn = createServerFn({ method: "POST" })
  .middleware([studioViewer])
  .inputValidator((d: unknown) => z.object({ code: z.string().trim().min(5).max(40) }).parse(d))
  .handler(async ({ data }) => (await S()).findByProjectCode(data.code));
export const devAnswerFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z
      .object({
        requirementId: uuid,
        answers: z.array(z.object({ q: z.string().max(500), a: z.string().max(2000) })).max(30),
      })
      .parse(d),
  )
  .handler(async ({ data }) => (await S()).answerMissing(data.requirementId, data.answers));
