import { createFileRoute } from "@tanstack/react-router";
import { RequestSoftwareForm } from "@/components/rd-module/RequestSoftwareForm";

export const Route = createFileRoute("/request-software")({
  head: () => ({
    meta: [
      { title: "Request Your Software | Software Vala" },
      {
        name: "description",
        content:
          "Tell the Software Vala R&D team what you need. Verify your email, paste your requirements or attach a PDF.",
      },
    ],
  }),
  component: RequestSoftwarePage,
});

function RequestSoftwarePage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:py-16">
      <a href="/" className="text-sm underline">
        Software Vala
      </a>
      <h1 className="mb-3 mt-6 text-3xl font-semibold">Request Your Software</h1>
      <p className="mb-8 text-muted-foreground">
        Tell us what you need. Keep it simple, in your own words.
      </p>
      <RequestSoftwareForm />
    </main>
  );
}
