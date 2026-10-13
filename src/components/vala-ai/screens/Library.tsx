import { useState } from "react";
import { Library as LibraryIcon, FolderSearch, Upload } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { api, useApi } from "../api";
import { useCan } from "../session";
import { Card, Empty, ErrorBox, Field, inputClass, Loading, Page, PageHeader } from "../ui";
import { relativeTime } from "../format";
import { canPickFolders, pickFolder, scanLibrary, type ScannedItem } from "../library-scan";

type LibraryItem = {
  id: string;
  name: string;
  version: string;
  root_label: string;
  rel_path: string;
  stack: string[];
  features: string[];
  file_count: number;
  size_bytes: number;
  manifest_sha256: string;
  scanned_at: string;
};

const mb = (n: number) => `${(n / 1_048_576).toFixed(1)} MB`;

export function Library() {
  const { translate: t } = useLanguage();
  const canEdit = useCan("operator");
  const [q, setQ] = useState("");
  const list = useApi<{ items: LibraryItem[]; total: number }>(
    ["library", q],
    `/library?q=${encodeURIComponent(q)}`,
  );

  return (
    <div>
      <PageHeader
        title={t("Software Library")}
        description={t(
          "Index of the master software library. The SSD is read in your browser and only metadata is stored; the source is never uploaded or changed.",
        )}
        icon={LibraryIcon}
      />
      <Page>
        {canEdit ? <ScanCard onDone={() => list.refetch()} /> : null}
        <Card title={t("Indexed software")}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search by name, stack or feature (e.g. school fees mysql)")}
            className={`${inputClass} mb-3`}
          />
          {list.isLoading ? (
            <Loading />
          ) : list.error ? (
            <ErrorBox error={list.error} />
          ) : !list.data || list.data.items.length === 0 ? (
            <Empty>{q ? t("Nothing matches this search.") : t("The library is empty. Scan the SSD folder to index it.")}</Empty>
          ) : (
            <div className="overflow-x-auto">
              <p className="mb-2 text-xs text-muted-foreground">
                {list.data.total} {t("items")}
              </p>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">{t("Name")}</th>
                    <th className="py-2 pr-3">{t("Stack")}</th>
                    <th className="py-2 pr-3">{t("Features")}</th>
                    <th className="py-2 pr-3">{t("Files")}</th>
                    <th className="py-2 pr-3">{t("Location")}</th>
                    <th className="py-2">{t("Scanned")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((it) => (
                    <tr key={it.id} className="border-t border-border align-top">
                      <td className="py-2 pr-3 font-medium">
                        {it.name}
                        {it.version ? <span className="ml-1 text-xs text-muted-foreground">v{it.version}</span> : null}
                      </td>
                      <td className="py-2 pr-3 text-xs">{it.stack.join(", ") || "—"}</td>
                      <td className="py-2 pr-3 text-xs">{it.features.join(", ") || "—"}</td>
                      <td className="py-2 pr-3 text-xs">
                        {it.file_count} · {mb(it.size_bytes)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs" title={`sha256 ${it.manifest_sha256}`}>
                        {it.root_label}/{it.rel_path}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{relativeTime(it.scanned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Page>
    </div>
  );
}

function ScanCard({ onDone }: { onDone: () => void }) {
  const { translate: t } = useLanguage();
  const [label, setLabel] = useState("SSD-MASTER");
  const [items, setItems] = useState<ScannedItem[] | null>(null);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [result, setResult] = useState<string>("");

  const scan = async () => {
    setError(null);
    setResult("");
    try {
      const root = await pickFolder();
      setBusy(true);
      const found = await scanLibrary(root, (d, f) => setProgress(`${d} ${t("folders read")} · ${f} ${t("software found")}`));
      setItems(found);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e as Error);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!items) return;
    setBusy(true);
    setError(null);
    try {
      const out = await api<{ created: number; updated: number }>("/library/import", {
        method: "POST",
        body: { rootLabel: label, items },
      });
      setResult(`${out.created} ${t("added")}, ${out.updated} ${t("updated")}`);
      setItems(null);
      onDone();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("Scan the library folder")}>
      {!canPickFolders() ? (
        <Empty>{t("Folder scanning needs Chrome or Edge on the computer the SSD is plugged into.")}</Empty>
      ) : (
        <div className="space-y-3">
          <Field label={t("Folder label")}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={scan}
              disabled={busy || !label.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg va-btn-primary px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              <FolderSearch className="h-4 w-4" />
              {t("Choose folder and scan (read-only)")}
            </button>
            {items ? (
              <button
                onClick={save}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {t("Save")} {items.length} {t("items to the index")}
              </button>
            ) : null}
          </div>
          {progress ? <p className="text-xs text-muted-foreground">{progress}</p> : null}
          {result ? <p className="text-sm">{result}</p> : null}
          <ErrorBox error={error} />
        </div>
      )}
    </Card>
  );
}
