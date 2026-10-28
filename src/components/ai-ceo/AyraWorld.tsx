import { useRef, useState, type CSSProperties } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, RotateCw, Sparkles, Mic, MicOff, Phone, Box, ChevronDown, Settings, Globe, Github, Plus,
  ListChecks, Maximize2, Search, Download, Send, Grid3x3, WandSparkles,
} from "lucide-react";
import { AYRA_LOOKS, LOOK_NAMES, LOOK_VIDEO, LOOK_SCENE, LOOK_SCENE_VIDEO, LOOK_THEME, type AyraLook, type CoreState } from "@/components/JarvisCore";
import stage from "@/assets/ayra-world-stage.jpg";
import { accessHeaders } from "@/lib/access-client";
import { autoFillAyraCompanyForm } from "@/lib/ai-ceo/ayra-autofill.functions";
import { fillCompanyFormControls, inspectEmptyCompanyFormControls } from "@/lib/ai-ceo/ayra-autofill.browser";

export function AyraMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 44" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="aw-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--aw-cyan)" />
          <stop offset="1" stopColor="var(--aw-blue)" />
        </linearGradient>
      </defs>
      <path d="M24 2 L46 42 H34 L24 22 L14 42 H2 Z" fill="url(#aw-g)" />
      <path d="M18 34 H30 L27 28 H21 Z" fill="url(#aw-g)" opacity=".8" />
    </svg>
  );
}

const STEPS = ["Ready", "Listen", "Think", "Respond", "Complete"];
const stepFor: Record<CoreState, number> = { idle: 0, listening: 1, thinking: 2, executing: 3, verifying: 3, speaking: 4, completed: 4, error: 0 };

export function TopBar({ cmd, setCmd, onRun, listening, onMic, onTools, onSettings, role, inputRef }: {
  cmd: string; setCmd: (v: string) => void; onRun: () => void; listening: boolean; onMic: () => void;
  onTools: (k: string) => void; onSettings: () => void; role: string; inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [tools, setTools] = useState(false);
  return (
    <header className="aw-top">
      <div className="aw-brand flex items-center gap-3 pl-4">
        <AyraMark className="h-14 w-14" />
        <div className="leading-none">
          <div className="aw-display text-4xl font-bold tracking-wide">AYRA</div>
          <div className="mt-1 text-base tracking-wide text-[color:var(--aw-cyan)]">by Software Vala™</div>
        </div>
      </div>
      <div className="aw-nav-controls flex items-center gap-2 border-l border-[color:var(--aw-line)] px-4">
        <button aria-label="Back" onClick={() => history.back()} className="nav-btn"><ArrowLeft className="h-6 w-6" /></button>
        <button aria-label="Forward" onClick={() => history.forward()} className="nav-btn"><ArrowRight className="h-6 w-6" /></button>
        <button aria-label="Reload" onClick={() => location.reload()} className="nav-btn"><RotateCw className="h-6 w-6" /></button>
      </div>
      <div className="aw-cmd">
        <Sparkles className="h-6 w-6 text-[color:var(--aw-cyan)]" />
        <input ref={inputRef} value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onRun()}
          aria-label="Command AYRA" placeholder="Tell AYRA what to do..." className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-[color:var(--aw-muted)]" />
        {cmd ? <button aria-label="Send command" onClick={onRun}><Send className="h-5 w-5 text-[color:var(--aw-cyan)]" /></button>
          : <button aria-label="Talk to AYRA" aria-pressed={listening} onClick={onMic}><Mic className={`h-6 w-6 text-[color:var(--aw-cyan)] ${listening ? "animate-pulse" : ""}`} /></button>}
      </div>
      <div className="aw-top-tools relative">
        <button className="aw-pill" onClick={() => setTools((t) => !t)} aria-expanded={tools}>
          <Box className="h-5 w-5 text-[color:var(--aw-cyan)]" /> Tools &amp; Access <ChevronDown className="h-4 w-4" />
        </button>
        {tools && (
          <div className="aw-menu" onMouseLeave={() => setTools(false)}>
            {([["settings", "Settings"], ["roles", "Roles & Permissions"], ["security", "Security"], ["chat", "Chat with AYRA"], ["ops", "Operations Dashboard"], ["lookbook", "All Agents"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setTools(false); onTools(k); }}>{l}</button>
            ))}
          </div>
        )}
      </div>
      <button aria-label="Open Ayra Command Center settings" onClick={onSettings} className="aw-pill !px-3"><Settings className="h-6 w-6" /></button>
      <div className="aw-top-user flex items-center gap-3 pr-4">
        <img src={AYRA_LOOKS.default} alt="" className="h-14 w-14 rounded-full border-2 border-[color:var(--aw-cyan)] object-cover object-top" />
        <span className="text-lg">{role}</span>
        <ChevronDown className="h-4 w-4" />
      </div>
    </header>
  );
}

export function AgentStage({
  core,
  look,
  setLook,
  reply,
  muted,
  micNote,
  micState,
  setMuted,
  onTalk,
  onEnd,
  onShortcut,
}: {
  core: CoreState;
  look: AyraLook | null;
  setLook: (l: AyraLook | null) => void;
  reply: string;
  muted: boolean;
  micNote?: string;
  micState?: string;
  setMuted: (m: boolean) => void;
  onTalk: () => void;
  onEnd: () => void;
  onShortcut: (cmd: string, url?: string) => void;
}) {
  const listening = core === "listening";
  const looks = Object.keys(AYRA_LOOKS) as AyraLook[];
  const [motion, setMotion] = useState(false);
  const accent = LOOK_THEME[look ?? "default"];
  const stageStyle = {
    "--aw-agent-accent": `oklch(0.78 ${accent.c ?? 0.18} ${accent.primary})`,
  } as CSSProperties;
  return (
    <>
      <section className="aw-panel aw-stage" style={stageStyle} data-agent-look={look ?? "default"}>
        <img src={stage} alt="AYRA in her world" className="aw-stage-bg" />
        {look && (
          <div
            className="aw-look"
            key={look}
            data-motion={motion && !!LOOK_VIDEO[look] ? "on" : "off"}
          >
            {LOOK_SCENE_VIDEO[look] ? (
              <video
                className="aw-scene-video"
                src={LOOK_SCENE_VIDEO[look]}
                poster={LOOK_SCENE[look]}
                autoPlay
                muted
                loop
                playsInline
                aria-label={`${LOOK_NAMES[look]} moving`}
              />
            ) : motion && LOOK_VIDEO[look] ? (
              <video
                src={LOOK_VIDEO[look]}
                poster={AYRA_LOOKS[look]}
                autoPlay
                muted
                loop
                playsInline
                aria-label={`${LOOK_NAMES[look]} moving`}
              />
            ) : (
              <img src={LOOK_SCENE[look]} alt={LOOK_NAMES[look]} className="aw-look-live" />
            )}
          </div>
        )}
        <div className="aw-stage-shade" />
        <output className="sr-only" data-testid="agent-reply">
          {reply}
        </output>
        <div className="aw-stage-controls" aria-label="AYRA call controls">
          <button
            aria-label="Talk"
            onClick={onTalk}
            className={`aw-round aw-talk ${listening ? "on" : ""}`}
          >
            <Mic className="h-6 w-6" />
          </button>
          <button
            aria-label="Mute"
            aria-pressed={muted}
            onClick={() => setMuted(!muted)}
            className={`aw-round aw-mute ${muted ? "on" : ""}`}
          >
            <MicOff className="h-5 w-5" />
          </button>
          <button aria-label="End" onClick={onEnd} className="aw-round aw-end">
            <Phone className="h-6 w-6 rotate-[135deg]" />
          </button>
        </div>
      </section>
      <section
        className="aw-stage-info"
        style={stageStyle}
        aria-label="AYRA information and actions"
      >
        <div className="aw-agent-overview">
          <div className="aw-agent-title">
            <AyraMark className="h-9 w-9" />
            <div>
              <strong>AYRA'S WORLD</strong>
              <span>Talk, give commands, watch, and work together</span>
            </div>
          </div>
          <div className="aw-agent-status">
            <span
              role="status"
              aria-live="polite"
              className={
                micState === "blocked" || micState === "unsupported" || micState === "no-device"
                  ? "aw-mic-warn"
                  : ""
              }
            >
              {micNote || (core === "idle" ? "Standing by" : "Working...")}
            </span>
            <div
              className={`aw-wave ${listening || core === "speaking" ? "live" : ""}`}
              aria-hidden="true"
            >
              {Array.from({ length: 18 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    animationDelay: `${(i % 9) * 0.08}s`,
                    height: `${20 + ((i * 37) % 80)}%`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="aw-agent-look-name">{look ? LOOK_NAMES[look] : "AYRA"}</div>
          {look && !LOOK_SCENE_VIDEO[look] && LOOK_VIDEO[look] && (
            <button onClick={() => setMotion(!motion)} aria-pressed={motion} className="aw-motion">
              {motion ? "Show in scene" : "Play motion"}
            </button>
          )}
        </div>
        <div className="aw-plan" aria-label="AYRA conversation status">
          <strong>CONVERSATION</strong>
          <div className="aw-plan-steps">
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={`aw-plan-step${index <= stepFor[core] ? " is-active" : ""}`}
                aria-current={index === stepFor[core] ? "step" : undefined}
              >
                <span className="aw-plan-dot" aria-hidden="true" />
                {step}
              </div>
            ))}
          </div>
        </div>
        <div className="aw-agent-tools">
          <div className="aw-agent-looks" aria-label="AYRA looks">
            <button
              onClick={() => setLook(null)}
              title="AYRA's World"
              className={!look ? "on" : ""}
            >
              <img src={stage} alt="AYRA's World" />
            </button>
            {looks.map((k) => (
              <button
                key={k}
                onClick={() => setLook(k)}
                title={LOOK_NAMES[k]}
                className={look === k ? "on" : ""}
              >
                <img src={LOOK_SCENE[k]} alt={LOOK_NAMES[k]} />
              </button>
            ))}
          </div>
          <div className="aw-agent-shortcuts" aria-label="AYRA shortcuts">
            <button
              className="aw-chip"
              onClick={() => onShortcut("Check my Facebook", "https://www.facebook.com")}
            >
              <Globe className="h-4 w-4" />
              Check my Facebook
            </button>
            <button
              className="aw-chip"
              onClick={() =>
                onShortcut("Open GitHub and show my repositories", "https://github.com")
              }
            >
              <Github className="h-4 w-4" />
              Open GitHub and show my repositories
            </button>
            <button className="aw-chip" onClick={() => onShortcut("Create a new project")}>
              <Plus className="h-4 w-4" />
              Create a new project
            </button>
            <button className="aw-chip" onClick={() => onShortcut("Open Software Vala dashboard")}>
              <span className="font-black text-[color:var(--aw-blue)]">S</span>Open Software Vala
              dashboard
            </button>
            <button className="aw-chip" onClick={() => onShortcut("Show today's tasks")}>
              <ListChecks className="h-4 w-4" />
              Show today's tasks
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

const SHORTCUTS: [string, string, string][] = [
  ["YouTube", "https://www.youtube.com", "▶"], ["Gmail", "https://mail.google.com", "M"], ["Drive", "https://drive.google.com", "▲"],
  ["Maps", "https://maps.google.com", "●"], ["Translate", "https://translate.google.com", "G"], ["Photos", "https://photos.google.com", "✿"],
];

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function BrowserPanel({ onRun, reply, busy }: { onRun: (cmd: string) => void; reply: string; busy: boolean }) {
  const [tab, setTab] = useState("Browser");
  const [autofillBusy, setAutofillBusy] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const runCompanyAutofill = useServerFn(autoFillAyraCompanyForm);
  const [q, setQ] = useState("");
  const [task, setTask] = useState("");
  const [shotUrl, setShotUrl] = useState("");
  const [shot, setShot] = useState<{ url: string; blob: Blob; name: string } | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const [shotErr, setShotErr] = useState("");
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const open = (u: string) => {
    const parsed = new URL(u, window.location.href);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return;
    setEmbeddedUrl(parsed.toString());
    setTab("Browser");
  };
  const openSeparately = (u: string) => window.open(u, "_blank", "noopener,noreferrer");
  const autofillCompanyDetails = async () => {
    if (!embeddedUrl || !iframeRef.current) {
      toast.info("Open a form in the workspace before using Auto-Fill.");
      return;
    }
    let page: Document | null;
    try {
      if (new URL(embeddedUrl).origin !== window.location.origin) {
        toast.error("Browser security prevents AYRA from reading forms on another website.", {
          description: "Auto-Fill works only on same-origin pages. This page was not changed.",
        });
        return;
      }
      page = iframeRef.current.contentDocument;
      if (!page) throw new Error("The form page is not available yet.");
    } catch (error) {
      toast.error("AYRA could not access this form.", {
        description: error instanceof Error ? error.message : "The page may have navigated to another origin.",
      });
      return;
    }
    const inspected = inspectEmptyCompanyFormControls(page);
    if (inspected.fields.length === 0) {
      toast.info("No supported empty form fields were found. Existing values were left unchanged.");
      return;
    }
    setAutofillBusy(true);
    try {
      const matches = await runCompanyAutofill({ data: { fields: inspected.fields } });
      const filled = fillCompanyFormControls(inspected.controls, matches, page.defaultView);
      if (filled === 0) {
        toast.info("No empty fields matched the saved Software Vala company profile.");
        return;
      }
      toast.success("Form filled with Software Vala details.", {
        description: `${filled} field${filled === 1 ? "" : "s"} filled. Review them before submitting the form.`,
      });
    } catch (error) {
      toast.error("Could not auto-fill this form.", {
        description: error instanceof Error ? error.message : "The VPS-backed profile request failed.",
      });
    } finally {
      setAutofillBusy(false);
    }
  };
  const search = (lucky = false) => q.trim() && open(`https://www.google.com/search?q=${encodeURIComponent(q.trim())}${lucky ? "&btnI=1" : ""}`);
  const automate = () => {
    const t = task.trim();
    if (!t) return;
    const site = t.match(/https?:\/\/\S+|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|org|net|io|in|dev|app|ai|co)(\/\S*)?/i)?.[0];
    if (site) open(/^https?:/i.test(site) ? site : `https://${site}`);
    onRun(t);
  };
  const capture = async () => {
    const u = shotUrl.trim();
    if (!u) return;
    setShotBusy(true); setShotErr("");
    try {
      const res = await fetch("/api/screenshot", { method: "POST", headers: { "Content-Type": "application/json", ...accessHeaders() }, body: JSON.stringify({ url: u }) });
      if (!res.ok) { const d = (await res.json().catch(() => null)) as { error?: string } | null; throw new Error(d?.error ?? "Could not capture that page."); }
      const blob = await res.blob();
      if (shot) URL.revokeObjectURL(shot.url);
      setShot({ url: URL.createObjectURL(blob), blob, name: u.replace(/^https?:\/\//, "").replace(/[^a-z0-9.-]+/gi, "_").slice(0, 60) });
    } catch (e) { setShotErr(e instanceof Error ? e.message : "Could not capture that page."); }
    finally { setShotBusy(false); }
  };
  return (
    <section className="aw-panel aw-browser-panel flex min-h-0 flex-col">
      <div className="aw-browser-header">
        <div className="aw-browser-title"><strong>WORKSPACE</strong><span>External pages open here when their framing policy allows.</span></div>
        <div className="aw-browser-tabs" role="group" aria-label="Workspace tools">
          {["Browser", "Automate", "Screenshot", "Download"].map((t) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={tab === t ? "aw-tab-on" : ""}>{t}</button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => void autofillCompanyDetails()} disabled={autofillBusy || !embeddedUrl} className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--primary)] px-2.5 py-1.5 text-xs text-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-50" aria-label="Auto-fill company details">
            <WandSparkles className="h-3.5 w-3.5" />{autofillBusy ? "Filling…" : "Auto-Fill"}
          </button>
          <button aria-label="Open current page separately" onClick={() => openSeparately(embeddedUrl ?? "https://www.google.com")} className="aw-browser-open"><Maximize2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="aw-chrome flex min-h-0 flex-1 flex-col">
        {tab === "Browser" ? (
          embeddedUrl ? (
            <div className="flex min-h-0 flex-1 flex-col bg-[color:var(--g-white)] text-[color:var(--g-ink)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--g-line)] bg-[color:var(--g-btn)] px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold">In-panel page</div>
                  <div className="max-w-[50vw] truncate opacity-75">{embeddedUrl}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setEmbeddedUrl(null)} className="rounded border border-[color:var(--g-line)] px-2 py-1">Back</button>
                  <button type="button" onClick={() => openSeparately(embeddedUrl)} className="rounded border border-[color:var(--g-line)] px-2 py-1">Open separately</button>
                </div>
              </div>
              <div className="border-b border-[color:var(--g-line)] px-3 py-2 text-xs" role="note">
                Auto-Fill only reads same-origin forms, fills supported empty fields, and never submits. Cross-origin pages cannot be inspected by this browser panel. Some providers also block iframe embedding.
              </div>
              <iframe ref={iframeRef} title={`External page ${new URL(embeddedUrl).hostname}`} src={embeddedUrl} referrerPolicy="strict-origin-when-cross-origin" className="min-h-0 flex-1 border-0" />
            </div>
          ) : (
          <div className="aw-google flex-1 overflow-auto">
            <div className="flex items-center justify-end gap-4 p-3 text-xs">
              <button onClick={() => open("https://mail.google.com")}>Gmail</button><button onClick={() => open("https://images.google.com")}>Images</button>
              <Grid3x3 className="h-5 w-5" />
              <button onClick={() => open("https://accounts.google.com")} className="rounded-full bg-[color:var(--g-blue)] px-5 py-2 text-sm text-[color:var(--g-white)]">Sign in</button>
            </div>
            <div className="mt-4 text-center text-7xl font-medium tracking-tight" aria-label="Google">
              <span className="text-[color:var(--g-blue)]">G</span><span className="text-[color:var(--g-red)]">o</span><span className="text-[color:var(--g-yellow)]">o</span><span className="text-[color:var(--g-blue)]">g</span><span className="text-[color:var(--g-green)]">l</span><span className="text-[color:var(--g-red)]">e</span>
            </div>
            <div className="aw-google-search rounded-full border border-[color:var(--g-line)]">
              <Search className="h-5 w-5" /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} aria-label="Search Google" className="flex-1 bg-transparent outline-none" />
            </div>
            <div className="mt-6 flex justify-center gap-3 text-sm">
              <button onClick={() => search()} className="rounded bg-[color:var(--g-btn)] px-5 py-2.5">Google Search</button>
              <button onClick={() => search(true)} className="rounded bg-[color:var(--g-btn)] px-5 py-2.5">I'm Feeling Lucky</button>
            </div>
            <div className="mt-8 flex justify-center gap-6 pb-4 text-xs">
              {SHORTCUTS.map(([n, u, ic]) => (
                <button key={n} onClick={() => open(u)} className="flex w-20 flex-col items-center gap-2"><span className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--g-btn)] text-lg font-bold text-[color:var(--g-red)]">{ic}</span>{n}</button>
              ))}
              <button onClick={() => open("https://www.google.com")} className="flex w-20 flex-col items-center gap-2"><span className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--g-btn)]"><Plus className="h-5 w-5" /></span>Add shortcut</button>
            </div>
          </div>
          )
        ) : tab === "Automate" ? (
          <div className="aw-google flex flex-1 flex-col gap-3 overflow-auto p-4 text-sm">
            <div className="font-semibold">Ask AYRA about a task. Mentioned websites open in this panel when allowed; framing restrictions may require opening them separately. AYRA does not interact with those pages.</div>
            <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={2} aria-label="Automation task" placeholder="e.g. Open github.com and tell me how to create a new repository"
              className="rounded-lg border border-[color:var(--g-line)] bg-transparent p-2 outline-none" />
            <button onClick={automate} disabled={!task.trim() || busy} className="self-start rounded bg-[color:var(--g-blue)] px-5 py-2 text-[color:var(--g-white)] disabled:opacity-50">Run with AYRA</button>
            {(busy || reply) && <div className="whitespace-pre-wrap rounded-lg bg-[color:var(--g-btn)] p-3">{reply || "AYRA is working..."}</div>}
          </div>
        ) : tab === "Screenshot" ? (
          <div className="aw-google flex flex-1 flex-col gap-3 overflow-auto p-4 text-sm">
            <div className="flex gap-2">
              <input value={shotUrl} onChange={(e) => setShotUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && capture()} aria-label="Website to capture" placeholder="example.com"
                className="flex-1 rounded-full border border-[color:var(--g-line)] bg-transparent px-4 py-2 outline-none" />
              <button onClick={capture} disabled={!shotUrl.trim() || shotBusy} className="rounded bg-[color:var(--g-blue)] px-5 py-2 text-[color:var(--g-white)] disabled:opacity-50">{shotBusy ? "Capturing..." : "Capture"}</button>
            </div>
            {shotErr && <div className="text-[color:var(--g-red)]">{shotErr}</div>}
            {shot ? <img src={shot.url} alt={`Screenshot of ${shot.name}`} className="w-full rounded border border-[color:var(--g-line)]" /> : !shotBusy && <div className="text-center opacity-70">Enter a website and AYRA will take a real screenshot of it.</div>}
          </div>
        ) : (
          <div className="aw-google flex flex-1 flex-col gap-3 overflow-auto p-4 text-sm">
            <div className="font-semibold">Save AYRA's work to your device</div>
            <button onClick={() => shot && save(shot.blob, `${shot.name}.png`)} disabled={!shot} className="flex items-center gap-2 self-start rounded bg-[color:var(--g-btn)] px-4 py-2 disabled:opacity-50"><Download className="h-4 w-4" />Latest screenshot {shot ? `(${shot.name})` : "— take one in Screenshot first"}</button>
            <button onClick={() => reply && save(new Blob([reply], { type: "text/plain;charset=utf-8" }), "ayra-reply.txt")} disabled={!reply} className="flex items-center gap-2 self-start rounded bg-[color:var(--g-btn)] px-4 py-2 disabled:opacity-50"><Download className="h-4 w-4" />AYRA's last answer {reply ? "" : "— give AYRA a command first"}</button>
          </div>
        )}
      </div>
    </section>
  );
}
