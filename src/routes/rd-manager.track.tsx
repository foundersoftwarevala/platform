import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import { Label } from "@/components/rd-module/ui/label";
import { trackOpportunity } from "@/lib/rd-module/rd-opportunities.functions";

export const Route = createFileRoute("/rd-manager/track")({
  head: () => ({
    meta: [
      { title: "Track Your Request — Software Vala" },
      {
        name: "description",
        content:
          "Check the status of your Software Vala R&D request with your Request ID and email.",
      },
      { property: "og:title", content: "Track Your Request — Software Vala" },
      { property: "og:description", content: "Check the status of your R&D submission." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

type Result = Awaited<ReturnType<typeof trackOpportunity>>;

function TrackPage() {
  const track = useServerFn(trackOpportunity);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      setRes(
        await track({
          data: { requestId: String(fd.get("requestId")), email: String(fd.get("email")) },
        }),
      );
    } catch {
      setError("Please check the Request ID (SV-RD-XXXXXX) and email.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Link
        to="/rd-manager/start"
        search={{}}
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="font-display text-3xl font-semibold text-foreground">Track your request</h1>
      <form onSubmit={onSubmit} className="panel mt-6 space-y-4 p-6">
        <div className="space-y-1.5">
          <Label htmlFor="requestId">Request ID</Label>
          <Input
            id="requestId"
            name="requestId"
            required
            placeholder="SV-RD-XXXXXX"
            className="uppercase"
            maxLength={12}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email used on the request</Label>
          <Input id="email" name="email" type="email" required maxLength={255} />
        </div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Check status
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
      {res && !res.found && (
        <p className="mt-6 text-sm text-muted-foreground">
          No request found for that ID and email.
        </p>
      )}
      {res && res.found && (
        <div className="panel mt-6 space-y-2 p-6 text-sm">
          <p className="font-mono text-lg text-brand">{res.requestId}</p>
          <p className="text-foreground">{res.title}</p>
          <p className="text-muted-foreground">{res.type}</p>
          <p className="pt-2">
            Status: <span className="font-semibold text-foreground">{res.status}</span>
          </p>
          <p className="text-foreground">{res.message}</p>
          <p className="pt-2 text-xs text-muted-foreground">
            Submitted {new Date(res.submittedAt).toLocaleDateString()} · Last updated{" "}
            {new Date(res.updatedAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </main>
  );
}
