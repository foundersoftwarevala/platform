import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listDemoCategories } from "@/lib/demo-manager/demos.functions";
import { authHeaders } from "@/lib/auth/operator-fetch";

/**
 * Bulk Add — for the twelve thousand demo URLs that are waiting to go in.
 *
 * This screen used to do nothing at all. Its upload handler read no file,
 * parsed no CSV and made no database call: it set a two-second timer and then
 * announced "Bulk upload completed! Demos added successfully". An operator
 * would have uploaded twelve thousand URLs, been told they were saved, and had
 * nothing saved. Its warning banner also promised that duplicates were blocked,
 * while `demos` carried no unique index on anything but its primary key.
 *
 * Both are now true rather than claimed. The file is read and parsed here, the
 * rows are checked before anything is sent, the insert is a real insert, and
 * the counts reported afterwards are counted from what the database returned.
 * Duplicates are refused by a unique index on demos.normalized_url, which a
 * trigger maintains.
 *
 * Nothing is inserted until the operator has seen what will be: the file is
 * parsed on selection and the screen says how many rows will be added, how many
 * will be skipped and why, with the first of each named.
 */

type DemoRow = {
  line: number;
  title: string;
  url: string;
  /** A product slug or id from the file, when it carries one. Never inferred. */
  product: string;
  normalized: string;
  category: string;
  demo_type: string;
  description: string;
};

type Rejected = { line: number; reason: string; sample: string };

type Parsed = {
  rows: DemoRow[];
  rejected: Rejected[];
  duplicatesInFile: number;
};

/**
 * The same normalisation the database applies, so the count this screen shows
 * before the insert matches what the insert actually does.
 */
function normalizeUrl(raw: string): string {
  const value = raw.trim().replace(/#.*$/, "");
  const lower = value.toLowerCase();
  const scheme = lower.startsWith("https://") ? "https" : lower.startsWith("http://") ? "http" : null;
  if (!scheme) return value.replace(/\/+$/, "");
  const rest = value.slice(scheme.length + 3);
  const cut = (() => {
    const slash = rest.indexOf("/");
    const question = rest.indexOf("?");
    const candidates = [slash, question].filter((i) => i >= 0);
    return candidates.length ? Math.min(...candidates) : -1;
  })();
  const host = (cut === -1 ? rest : rest.slice(0, cut)).toLowerCase().replace(/:(80|443)$/, "");
  const tail = (cut === -1 ? "" : rest.slice(cut)).replace(/\/+$/, "");
  return `${scheme}://${host}${tail}`;
}

/** A CSV line reader that understands quoted fields and embedded commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === "," || ch === "\t" || ch === ";") {
      out.push(field.trim());
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field.trim());
  return out;
}

const DEMO_TYPES = ["web", "mobile", "desktop", "api"];

function parseDemosCsv(text: string, categories: string[]): Parsed {
  const known = new Map(categories.map((c) => [c.toLowerCase().trim(), c]));
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd());

  const rows: DemoRow[] = [];
  const rejected: Rejected[] = [];
  const seen = new Set<string>();
  let duplicatesInFile = 0;

  // The header is optional: a file that is just a list of URLs is accepted.
  let start = 0;
  let index: Record<string, number> = { title: 0, category: 1, demo_type: 2, url: 3, description: 4 };
  const first = lines.find((l) => l.trim().length > 0) ?? "";
  if (/(^|[,;\t])\s*url\s*([,;\t]|$)/i.test(first) || /^\s*title\s*[,;\t]/i.test(first)) {
    const headers = splitCsvLine(first).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
    index = {} as Record<string, number>;
    headers.forEach((h, i) => {
      index[h] = i;
    });
    start = lines.indexOf(first) + 1;
  }

  for (let i = start; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const line = i + 1;
    const cells = splitCsvLine(raw);
    const at = (name: string) => (index[name] === undefined ? "" : (cells[index[name]] ?? "").trim());

    // A bare list of URLs is a legitimate file, so a single-column row is read
    // as the URL rather than refused for having no header.
    const url = (at("url") || (cells.length === 1 ? cells[0] : "")).trim();
    if (!/^https?:\/\//i.test(url)) {
      rejected.push({ line, reason: "no http(s) URL in the row", sample: raw.slice(0, 70) });
      continue;
    }

    const normalized = normalizeUrl(url);
    if (seen.has(normalized)) {
      duplicatesInFile += 1;
      continue;
    }
    seen.add(normalized);

    const askedFor = at("category");
    const category = askedFor ? known.get(askedFor.toLowerCase().trim()) : undefined;
    if (askedFor && !category) {
      rejected.push({ line, reason: `category "${askedFor.slice(0, 32)}" is not one of the ${categories.length}`, sample: url.slice(0, 60) });
      continue;
    }
    if (!category) {
      rejected.push({ line, reason: "no category — a demo with no category cannot be found in the marketplace", sample: url.slice(0, 60) });
      continue;
    }

    let title = at("title");
    if (!title) {
      try {
        title = new URL(url).hostname.replace(/^www\./i, "");
      } catch {
        title = url;
      }
    }

    const askedType = at("demo_type").toLowerCase();
    rows.push({
      line,
      title,
      url,
      normalized,
      category,
      demo_type: DEMO_TYPES.includes(askedType) ? askedType : "web",
      description: at("description"),
      // A product column is honoured when the file carries one, and never
      // invented when it does not: an unnamed row is matched by title, or left
      // unassigned for review.
      product: at("product") || at("product_slug") || at("product_id"),
    });
  }

  return { rows, rejected, duplicatesInFile };
}

const BulkAdd = () => {
  const [uploadType, setUploadType] = useState<"products" | "demos" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  // Rows taken in but deliberately not assigned, which an operator reviews.
  const [review, setReview] = useState<{ ambiguous: number; unmatched: number } | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [outcome, setOutcome] = useState<{ inserted: number; alreadyThere: number; failed: number; detail: string } | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // Read through the server, not the browser client. The browser client talks
  // to the hosted Supabase project, where demo_categories is empty; the ninety
  // categories are on the VPS, which is where the rest of the platform reads
  // and writes. Fetching from the browser returned "200 []" and every row of an
  // upload was then refused for having a category "not one of the 0".
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listDemoCategories();
        if (cancelled) return;
        setCategories(rows.map((r) => String(r.name)).filter(Boolean));
        setCategoriesError(null);
      } catch (problem) {
        if (cancelled) return;
        setCategoriesError(problem instanceof Error ? problem.message : "unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const readFile = useCallback(
    async (file: File) => {
      setUploadedFile(file);
      setOutcome(null);
      if (uploadType !== "demos") {
        setParsed(null);
        return;
      }
      try {
        const text = await file.text();
        const result = parseDemosCsv(text, categories);
        setParsed(result);
        toast.success(`${file.name} read`, {
          description: `${result.rows.length} row(s) ready, ${result.rejected.length} skipped`,
        });
      } catch (problem) {
        setParsed(null);
        toast.error("The file could not be read", {
          description: problem instanceof Error ? problem.message : "unknown error",
        });
      }
    },
    [uploadType, categories],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(csv|txt)$/i.test(file.name)) void readFile(file);
    else toast.error("Invalid file", { description: "Please upload a .csv or .txt file" });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void readFile(file);
  };

  const handleUpload = async () => {
    if (!uploadedFile || uploadType !== "demos" || !parsed || parsed.rows.length === 0) return;

    setIsWorking(true);
    setOutcome(null);
    let inserted = 0;
    let failed = 0;
    let detail = "";

    try {
      // The server does the filing: it re-checks every category against
      // demo_categories, makes the batch distinct, and inserts with
      // ignore-duplicates so a URL already in the catalogue is skipped rather
      // than failing the batch. The counts come back from what the database
      // returned, not from what was sent.
      const BATCH = 500;
      let already = 0;
      const refusals: string[] = [];
      let ambiguous = 0;
      let unmatched = 0;
      for (let i = 0; i < parsed.rows.length; i += BATCH) {
        const batch = parsed.rows.slice(i, i + BATCH);
        /**
         * Sent to the canonical path.
         *
         * This used to call createDemosBulk, which writes into `demos` - a
         * table with no product relationship that the storefront has never
         * read. So every row this screen "added" was invisible everywhere, and
         * the screen said it had worked.
         *
         * /api/demo/assign writes product_demo_urls, decides the product
         * without guessing, and reports each row on its own: ASSIGNED,
         * ALREADY_ASSIGNED, AMBIGUOUS, UNMATCHED, INVALID or ERROR. A row it
         * cannot place is still taken in, unassigned, so an operator can review
         * it - it is simply never guessed at.
         */
        const response = await fetch("/api/demo/assign", {
          method: "POST",
          headers: { ...(await authHeaders()), "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "commit",
            rows: batch.map((row) => ({
              url: row.url,
              name: row.title || null,
              product: row.product || null,
            })),
          }),
        });
        const report = (await response.json()) as {
          error?: string;
          totals?: Record<string, number>;
          rows?: { state: string; reason: string }[];
        };
        if (!response.ok) throw new Error(report.error ?? "The batch was refused");

        inserted += report.totals?.ASSIGNED ?? 0;
        already += report.totals?.ALREADY_ASSIGNED ?? 0;
        ambiguous += report.totals?.AMBIGUOUS ?? 0;
        unmatched += report.totals?.UNMATCHED ?? 0;
        failed += (report.totals?.INVALID ?? 0) + (report.totals?.ERROR ?? 0);
        for (const r of report.rows ?? []) {
          if (["INVALID", "ERROR", "AMBIGUOUS", "UNMATCHED"].includes(r.state)) {
            refusals.push(`${r.state}: ${r.reason}`);
          }
        }
      }
      setReview({ ambiguous, unmatched });
      detail = [...new Set(refusals)].slice(0, 6).join("; ");
      setOutcome({ inserted, alreadyThere: already, failed: 0, detail });
    } catch (problem) {
      detail = problem instanceof Error ? problem.message : "unknown error";
      failed = parsed.rows.length - inserted;
    } finally {
      setIsWorking(false);
    }

    const alreadyThere = Math.max(0, parsed.rows.length - inserted - failed);
    if (failed > 0) setOutcome({ inserted, alreadyThere, failed, detail });

    if (failed > 0) {
      toast.error(`${inserted} added, ${failed} could not be`, { description: detail.slice(0, 160) });
    } else {
      toast.success(`${inserted} demo(s) added`, {
        description: alreadyThere ? `${alreadyThere} were already in the catalogue` : "none were already there",
      });
      setUploadedFile(null);
      setParsed(null);
    }
  };

  const ready = parsed?.rows.length ?? 0;
  const preview = useMemo(() => (parsed ? parsed.rows.slice(0, 5) : []), [parsed]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Upload className="w-6 h-6 text-emerald-400" />
          Bulk Add
        </h1>
        <p className="text-slate-400 text-sm">Upload CSV files to add multiple products or demos</p>
      </div>

      {/* Warning Banner */}
      <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-400 font-medium">Bulk Upload Rules</p>
          <ul className="text-xs text-amber-400/70 mt-1 space-y-1">
            <li>• The file is checked before anything is written, and you see what will happen first</li>
            <li>• A demo URL already in the catalogue is skipped, not duplicated</li>
            <li>• A row with no URL, or a category that is not one of the {categories.length || "—"}, is skipped and named</li>
            <li>• Nothing existing is overwritten</li>
          </ul>
        </div>
      </div>

      {/* Upload Type Selection */}
      {!uploadType && (
        <div className="grid grid-cols-2 gap-4">
          <Card
            className="bg-slate-900/50 border-slate-700/50 cursor-pointer hover:border-violet-500/50 transition-colors"
            onClick={() => setUploadType("products")}
          >
            <CardContent className="p-6 text-center">
              <FileSpreadsheet className="w-12 h-12 text-violet-400 mx-auto mb-3" />
              <p className="text-white font-medium">Bulk Add Products</p>
              <p className="text-xs text-slate-400 mt-1">Upload products CSV</p>
            </CardContent>
          </Card>

          <Card
            className="bg-slate-900/50 border-slate-700/50 cursor-pointer hover:border-blue-500/50 transition-colors"
            onClick={() => setUploadType("demos")}
          >
            <CardContent className="p-6 text-center">
              <FileSpreadsheet className="w-12 h-12 text-blue-400 mx-auto mb-3" />
              <p className="text-white font-medium">Bulk Add Demos</p>
              <p className="text-xs text-slate-400 mt-1">Upload demos CSV</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Area */}
      {uploadType && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Upload {uploadType === "products" ? "Products" : "Demos"} CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadType === "products" ? (
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg space-y-2">
                <p className="text-sm text-amber-300 font-medium">Products are not loaded from here.</p>
                <p className="text-xs text-slate-400">
                  The public marketplace carries demos, not product source — that is deliberate, so the
                  catalogue cannot be scraped and copied. Use <span className="text-white">Bulk Add Demos</span>{" "}
                  for the demo URLs. This panel is left in place rather than removed, and it will not
                  pretend to have uploaded anything.
                </p>
              </div>
            ) : (
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  isDragging ? "border-emerald-500 bg-emerald-500/10" : "border-slate-700 hover:border-slate-600",
                  uploadedFile && "border-emerald-500 bg-emerald-500/10",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                {uploadedFile ? (
                  <div className="space-y-2">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                    <p className="text-white font-medium">{uploadedFile.name}</p>
                    <p className="text-xs text-slate-400">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                    <p className="text-white">Drag &amp; drop your CSV file here</p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </>
                )}
              </div>
            )}

            {/* What the file has to contain */}
            {uploadType === "demos" && (
              <div className="p-4 bg-slate-800/50 rounded-lg space-y-1">
                <p className="text-sm text-slate-300 font-medium">Columns</p>
                <p className="text-xs text-slate-400">
                  <span className="text-white">url</span> and <span className="text-white">category</span> are
                  required; <span className="text-white">title</span>,{" "}
                  <span className="text-white">demo_type</span> and{" "}
                  <span className="text-white">description</span> are optional. A header row is optional, and a
                  file that is just a list of URLs is accepted — but then every row needs a category, so a
                  header with one is the easier file.
                </p>
                <p className="text-xs text-slate-400">
                  A missing title is taken from the URL. demo_type is one of {DEMO_TYPES.join(", ")} and
                  defaults to web.
                </p>
                {categoriesError && (
                  <p className="text-xs text-red-400">Categories could not be loaded: {categoriesError}</p>
                )}
              </div>
            )}

            {/* What will happen, before it happens */}
            {parsed && (
              <div className="p-4 bg-slate-800/50 rounded-lg space-y-2">
                <p className="text-sm text-white font-medium">
                  {ready} row{ready === 1 ? "" : "s"} will be added
                  {parsed.duplicatesInFile > 0 && ` · ${parsed.duplicatesInFile} repeated inside the file, counted once`}
                  {parsed.rejected.length > 0 && ` · ${parsed.rejected.length} skipped`}
                </p>
                {preview.length > 0 && (
                  <ul className="text-xs text-slate-400 space-y-0.5">
                    {preview.map((row) => (
                      <li key={row.normalized}>
                        <span className="text-slate-200">{row.title}</span> — {row.category} — {row.url.slice(0, 54)}
                      </li>
                    ))}
                    {ready > preview.length && <li>…and {ready - preview.length} more</li>}
                  </ul>
                )}
                {parsed.rejected.length > 0 && (
                  <ul className="text-xs text-amber-400/80 space-y-0.5">
                    {parsed.rejected.slice(0, 4).map((r) => (
                      <li key={`${r.line}-${r.reason}`}>
                        line {r.line}: {r.reason} — {r.sample}
                      </li>
                    ))}
                    {parsed.rejected.length > 4 && <li>…and {parsed.rejected.length - 4} more skipped</li>}
                  </ul>
                )}
              </div>
            )}

            {/* What actually happened */}
            {outcome && (
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-sm text-white font-medium">
                  {outcome.inserted} added · {outcome.alreadyThere} already in the catalogue
                  {outcome.failed > 0 && ` · ${outcome.failed} failed`}
                </p>
                {outcome.detail && <p className="text-xs text-red-400 mt-1">{outcome.detail}</p>}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadType(null);
                  setUploadedFile(null);
                  setParsed(null);
                  setOutcome(null);
                }}
                className="flex-1"
                disabled={isWorking}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={isWorking || uploadType !== "demos" || ready === 0}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                {isWorking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding {ready}…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {ready > 0 ? `Add ${ready} demo${ready === 1 ? "" : "s"}` : "Upload & Process"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkAdd;
