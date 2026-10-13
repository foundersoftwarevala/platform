import { useState } from "react";
import { LayoutDashboard, Wand2, Download, RefreshCcw } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { api, useAction } from "../api";
import { Card, ErrorBox, Field, inputClass, Loading, Page, PageHeader } from "../ui";

export function Builder() {
  const { translate: t } = useLanguage();
  const [pageType, setPageType] = useState("clinic");
  const [businessName, setBusinessName] = useState("");
  const [theme, setTheme] = useState("modern");
  const [instruction, setInstruction] = useState("");
  const [html, setHtml] = useState("");

  const generate = useAction((body: any) => 
    api<string>("/builder/generate", { method: "POST", body })
  );

  const handleGenerate = () => {
    generate.mutate({ pageType, businessName, theme, instruction: html ? instruction : "" }, {
      onSuccess: (res) => {
        setHtml(res);
        setInstruction("");
      }
    });
  };

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${businessName || "website"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title={t("Website Builder")}
        description={t("Generate self-contained HTML websites using AI.")}
        icon={LayoutDashboard}
      />
      <Page>
        <div className="grid gap-6 lg:grid-cols-[350px,1fr]">
          <Card title={t("Configuration")} className="h-fit">
            <div className="space-y-4">
              <Field label={t("Page Type")}>
                <select value={pageType} onChange={e => setPageType(e.target.value)} className={inputClass}>
                  <option value="clinic">{t("Clinic")}</option>
                  <option value="store">{t("Store")}</option>
                  <option value="school">{t("School")}</option>
                  <option value="restaurant">{t("Restaurant")}</option>
                  <option value="portfolio">{t("Portfolio")}</option>
                </select>
              </Field>
              <Field label={t("Business Name")}>
                <input 
                  value={businessName} 
                  onChange={e => setBusinessName(e.target.value)} 
                  className={inputClass} 
                  placeholder="e.g. Acme Corp"
                />
              </Field>
              <Field label={t("Theme")}>
                <div className="grid grid-cols-2 gap-2">
                  {["modern", "classic", "playful", "elegant"].map(k => (
                    <button
                      key={k}
                      onClick={() => setTheme(k)}
                      className={`rounded-lg border p-2 text-xs capitalize ${theme === k ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
                    >
                      {t(k)}
                    </button>
                  ))}
                </div>
              </Field>
              
              {html && (
                <Field label={t("Follow-up Instruction")} hint={t("Ask for specific edits to the generated site.")}>
                  <textarea 
                    value={instruction} 
                    onChange={e => setInstruction(e.target.value)} 
                    className={inputClass} 
                    rows={3}
                  />
                </Field>
              )}

              <ErrorBox error={generate.error} />
              
              <button
                onClick={handleGenerate}
                disabled={generate.isPending || !businessName}
                className="w-full rounded-lg va-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {generate.isPending ? (
                  <span className="flex items-center justify-center gap-2"><RefreshCcw className="h-4 w-4 animate-spin" /> {t("Generating...")}</span>
                ) : (
                  <span className="flex items-center justify-center gap-2"><Wand2 className="h-4 w-4" /> {html ? t("Update Site") : t("Generate Site")}</span>
                )}
              </button>

              {html && (
                <button
                  onClick={handleDownload}
                  className="w-full mt-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" /> {t("Download HTML")}
                </button>
              )}
            </div>
          </Card>

          <Card title={t("Preview")} className="min-h-[600px] flex flex-col p-0 overflow-hidden">
            {html ? (
              <iframe 
                srcDoc={html} 
                className="flex-1 w-full border-0" 
                title="Preview"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/20">
                {t("Generate a site to see the preview here.")}
              </div>
            )}
          </Card>
        </div>
      </Page>
    </div>
  );
}
