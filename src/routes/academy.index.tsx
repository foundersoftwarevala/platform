import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, GraduationCap } from "lucide-react";
import { listCourses } from "@/lib/site-content/academy";
import "@/styles/marketplace-home.css";

const LEVEL_TONE: Record<string, string> = {
  Beginner: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  Intermediate: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  Advanced: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300",
};

function AcademyPage() {
  const courses = listCourses();
  return (
    <main className="min-h-screen bg-[#050b18] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
          &larr; Back to marketplace
        </a>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
          <GraduationCap className="h-3 w-3" aria-hidden="true" /> Vala Academy
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Learning paths</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-white/60">
          Structured paths for buyers, vendors and implementation teams.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <article key={course.slug} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <BookOpen className="h-6 w-6 text-cyan-300" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-bold">{course.title}</h2>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-white/60">{course.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-white/60">{course.lessons} lessons</span>
                <span className={`rounded-full border px-2 py-0.5 font-semibold ${LEVEL_TONE[course.level]}`}>
                  {course.level}
                </span>
              </div>
              <a
                href={`/academy/${course.slug}`}
                className="mt-4 rounded-xl bg-white px-4 py-2 text-center text-xs font-bold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                View path
              </a>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/academy/")({
  head: () => ({
    meta: [
      { title: "Vala Academy | Software Vala" },
      { name: "description", content: "Learning paths for Software Vala buyers, vendors and implementation teams." },
      { property: "og:title", content: "Vala Academy | Software Vala" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AcademyPage,
});
