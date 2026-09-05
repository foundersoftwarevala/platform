import { createFileRoute, notFound } from "@tanstack/react-router";
import { Check, GraduationCap } from "lucide-react";
import { getCourse } from "@/lib/site-content/academy";
import "@/styles/marketplace-home.css";

/**
 * A learning path. There is no learning-management backend yet, so this page
 * shows what the path covers and where to go next; it deliberately does not
 * show lesson players or progress, because neither exists to report on.
 */
function CoursePage() {
  const { course: slug } = Route.useParams();
  const course = getCourse(slug);

  if (!course) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050b18] px-6 text-center text-white">
        <div>
          <h1 className="text-xl font-bold">That learning path does not exist</h1>
          <a href="/academy" className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900">
            See all paths
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050b18] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <a href="/academy" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
          &larr; All learning paths
        </a>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
          <GraduationCap className="h-3 w-3" aria-hidden="true" /> {course.level}
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</h1>
        <p className="mt-2 text-sm text-white/70">{course.summary}</p>
        <p className="mt-1 text-xs text-white/50">{course.lessons} lessons in this path</p>

        <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-white/60">What you will be able to do</h2>
        <ul className="mt-3 space-y-2">
          {course.outcomes.map((outcome) => (
            <li key={outcome} className="flex gap-2.5 text-sm text-white/85">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
              {outcome}
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-bold">Lessons are not open yet</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-white/60">
            This path is published but the lessons are not available to enrol in yet. In the
            meantime the fastest way to learn the material is to work through the real thing.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/marketplace" className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900">
              Explore the catalogue
            </a>
            {course.appliesTo && (
              <a
                href={`/apply/${course.appliesTo}`}
                className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Apply as a {course.appliesTo}
              </a>
            )}
            <a href="/support" className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
              Ask a question
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/academy/$course")({
  component: CoursePage,
});
