import type { Operator } from "./auth.server.ts";
import { all, run } from "./db.server.ts";
import { chat, type ChatMessage } from "./model.server.ts";
import { approvedRequirement, checksOf, getProject } from "./projects.server.ts";
import { listTasks } from "./tasks.server.ts";
import { newId, now, ValaError } from "./util.server.ts";

/**
 * Conversation with the local model, kept per project (or general when no
 * project is chosen). The model is told the project's approved requirement
 * and its recent tasks with their real states, and is told plainly that it
 * cannot change files from chat — work happens only through tasks.
 */

export type ChatRow = {
  id: string;
  project_id: string | null;
  operator_id: string;
  role: "user" | "assistant" | "error";
  content: string;
  model: string | null;
  duration_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
};

export function history(projectId: string | null, limit = 100): ChatRow[] {
  const rows = projectId
    ? all<ChatRow>(
        "select * from chat_messages where project_id = ? order by created_at desc, rowid desc limit ?",
        projectId,
        limit,
      )
    : all<ChatRow>(
        "select * from chat_messages where project_id is null order by created_at desc, rowid desc limit ?",
        limit,
      );
  return rows.reverse();
}

function contextFor(projectId: string | null): string {
  if (!projectId)
    return "No project is selected. You can explain how Vala AI works: projects, approved requirements with acceptance checks, tasks, verification, approvals and releases.";
  const p = getProject(projectId);
  const req = approvedRequirement(projectId);
  const tasks = listTasks({ projectId }).slice(0, 5);
  return [
    `Project ${p.id} "${p.name}": ${p.description || "no description"}.`,
    req
      ? `Approved requirement v${req.version} "${req.title}":\n${req.body.slice(0, 1500)}\nChecks: ${checksOf(
          req,
        )
          .map((c) => c.command)
          .join("; ")}`
      : "No approved requirement yet.",
    tasks.length
      ? `Recent tasks:\n${tasks.map((t) => `- ${t.id} ${t.title}: ${t.state}${t.blocked_reason ? ` (${t.blocked_reason})` : ""}`).join("\n")}`
      : "No tasks yet.",
  ].join("\n\n");
}

export async function send(
  projectId: string | null,
  text: string,
  operator: Operator,
): Promise<{ user: ChatRow; reply: ChatRow }> {
  const content = text.trim();
  if (!content) throw new ValaError(400, "Message is empty.");
  if (content.length > 6000)
    throw new ValaError(400, "Message is too long (max 6,000 characters).");
  if (projectId) getProject(projectId);

  const prior = history(projectId, 8).filter((m) => m.role !== "error");
  const userId = newId("M", 10);
  run(
    "insert into chat_messages (id, project_id, operator_id, role, content, created_at) values (?,?,?,?,?,?)",
    userId,
    projectId,
    operator.id,
    "user",
    content,
    now(),
  );

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are Vala AI, Software Vala's own engineering agent, running on a local model. Be concise and factual.
You cannot edit files or run commands from chat; changes happen only when an operator creates a task, which is built and verified against the approved requirement. Never claim something was done unless the context below says so. Reply in the user's language (English, Hindi or Hinglish).

${contextFor(projectId)}`,
    },
    ...prior.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, 2000),
    })),
    { role: "user", content },
  ];

  const replyId = newId("M", 10);
  try {
    const r = await chat(messages, { maxTokens: 700, temperature: 0.3 });
    run(
      "insert into chat_messages (id, project_id, operator_id, role, content, model, duration_ms, tokens_in, tokens_out, created_at) values (?,?,?,?,?,?,?,?,?,?)",
      replyId,
      projectId,
      operator.id,
      "assistant",
      r.text.trim() || "(empty reply)",
      r.model,
      r.durationMs,
      r.tokensIn,
      r.tokensOut,
      now(),
    );
  } catch (e) {
    run(
      "insert into chat_messages (id, project_id, operator_id, role, content, created_at) values (?,?,?,?,?,?)",
      replyId,
      projectId,
      operator.id,
      "error",
      (e as Error).message,
      now(),
    );
  }
  const rows = all<ChatRow>("select * from chat_messages where id in (?, ?)", userId, replyId);
  return { user: rows.find((r) => r.id === userId)!, reply: rows.find((r) => r.id === replyId)! };
}
