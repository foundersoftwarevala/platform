import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Handshake, Lightbulb, Rocket, Search } from "lucide-react";
import logo from "@/assets/rd-module/software-vala-logo.png";
import { Button } from "@/components/rd-module/ui/button";
import { RequestForm, type SubmitResult } from "@/components/rd-module/rd-public/RequestForm";
import {
  OPPORTUNITY_TYPES,
  TYPE_LABEL,
  type OpportunityType,
} from "@/lib/rd-module/rd-opportunity-types";
import { cn } from "@/lib/rd-module/utils";

export const Route = createFileRoute("/rd-manager/start")({
  validateSearch: z.object({ type: z.enum(OPPORTUNITY_TYPES).optional() }),
  head: () => ({
    meta: [
      { title: "Start Your Idea — Software Vala" },
      {
        name: "description",
        content:
          "Request custom software, propose a SaaS partnership or bring your idea to Software Vala's R&D team.",
      },
      { property: "og:title", content: "Start Your Idea — Software Vala" },
      {
        property: "og:description",
        content: "Software On Demand, SaaS Partnership and Build With Us.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StartPage,
});

const CARDS: {
  type: OpportunityType;
  icon: typeof Rocket;
  headline: string;
  copy: string;
  primary?: boolean;
}[] = [
  {
    type: "SOFTWARE_ON_DEMAND",
    icon: Rocket,
    headline: "Need a software solution?",
    copy: "Tell us what you need and our team will explore it.",
    primary: true,
  },
  {
    type: "SAAS_PARTNERSHIP",
    icon: Handshake,
    headline: "Have a SaaS idea?",
    copy: "Let's explore building it together.",
  },
  {
    type: "BUILD_WITH_US",
    icon: Lightbulb,
    headline: "Have a technology or business idea?",
    copy: "Bring it to Software Vala.",
  },
];

function StartPage() {
  const { type } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [result, setResult] = useState<SubmitResult | null>(null);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/rd-manager/start"
            search={{}}
            className="flex items-center gap-3"
            onClick={() => setResult(null)}
          >
            <img src={logo} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="font-display text-sm font-semibold text-foreground">
              Software Vala
            </span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/rd-manager/track">
              <Search className="h-4 w-4" /> Track a request
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {result ? (
          <div className="panel mx-auto max-w-lg p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
              Submission successful
            </h1>
            <p className="mt-6 text-xs uppercase tracking-wide text-muted-foreground">Request ID</p>
            <p className="font-mono text-2xl font-semibold text-brand">{result.requestId}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Status: <span className="text-foreground">{result.status}</span>
            </p>
            <p className="mt-4 text-sm text-foreground">
              Our R&amp;D team will review your submission.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Save your Request ID to track the status later.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/rd-manager/track">Track status</Link>
              </Button>
              <Button
                onClick={() => {
                  setResult(null);
                  navigate({ search: {} });
                }}
              >
                Submit another
              </Button>
            </div>
          </div>
        ) : type ? (
          <div className="mx-auto max-w-3xl">
            <button
              type="button"
              onClick={() => navigate({ search: {} })}
              className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> All options
            </button>
            <h1 className="font-display text-3xl font-semibold text-foreground">
              {TYPE_LABEL[type]}
            </h1>
            <p className="mb-6 mt-2 text-sm text-muted-foreground">
              {CARDS.find((c) => c.type === type)?.copy}
            </p>
            <RequestForm
              type={type}
              onDone={(r) => {
                setResult(r);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        ) : (
          <>
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
                Start your idea
              </h1>
              <p className="mt-3 text-muted-foreground">
                Tell us what software, solution or technology you need.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {CARDS.map(({ type: t, icon: Icon, headline, copy, primary }) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => navigate({ search: { type: t } })}
                  className={cn(
                    "panel group flex flex-col items-start gap-3 p-6 text-left transition-shadow hover:shadow-glow",
                    primary && "brand-soft md:row-span-1",
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/20 text-brand">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-display text-lg font-semibold text-foreground">
                    {TYPE_LABEL[t]}
                  </span>
                  <span className="text-sm text-foreground">{headline}</span>
                  <span className="text-sm text-muted-foreground">{copy}</span>
                  <span className="mt-auto pt-2 text-sm text-brand group-hover:underline">
                    Start →
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
