import { useRef, useState } from "react";
import { FileCode, Github, Loader2, Sparkle, Upload, X } from "lucide-react";
import { analyzeProjectFn } from "@/lib/vala-ai/studio/ai/analyze.functions";
import { fetchGithubRepoFn } from "@/lib/vala-ai/studio/github.functions";

type Item = {
  title: string;
  category: "missing" | "branding" | "bug";
  priority: "P0" | "P1" | "P2" | "P3";
  file: string | null;
  why: string;
  fix: string;
};
type Plan = { summary: string; items: Item[] };

const CAT: Record<Item["category"], { label: string; cls: string }> = {
  missing: { label: "Missing", cls: "text-primary border-primary/40" },
  branding: { label: "Branding", cls: "text-studio-ok border-studio-ok/40" },
  bug: { label: "Bug", cls: "text-studio-fail border-studio-fail/40" },
};
const PRI: Record<Item["priority"], string> = {
  P0: "bg-studio-fail text-background",
  P1: "bg-primary text-primary-foreground",
  P2: "bg-studio-raise text-foreground",
  P3: "bg-studio-raise text-studio-dim",
};

export function AiPlanAnalyzer() {
  const [req, setReq] = useState("");
  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [repoInfo, setRepoInfo] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const read = await Promise.all(
      Array.from(list)
        .filter((f) => f.size < 200_000)
        .map(async (f) => ({
          name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
          content: await f.text(),
        })),
    );
    setFiles((p) => [...p, ...read].slice(0, 60));
  };

  const importRepo = async () => {
    setImporting(true);
    setErr(null);
    setRepoInfo(null);
    try {
      const r = await fetchGithubRepoFn({ data: { url: repoUrl } });
      setFiles((p) => [...p.filter((f) => !f.name.startsWith("github:")), ...r.files].slice(0, 80));
      setRepoInfo(
        `${r.repo}@${r.branch} · ${r.files.length} files laaye${r.truncated ? " (bade repo se sirf zaroori files)" : ""}`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "GitHub se code nahi aaya.");
    } finally {
      setImporting(false);
    }
  };

  const run = async () => {
    setBusy(true);
    setErr(null);
    setPlan(null);
    try {
      setPlan(await analyzeProjectFn({ data: { requirement: req, files } }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-studio-line bg-studio-panel p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkle className="h-4 w-4 text-primary" /> AI audit & action plan
      </div>
      <p className="mt-1 text-xs text-studio-dim">
        Apni zaroorat likhein aur source files dein — AI kamiyan, branding badlav aur bugs dhoondh
        kar priority-wise plan banayega.
      </p>

      <textarea
        aria-label="Requirement for audit"
        value={req}
        onChange={(e) => setReq(e.target.value)}
        rows={3}
        placeholder="Jaise: Isko 'Rangrez' brand mein badlo, hara-sona colour, WhatsApp order button chahiye…"
        className="mt-3 w-full resize-none rounded border border-studio-line bg-background p-3 text-sm outline-none focus:border-primary"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Github className="h-4 w-4 text-studio-dim" />
        <input
          aria-label="GitHub repo URL"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="h-9 min-w-[240px] flex-1 rounded border border-studio-line bg-background px-3 font-mono text-[12px] outline-none focus:border-primary"
        />
        <button
          onClick={importRepo}
          disabled={importing || !repoUrl.trim()}
          className="inline-flex items-center gap-2 rounded border border-studio-line px-3 py-2 text-sm text-studio-dim hover:text-foreground disabled:opacity-50"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Github className="h-4 w-4" />
          )}{" "}
          {importing ? "Laa raha hoon…" : "Import from GitHub"}
        </button>
      </div>
      {repoInfo && <p className="mt-1 font-mono text-[11px] text-studio-ok">{repoInfo}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          aria-label="Source files"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-2 rounded border border-studio-line px-3 py-2 text-sm text-studio-dim hover:text-foreground"
        >
          <Upload className="h-4 w-4" /> Add source files
        </button>
        <span className="font-mono text-[11px] text-studio-faint">
          {files.filter((f) => !f.name.startsWith("github:")).length} uploaded ·{" "}
          {files.filter((f) => f.name.startsWith("github:")).length} from GitHub
        </span>
        <button
          onClick={run}
          disabled={busy || !req.trim()}
          className="ml-auto inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkle className="h-4 w-4" />}{" "}
          {busy ? "Analyzing…" : "Generate plan"}
        </button>
      </div>

      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span
              key={f.name + i}
              className="inline-flex items-center gap-1 rounded border border-studio-line bg-background px-2 py-0.5 font-mono text-[11px] text-studio-dim"
            >
              <FileCode className="h-3 w-3" />
              {f.name}
              <button
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {err && (
        <p className="mt-3 rounded border border-studio-fail/40 p-2 text-sm text-studio-fail">
          {err}
        </p>
      )}

      {plan && (
        <div className="mt-4 space-y-2">
          <p className="text-sm">{plan.summary}</p>
          {plan.items.map((it, i) => (
            <div key={i} className="rounded border border-studio-line bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${PRI[it.priority]}`}
                >
                  {it.priority}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${CAT[it.category].cls}`}
                >
                  {CAT[it.category].label}
                </span>
                <span className="text-sm font-medium">{it.title}</span>
                {it.file && (
                  <span className="ml-auto font-mono text-[11px] text-studio-faint">{it.file}</span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-studio-dim">{it.why}</p>
              <p className="mt-1 text-xs">
                <span className="text-studio-faint">Fix › </span>
                {it.fix}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
