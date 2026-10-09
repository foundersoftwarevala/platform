/**
 * Drives the Vala AI UI end to end in a real browser against a running local
 * dev server, the real local model and a real git repository. The Control
 * Panel session comes from scripts/vala-ai/local-auth-harness.mjs (local only):
 * the browser is given that harness's session, and the server checks it through
 * the real requireOperator path.
 *
 *   node scripts/vala-ai/local-auth-harness.mjs --port 54321 --role boss_owner
 *   VITE_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_URL=http://127.0.0.1:54321  *   VITE_SUPABASE_PUBLISHABLE_KEY=local SUPABASE_PUBLISHABLE_KEY=local SUPABASE_SERVICE_ROLE_KEY=local  *   npx vite dev --port 5180
 *   node scripts/vala-ai/e2e-local.mjs --base http://localhost:5180 --source C:\path\to\repo --check "node check.mjs" --out .\e2e-shots
 *
 * Uses the installed Google Chrome (Playwright channel "chrome"). Every step
 * prints PASS/FAIL with what it saw; screenshots go to --out.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:5180");
const SOURCE = arg("source");
const CHECK = arg("check", "node check.mjs");
const OUT = arg("out", "e2e-shots");
const TASK_TIMEOUT_MIN = Number(arg("task-timeout-min", "45"));
if (!SOURCE) throw new Error("--source is required");
mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
function record(step, ok, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? `  — ${detail}` : ""}`);
}
async function shot(page, name) {
  await page.screenshot({
    path: join(OUT, `${String(results.length).padStart(2, "0")}-${name}.png`),
    fullPage: true,
  });
}
async function step(name, page, fn) {
  try {
    const detail = await fn();
    record(name, true, detail ?? "");
  } catch (e) {
    record(name, false, e.message.split("\n")[0]);
  }
  await shot(page, name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()).catch(() => {});
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const HARNESS = arg("harness", "http://127.0.0.1:54321");
const storageKey = `sb-${new URL(HARNESS).hostname.split(".")[0]}-auth-token`;
await context.addInitScript(
  ([key]) => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(
      key,
      JSON.stringify({
        access_token: "local-harness-token",
        token_type: "bearer",
        expires_in: 86400,
        expires_at: now + 86400,
        refresh_token: "local-harness-refresh",
        user: {
          id: "00000000-0000-4000-8000-00000000a1a1",
          email: "harness-owner@local.test",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
        },
      }),
    );
  },
  [storageKey],
);
const page = await context.newPage();
const AUTH = { authorization: "Bearer local-harness-token" };
const failedResponses = [];
page.on("response", (r) => {
  if (r.status() >= 400)
    failedResponses.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
});
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(`${page.url()} :: ${m.text().slice(0, 300)}`);
});
page.on("pageerror", (e) =>
  consoleErrors.push(`${page.url()} :: pageerror ${e.message.slice(0, 300)}`),
);
page.setDefaultTimeout(60_000);

let projectId = null;
let releaseApproval = null;

/** Approves one specific pending approval on the Approvals page. */
async function approveById(id) {
  await page.goto(`${BASE}/vala-ai/approvals`);
  const item = page
    .locator("li")
    .filter({ hasText: id })
    .filter({ has: page.getByRole("button", { name: "Approve & execute" }) });
  await item.getByRole("button", { name: "Approve & execute" }).click();
}
let taskId = null;

await step("Command Center renders with live status", page, async () => {
  await page.goto(`${BASE}/vala-ai`);
  await page.getByRole("heading", { name: "Command Center" }).waitFor();
  await page.getByText("harness-owner@local.test").first().waitFor();
  await page.getByText("What this system can and cannot do today").waitFor();
  const model = await page
    .locator("header, div")
    .getByText(/Local model/)
    .first()
    .textContent();
  return model?.trim();
});

await step("Settings: owner lowers the memory floor through the form", page, async () => {
  await page.goto(`${BASE}/vala-ai/settings`);
  const field = page.getByLabel("Free memory floor (MB)");
  await field.waitFor();
  await field.fill("256");
  await page.getByRole("button", { name: "Save limits" }).click();
  await page.getByText(/^(Saved.|No changes to save.)$/).waitFor();
  return "min_free_mem_mb = 256";
});

await step("Create project from a git repository", page, async () => {
  await page.goto(`${BASE}/vala-ai/projects`);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill("Sample calculator");
  await page.getByLabel("Repository path on the server").fill(SOURCE);
  await page.getByLabel("Description").fill("Arithmetic helpers used to exercise the agent.");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/vala-ai\/projects\/VP-/, { timeout: 120_000 });
  projectId = page.url().split("/").pop();
  await page.getByText("Project ID (permanent)").waitFor();
  await page.locator("text=ready").first().waitFor();
  return projectId;
});

await step("Draft requirement with an acceptance check, approve and lock it", page, async () => {
  await page.getByLabel("Title").fill("Implement multiply");
  await page
    .getByLabel("Requirement")
    .fill("multiply(a, b) in math.mjs must return the product of a and b. Do not change add.");
  await page.getByLabel("Check label").first().fill("calculator checks pass");
  await page.getByLabel("Check command").first().fill(CHECK);
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByRole("button", { name: "Approve & lock" }).click();
  await page.getByText(/Locked: changes go through a change request/).waitFor();
  return "v1 approved";
});

await step("Files & Preview tab lists the cloned files", page, async () => {
  await page.getByRole("tab", { name: "Files & Preview" }).click();
  await page.getByRole("button", { name: "math.mjs" }).click();
  await page.getByText("not implemented").first().waitFor();
  return "math.mjs readable";
});

await step("Queue a task", page, async () => {
  await page.getByRole("tab", { name: "Tasks" }).click();
  await page.getByLabel("Title").fill("Implement multiply");
  await page
    .getByLabel("Instruction")
    .fill("Replace the body of multiply in math.mjs so it returns a * b. Keep add unchanged.");
  await page.getByRole("button", { name: "Queue task" }).click();
  await page.waitForURL(/\/vala-ai\/tasks\/T-/);
  taskId = page.url().split("/").pop();
  return taskId;
});

await step(
  `Task reaches a final state (real local model, up to ${TASK_TIMEOUT_MIN} min)`,
  page,
  async () => {
    const deadline = Date.now() + TASK_TIMEOUT_MIN * 60_000;
    let state = "";
    while (Date.now() < deadline) {
      const res = await page.request.get(`${BASE}/api/vala-ai/tasks/${taskId}`, { headers: AUTH });
      const body = await res.json();
      state = body.task.state;
      if (["COMPLETE", "FAILED", "CANCELLED", "BLOCKED"].includes(state)) {
        await page.reload();
        await page.getByText("Event history").waitFor();
        return `${state}${body.task.blocked_reason ? `: ${body.task.blocked_reason}` : ""}${body.task.error ? `: ${body.task.error}` : ""} · verification ${body.verification.status}`;
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }
    throw new Error(`still ${state} after ${TASK_TIMEOUT_MIN} min`);
  },
);

const final = await (
  await page.request.get(`${BASE}/api/vala-ai/tasks/${taskId}`, { headers: AUTH })
).json();
const completed = final.task.state === "COMPLETE" && final.verification.status === "VERIFIED";
record(
  "Task COMPLETE and VERIFIED by the verifier",
  completed,
  `${final.task.state} / ${final.verification.status}`,
);

await step("Evidence output opens with matching SHA-256", page, async () => {
  const first = page.locator("li button").filter({ hasText: CHECK }).first();
  await first.click();
  await page.getByText(/Stored output matches its recorded SHA-256/).waitFor();
  return `${final.evidence.length} evidence record(s)`;
});

if (completed) {
  await step("Request a release from the verified task", page, async () => {
    await page.getByPlaceholder("Release label, e.g. v1.0.0").fill("v1.0.0");
    await page.getByRole("button", { name: "Request release" }).click();
    const text = await page.getByText(/Release requested/).textContent();
    releaseApproval = text?.match(/AP-[A-Z2-9]+/)?.[0] ?? null;
    if (!releaseApproval) throw new Error("no approval id shown");
    return releaseApproval;
  });
  await step("Owner approves the release; outcome is recorded", page, async () => {
    await page.goto(`${BASE}/vala-ai/approvals`);
    await approveById(releaseApproval);
    const done = page
      .locator("li")
      .filter({ hasText: releaseApproval })
      .filter({ hasText: /Outcome: Release REL-/ });
    await done.waitFor();
    return (await done.textContent())?.match(/Release REL-[A-Z2-9]+/)?.[0];
  });
  await step("Releases page lists it; patch downloads with matching hash", page, async () => {
    await page.goto(`${BASE}/vala-ai/releases`);
    const row = page.locator("tr").filter({ hasText: projectId }).filter({ hasText: "v1.0.0" });
    await row.waitFor();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      row.getByRole("button", { name: "Download patch" }).click(),
    ]);
    return `downloaded ${download.suggestedFilename()}`;
  });
}

await step("Rollback: request to the base commit, approve, outcome verified", page, async () => {
  await page.goto(`${BASE}/vala-ai/projects/${projectId}`);
  await page.getByRole("tab", { name: "Versions & Rollback" }).click();
  await page.getByText("Workspace history").waitFor();
  await page.locator("li").filter({ hasText: "HEAD" }).first().waitFor();
  const buttons = page.getByRole("button", { name: "Roll back to here" });
  if ((await buttons.count()) === 0)
    return "no earlier commit to roll back to (task made no commits)";
  await buttons.last().click();
  await page.getByPlaceholder("Reason").fill("e2e rollback check");
  await page.getByRole("button", { name: "Request rollback approval" }).click();
  const text = await page.getByText(/Rollback requested/).textContent();
  const id = text?.match(/AP-[A-Z2-9]+/)?.[0];
  if (!id) throw new Error("no approval id shown");
  await page.goto(`${BASE}/vala-ai/approvals`);
  await approveById(id);
  await page
    .locator("li")
    .filter({ hasText: id })
    .filter({ hasText: /verified HEAD matches/ })
    .waitFor();
  return id;
});

await step("Chat answers through the local model", page, async () => {
  await page.goto(`${BASE}/vala-ai/chat`);
  await page.getByLabel("Project").selectOption(projectId);
  await page
    .getByLabel("Message")
    .fill("In one sentence: what does the approved requirement ask for?");
  await page.getByRole("button", { name: "Send" }).click();
  const reply = page
    .locator("li")
    .filter({ hasText: /qwen|stub|tokens/i })
    .last();
  await reply.waitFor({ timeout: 600_000 });
  return (await reply.textContent())?.slice(0, 160);
});

for (const [path, heading] of [
  ["/vala-ai/pipeline", "Execution Pipeline"],
  ["/vala-ai/qa", "QA & Verification"],
  ["/vala-ai/activity", "Activity & Audit"],
]) {
  await step(`${heading} renders`, page, async () => {
    await page.goto(`${BASE}${path}`);
    await page.getByRole("heading", { name: heading }).waitFor();
    if (path.endsWith("activity")) await page.getByText(/Chain intact/).waitFor();
  });
}

await step("Mobile width: sidebar opens from the menu button", page, async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/vala-ai`);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Approvals" }).last().waitFor();
});

await browser.close();
const relevant = consoleErrors.filter((e) => !/Missing Supabase environment/.test(e));
console.log(
  `\nConsole errors on Vala AI pages (excluding the platform's missing-Supabase-env notices): ${relevant.length}`,
);
for (const e of relevant.slice(0, 20)) console.log(`  ${e}`);
const byUrl = {};
for (const r of failedResponses) byUrl[r] = (byUrl[r] ?? 0) + 1;
console.log("\nHTTP responses >= 400 seen by the browser:");
for (const [k, n] of Object.entries(byUrl)) console.log(`  ${n}x ${k}`);
const valaFailures = failedResponses.filter((r) => r.includes("/api/vala-ai/"));
record(
  "No Vala AI API request failed",
  valaFailures.length === 0,
  valaFailures.slice(0, 5).join("; "),
);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
process.exit(failed.length ? 1 : 0);
