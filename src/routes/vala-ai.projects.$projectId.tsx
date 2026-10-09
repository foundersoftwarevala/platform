import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { ProjectWorkspace } from "@/components/vala-ai/screens/ProjectWorkspace";

function ProjectRoute() {
  const { projectId } = Route.useParams();
  return <ProjectWorkspace key={projectId} projectId={projectId} />;
}

export const Route = createFileRoute("/vala-ai/projects/$projectId")({
  head: pageHead("Project · Vala AI", "A project's requirements, tasks, files and versions."),
  component: ProjectRoute,
});
