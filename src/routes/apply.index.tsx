import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Rocket } from "lucide-react";
import "@/styles/marketplace-home.css";
import { ROLES } from "@/lib/applications/config";

export const Route = createFileRoute("/apply/")({
  head: () => ({
    meta: [
      { title: "Apply to Software Vala — Vendor, Author, Reseller & More" },
      {
        name: "description",
        content:
          "Apply as a Vendor, Author, Reseller, Affiliate, Franchise, Influencer or Employee. Each role has its own form, fee, agreement and approval workflow.",
      },
      { property: "og:title", content: "Apply to Software Vala — Role Applications" },
      {
        property: "og:description",
        content: "Seven dedicated application forms with separate approval workflows and dashboard access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApplyIndex,
});

function ApplyIndex() {
  return (
    <div className="mpc-home min-h-screen px-4 pb-20 pt-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/80">
          <Rocket className="h-3 w-3 text-amber-200" /> Apply now
        </span>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Role Based Application System</h1>
        <p className="mt-2 max-w-3xl text-[14px] text-white/65">
          Every apply option opens a dedicated application page. Each role has a separate form, different fields, a
          different approval workflow, fee structure, agreement and dashboard access.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <Link
              key={r.key}
              to="/apply/$role"
              params={{ role: r.key }}
              className={`group overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br ${r.accent} p-[1px] transition-transform duration-200 hover:-translate-y-1`}
            >
              <div className="flex h-full flex-col rounded-[calc(1rem-1px)] bg-[#0a1526]/88 p-5">
                <h2 className="text-[16px] font-black">{r.label}</h2>
                <p className="mt-1 text-[12.5px] text-white/60">{r.tagline}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[10.5px] font-semibold">
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-white/70">
                    Fee: {r.fee}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-white/70">
                    {r.sections.length} sections
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-white/70">
                    {r.workflow.length} step approval
                  </span>
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-cyan-200">
                  Start application
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/" className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-[13px] font-bold">
            Back to home
          </Link>
          <Link
            to="/control-panel"
            className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-2.5 text-[13px] font-bold"
          >
            Boss panel
          </Link>
        </div>
      </div>
    </div>
  );
}
