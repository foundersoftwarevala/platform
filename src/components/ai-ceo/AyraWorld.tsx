import { useState } from "react";
import {
  ArrowLeft, ArrowRight, RotateCw, Sparkles, Mic, MicOff, Phone, Box, ChevronDown, Settings, Globe, Github, Plus,
  ListChecks, Maximize2, X, Lock, Search, Star, Download, Share, MoreVertical, Send, Grid3x3,
} from "lucide-react";
import { AYRA_LOOKS, LOOK_NAMES, LOOK_VIDEO, LOOK_SCENE, LOOK_SCENE_VIDEO, type AyraLook, type CoreState } from "@/components/JarvisCore";
import stage from "@/assets/ayra-world-stage.jpg";
import { accessHeaders } from "@/lib/access-client";

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

const STEPS = ["Understand your command", "Open the required website", "Perform actions (e.g., login, search, etc.)", "Show results and next steps"];
const stepFor: Record<CoreState, number> = { idle: 0, listening: 1, thinking: 1, executing: 3, verifying: 3, speaking: 4, completed: 4, error: 0 };

export function TopBar({ cmd, setCmd, onRun, listening, onMic, onTools, onSettings, role, inputRef }: {
  cmd: string; setCmd: (v: string) => void; onRun: () => void; listening: boolean; onMic: () => void;
  onTools: (k: string) => void; onSettings: () => void; role: string; inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [tools, setTools] = useState(false);
  return (
    <header className="aw-top">
      <div className="flex items-center gap-3 pl-4">
        <AyraMark className="h-14 w-14" />
        <div className="leading-none">
          <div className="aw-display text-4xl font-bold tracking-wide">AYRA</div>
          <div className="mt-1 text-base tracking-wide text-[color:var(--aw-cyan)]">by Software Vala™</div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-l border-[color:var(--aw-line)] px-4">
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
      <div className="relative">
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
      <div className="flex items-center gap-3 pr-4">
        <img src={AYRA_LOOKS.default} alt="" className="h-14 w-14 rounded-full border-2 border-[color:var(--aw-cyan)] object-cover object-top" />
        <span className="text-lg">{role}</span>
        <ChevronDown className="h-4 w-4" />
      </div>
    </header>
  );
}

export function AgentStage({ core, look, setLook, reply, muted, micNote, micState, setMuted, onTalk, onEnd, onShortcut }: {
  core: CoreState; look: AyraLook | null; setLook: (l: AyraLook | null) => void; reply: string;
  muted: boolean; micNote?: string; micState?: string; setMuted: (m: boolean) => void; onTalk: () => void; onEnd: () => void; onShortcut: (cmd: string, url?: string) => void;
}) {
  const listening = core === "listening";
  const looks = Object.keys(AYRA_LOOKS) as AyraLook[];
  const [motion, setMotion] = useState(false);
  return (
    <section className="aw-panel aw-stage">
      <img src={stage} alt="AYRA in her world" className="aw-stage-bg" />
      {look && (
        <div className="aw-look" key={look} data-motion={motion && !!LOOK_VIDEO[look] ? "on" : "off"}>
          {LOOK_SCENE_VIDEO[look]
            ? <video className="aw-scene-video" src={LOOK_SCENE_VIDEO[look]} poster={LOOK_SCENE[look]} autoPlay muted loop playsInline aria-label={`${LOOK_NAMES[look]} moving`} />
            : motion && LOOK_VIDEO[look]
            ? <video src={LOOK_VIDEO[look]} poster={AYRA_LOOKS[look]} autoPlay muted loop playsInline aria-label={`${LOOK_NAMES[look]} moving`} />
            : <img src={LOOK_SCENE[look]} alt={LOOK_NAMES[look]} className="aw-look-live" />}
        </div>
      )}
      <div className="aw-stage-shade" />
      <div className="absolute left-5 top-4 flex items-center gap-3">
        <AyraMark className="h-11 w-11" />
        <div>
          <div className="aw-display text-xl font-bold tracking-wide">AYRA'S WORLD</div>
          <div className="text-sm text-[color:var(--aw-soft)]">Talk, Give Commands, Watch, and Work Together</div>
        </div>
      </div>
      <div className="aw-glass absolute left-4 top-[82px] flex items-center gap-4 px-5 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[color:var(--aw-green)] shadow-[0_0_10px_var(--aw-green)]" />
        <div className="text-[15px] leading-snug"><div>AYRA is <span className="text-[color:var(--aw-green)]">online</span></div><div>Ready to help you</div></div>
      </div>
      <div className="aw-bubble">
        {reply ? <p className="text-base leading-snug">{reply.replace(/\*\*|__/g, "")}</p> : <p className="text-xl leading-snug">Hi!<br />I'm <span className="text-[color:var(--aw-cyan)]">AYRA</span><br />How can I help you today?</p>}
      </div>
      <div className="aw-plan">
        {["Plan", "Search", "Open", "Login", "Execute", "Report"].map((s, i) => (
          <div key={s} className={i < stepFor[core] + (stepFor[core] ? 1 : 0) ? "text-[color:var(--aw-cyan)]" : ""}>{s}</div>
        ))}
      </div>
      <div className="aw-agents" aria-label="All agents">
        <button onClick={() => setLook(null)} title="AYRA's World" className={!look ? "on" : ""}><img src={stage} alt="AYRA's World" /></button>
        {looks.map((k) => (
          <button key={k} onClick={() => setLook(k)} title={LOOK_NAMES[k]} className={look === k ? "on" : ""}><img src={LOOK_SCENE[k]} alt={LOOK_NAMES[k]} /></button>
        ))}
      </div>
      {look && <div className="aw-name">{LOOK_NAMES[look]}</div>}
      {look && !LOOK_SCENE_VIDEO[look] && LOOK_VIDEO[look] && <button onClick={() => setMotion(!motion)} aria-pressed={motion} className="aw-motion">{motion ? "Show in scene" : "Play motion"}</button>}
      <div className="absolute bottom-[172px] left-1/2 flex -translate-x-[48%] gap-6">
        <div className="flex flex-col items-center gap-2"><button aria-label="Talk" onClick={onTalk} className={`aw-round aw-talk ${listening ? "on" : ""}`}><Mic className="h-8 w-8" /></button><span>Talk</span></div>
        <div className="flex flex-col items-center gap-2"><button aria-label="Mute" aria-pressed={muted} onClick={() => setMuted(!muted)} className={`aw-round aw-mute ${muted ? "on" : ""}`}><MicOff className="h-7 w-7" /></button><span>Mute</span></div>
        <div className="flex flex-col items-center gap-2"><button aria-label="End" onClick={onEnd} className="aw-round aw-end"><Phone className="h-8 w-8 rotate-[135deg]" /></button><span>End</span></div>
      </div>
      <div className="absolute bottom-[110px] left-[230px] flex items-center gap-3 text-sm text-[color:var(--aw-soft)]">
        <span role="status" aria-live="polite" className={micState === "blocked" || micState === "unsupported" || micState === "no-device" ? "aw-mic-warn" : ""}>{micNote || (core === "idle" ? "Standing by" : "Working...")}</span>
        <div className={`aw-wave ${listening || core === "speaking" ? "live" : ""}`}>{Array.from({ length: 30 }, (_, i) => <span key={i} style={{ animationDelay: `${(i % 10) * 0.08}s`, height: `${20 + ((i * 37) % 80)}%` }} />)}</div>
      </div>
      <div className="aw-chips absolute bottom-4 left-11 right-3 flex flex-wrap gap-x-2.5 gap-y-2.5">
        <button className="aw-chip" onClick={() => onShortcut("Check my Facebook", "https://www.facebook.com")}><Globe className="h-5 w-5" />Check my Facebook</button>
        <button className="aw-chip" onClick={() => onShortcut("Open GitHub and show my repositories", "https://github.com")}><Github className="h-5 w-5" />Open GitHub and show my repositories</button>
        <button className="aw-chip" onClick={() => onShortcut("Create a new project")}><Plus className="h-5 w-5" />Create a new project</button>
        <button className="aw-chip" onClick={() => onShortcut("Open Software Vala dashboard")}><span className="font-black text-[color:var(--aw-blue)]">S</span>Open Software Vala dashboard</button>
        <button className="aw-chip" onClick={() => onShortcut("Show today's tasks")}><ListChecks className="h-5 w-5" />Show today's tasks</button>
      </div>
    </section>
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
  const [q, setQ] = useState("");
  const [task, setTask] = useState("");
  const [shotUrl, setShotUrl] = useState("");
  const [shot, setShot] = useState<{ url: string; blob: Blob; name: string } | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const [shotErr, setShotErr] = useState("");
  const open = (u: string) => window.open(u, "_blank", "noopener");
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
    <section className="aw-panel flex min-h-0 flex-col p-3">
      <div className="flex items-center gap-4 px-2 pb-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--aw-blue)]/20 ring-2 ring-[color:var(--aw-cyan)]"><RotateCw className="h-6 w-6 text-[color:var(--aw-cyan)]" /></div>
        <div className="flex-1"><div className="aw-display text-xl font-bold">BROWSER</div><div className="text-xs text-[color:var(--aw-soft)]">AYRA will open, control, and work here for you</div></div>
        {["Browser", "Automate", "Screenshot", "Download"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-2 text-[15px] ${tab === t ? "aw-tab-on" : ""}`}>{t}</button>
        ))}
        <button aria-label="Expand" onClick={() => open("https://www.google.com")} className="ml-2 rounded-md border border-[color:var(--aw-line)] p-2"><Maximize2 className="h-5 w-5" /></button>
      </div>
      <div className="aw-chrome flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-2 pt-2">
          <div className="flex w-52 items-center gap-2 rounded-t-lg bg-[color:var(--aw-chrome-2)] px-3 py-2 text-sm"><span className="font-bold text-[color:var(--g-blue)]">G</span>Google<X className="ml-auto h-4 w-4" /></div>
          <Plus className="h-5 w-5" /><div className="ml-auto flex gap-4 pr-2 text-[color:var(--aw-muted)]">—<span>▢</span><X className="h-4 w-4" /></div>
        </div>
        <div className="flex items-center gap-4 bg-[color:var(--aw-chrome-2)] px-3 py-2">
          <ArrowLeft className="h-5 w-5" /><ArrowRight className="h-5 w-5 opacity-50" /><RotateCw className="h-5 w-5" />
          <div className="flex flex-1 items-center gap-2 rounded-full bg-[color:var(--aw-chrome)] px-4 py-1.5 text-[15px]"><Lock className="h-4 w-4" />https://www.google.com<Star className="ml-auto h-5 w-5" /></div>
          <Download className="h-5 w-5" /><Share className="h-5 w-5" /><MoreVertical className="h-5 w-5" />
        </div>
        {tab === "Browser" ? (
          <div className="aw-google flex-1 overflow-auto">
            <div className="flex items-center justify-end gap-4 p-3 text-xs">
              <button onClick={() => open("https://mail.google.com")}>Gmail</button><button onClick={() => open("https://images.google.com")}>Images</button>
              <Grid3x3 className="h-5 w-5" />
              <button onClick={() => open("https://accounts.google.com")} className="rounded-full bg-[color:var(--g-blue)] px-5 py-2 text-sm text-[color:var(--g-white)]">Sign in</button>
            </div>
            <div className="mt-4 text-center text-7xl font-medium tracking-tight" aria-label="Google">
              <span className="text-[color:var(--g-blue)]">G</span><span className="text-[color:var(--g-red)]">o</span><span className="text-[color:var(--g-yellow)]">o</span><span className="text-[color:var(--g-blue)]">g</span><span className="text-[color:var(--g-green)]">l</span><span className="text-[color:var(--g-red)]">e</span>
            </div>
            <div className="mx-auto mt-6 flex w-[66%] items-center gap-3 rounded-full border border-[color:var(--g-line)] px-4 py-2.5">
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
        ) : tab === "Automate" ? (
          <div className="aw-google flex flex-1 flex-col gap-3 overflow-auto p-4 text-sm">
            <div className="font-semibold">Tell AYRA a task — she plans it and opens any website it mentions.</div>
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

export function ActivityPanel({ core, status }: { core: CoreState; status: string }) {
  const step = stepFor[core];
  return (
    <section className="aw-panel grid gap-3 p-3">
      <div className="grid grid-cols-[1.25fr_1fr] gap-3">
        <div>
          <div className="aw-display mb-2 flex items-center gap-3 px-2 text-lg font-bold"><RotateCw className="h-6 w-6 text-[color:var(--aw-cyan)]" />AYRA ACTIVITY</div>
          <div className="aw-glass flex items-center gap-4 px-6 py-3 text-xl font-semibold text-[color:var(--aw-cyan)]"><Send className="h-6 w-6" /><span className="truncate">{status}</span></div>
        </div>
        <div className="aw-glass flex gap-3 p-4">
          <Lock className="h-7 w-7 shrink-0 text-[color:var(--aw-green)]" />
          <div className="text-sm"><div>Access: <span className="text-[color:var(--aw-green)]">Connected accounts only</span></div><div className="mt-2 text-xs text-[color:var(--aw-soft)]">If login is required, AYRA will open the login page for you.</div></div>
        </div>
      </div>
      <div className="aw-glass grid grid-cols-4 gap-2 px-4 py-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-start gap-3 text-sm">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${i + 1 <= step ? "aw-step-on" : "border-[color:var(--aw-soft)]"}`}>{i + 1}</span>{s}
          </div>
        ))}
      </div>
    </section>
  );
}
