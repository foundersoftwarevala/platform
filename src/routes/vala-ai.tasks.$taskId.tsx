import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { TaskDetail } from "@/components/vala-ai/screens/TaskDetail";

function TaskRoute() {
  const { taskId } = Route.useParams();
  return <TaskDetail key={taskId} taskId={taskId} />;
}

export const Route = createFileRoute("/vala-ai/tasks/$taskId")({
  head: pageHead("Task · Vala AI", "A task's progress, evidence and verification."),
  component: TaskRoute,
});
