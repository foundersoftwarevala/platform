import { createFileRoute } from "@tanstack/react-router";
import { RequestSoftwareForm } from "@/components/rd-module/RequestSoftwareForm";
import { useTranslation } from "@/lib/i18n/use-translation";

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
  const { t } = useTranslation();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:py-16">
      <a href="/" className="text-sm underline" data-no-translate>
        Software Vala
      </a>
      <h1 className="mb-3 mt-6 text-3xl font-semibold">{t("rd.request_page_title")}</h1>
      <p className="mb-8 text-muted-foreground">
        {t("rd.request_page_intro")}
      </p>
      <RequestSoftwareForm />
    </main>
  );
}
