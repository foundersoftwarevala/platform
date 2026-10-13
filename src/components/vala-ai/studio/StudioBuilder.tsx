import { Link, useSearch } from "@tanstack/react-router";
import { useOperator } from "../session";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateSiteFn } from "@/lib/vala-ai/studio/ai/site.functions";
import { withTheme } from "@/lib/vala-ai/studio/site-themes";
import { MAX_SITE_HTML_CHARACTERS } from "@/lib/vala-ai/studio/site-output";
import {
  Bell,
  Home,
  Eye,
  Sparkles,
  Palette,
  Code2,
  Settings,
  Hammer,
  ExternalLink,
  Globe,
  Star,
  Phone,
  Infinity as InfinityIcon,
  Moon,
  Send,
  Heart,
  Stethoscope,
  ShieldCheck,
} from "lucide-react";

const TABS = [
  { label: "Preview", icon: Eye },
  { label: "Inspect", icon: Sparkles },
  { label: "Design", icon: Palette },
  { label: "Code", icon: Code2 },
  { label: "Settings", icon: Settings },
];

const SUGGESTIONS = [
  "Add emergency contact info",
  "Include pet photo gallery",
  "Set up online booking",
];

export function StudioBuilder() {
  const [tab, setTab] = useState("Preview");
  const [msg, setMsg] = useState("");
  const { theme, prompt, layout } = useSearch({ strict: false }) as {
    theme?: string;
    prompt?: string;
    layout?: string;
  };
  const gen = useServerFn(generateSiteFn);
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  const [chat, setChat] = useState<{ me: boolean; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [maxCharacters, setMaxCharacters] = useState("");
  const started = useRef(false);
  const operator = useOperator();
  const KEY = `vala-studio-builder:${operator.id}`;
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v?.html) {
        setHtml(v.html);
        setTitle(v.title || "");
        setChat(v.chat || []);
        if (typeof v.maxCharacters === "string") setMaxCharacters(v.maxCharacters);
        if (v.prompt === prompt) started.current = true;
      }
    } catch (error) {
      console.error("Vala builder persistence failed", error);
      toast.error("Saved website could not be restored.");
    }
    setLoaded(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loaded && html)
      try {
        localStorage.setItem(KEY, JSON.stringify({ html, title, chat, prompt, maxCharacters }));
      } catch (error) {
        console.error("Vala builder persistence failed", error);
        toast.error("Website could not be saved in this browser.");
      }
  }, [KEY, loaded, html, title, chat, prompt, maxCharacters]);
  const run = async (request: string, fresh = false) => {
    if (!request.trim() || busy) return;
    const maximum = maxCharacters.trim() ? Number(maxCharacters) : undefined;
    if (
      maximum !== undefined &&
      (!Number.isInteger(maximum) || maximum < 1 || maximum > MAX_SITE_HTML_CHARACTERS)
    ) {
      toast.error(`HTML character limit must be between 1 and ${MAX_SITE_HTML_CHARACTERS}.`);
      return;
    }
    setBusy(true);
    setMsg("");
    setChat((c) => [...c, { me: true, text: request }]);
    try {
      const out = await gen({
        data: {
          request,
          ...(maximum !== undefined ? { maxCharacters: maximum } : {}),
          ...(layout ? { pageType: layout } : {}),
          ...(html && !fresh ? { previousHtml: html } : {}),
        },
      });
      if (!out?.html)
        throw new Error("Website generation returned no HTML. Check the model and retry.");
      setHtml(out.html);
      if (out.title) setTitle(out.title);
      setChat((c) => [
        ...c,
        { me: false, text: out.warning ? `${out.reply}\n\n${out.warning}` : out.reply },
      ]);
      if (out.warning) toast.warning(out.warning);
    } catch (e) {
      setChat((c) => [...c, { me: false, text: e instanceof Error ? e.message : "Build failed." }]);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (loaded && prompt && !started.current) {
      started.current = true;
      void run(prompt);
    }
  }, [prompt, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const sections = (() => {
    if (!html || typeof DOMParser === "undefined") return [] as { tag: string; text: string }[];
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("h1, h2, h3")]
      .map((h) => ({
        tag: h.tagName.toLowerCase(),
        text: (h.textContent || "").trim().slice(0, 120),
      }))
      .filter((x) => x.text);
  })();
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([withTheme(html, applied)], { type: "text/html" }));
    a.download = `${(title || "website").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const initial = THEMES.some((t) => t.id === theme) ? theme! : "summer";
  const [applied, setApplied] = useState(initial);
  const [draft, setDraft] = useState(initial);

  return (
    <div className="theme-builder flex min-h-[calc(100vh-44px)] flex-col bg-background text-foreground">
      <div className="studio-builder flex min-h-0 flex-1">
        {/* Chat column */}
        <aside className="flex w-[420px] shrink-0 flex-col border-r border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div>
              <div className="text-sm font-semibold">
                {title || prompt || "Design a landing page for my animal clinic"}
              </div>
              <div className="text-xs text-muted-foreground">
                Vala AI · {busy ? "Building…" : "Ready"}
              </div>
            </div>
            <div className="flex gap-3 text-studio-dim">
              <Bell className="size-4" />
              <Link to="/vala-ai" aria-label="Home">
                <Home className="size-4" />
              </Link>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {chat.length > 0 ? (
              <div className="space-y-3 text-sm">
                {chat.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.me
                        ? "ml-auto w-fit max-w-[85%] rounded-xl bg-secondary px-3 py-2"
                        : "rounded-xl border border-border bg-card p-3 text-studio-dim shadow-sm"
                    }
                  >
                    {m.text}
                  </div>
                ))}
                {busy && (
                  <div className="rounded-xl border border-border bg-card p-3 text-studio-dim shadow-sm">
                    Vala AI is building your website…
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-studio-dim shadow-sm">
                Describe your website. Vala AI uses your existing model settings; generated code is
                previewed in an isolated frame.
              </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto px-4 pb-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => void run(s)}
                className="bg-ink shrink-0 rounded-full px-3 py-1 text-xs"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="border-t border-border px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <InfinityIcon className="size-3.5" /> Configured Vala model
              </span>
              <Moon className="size-4 text-studio-dim" />
            </div>
            <div className="rounded-xl border border-border bg-card">
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void run(msg);
                  }
                }}
                placeholder="Describe what you want to build..."
                rows={2}
                className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  <kbd className="rounded border border-border px-1 font-mono text-[10px]">
                    Enter
                  </kbd>{" "}
                  to send
                </span>
                <button
                  disabled={!msg.trim() || busy}
                  onClick={() => void run(msg)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:bg-muted-foreground"
                >
                  <Send className="size-4" /> Send
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Preview column */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2">
            <nav className="flex rounded-lg border border-border p-0.5">
              {TABS.map(({ label, icon: I }) => (
                <button
                  key={label}
                  onClick={() => setTab(label)}
                  className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm ${tab === label ? "bg-ink font-semibold" : "text-studio-dim"}`}
                >
                  <I className="size-4" /> {label}
                </button>
              ))}
            </nav>
            <div className="flex gap-2">
              {[
                { l: "Rebuild", i: Hammer },
                { l: "Open", i: ExternalLink },
                { l: "Download", i: Globe },
              ].map(({ l, i: I }) => (
                <button
                  key={l}
                  onClick={() => {
                    if (l === "Rebuild")
                      void run(
                        prompt ||
                          chat.find((c) => c.me)?.text ||
                          "Design a landing page for my animal clinic",
                        true,
                      );
                    if (l === "Open" && html) setTab("Preview");
                    if (l === "Download" && html) download();
                  }}
                  disabled={busy || (l !== "Rebuild" && !html)}
                  title={l === "Download" ? "Download the finished website file" : undefined}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium"
                >
                  <I className="size-4" /> {l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "Preview" ? (
              html ? (
                <SiteFrame html={html} theme={applied} />
              ) : (
                <div>
                  <p className="border-b border-border bg-card p-3 text-xs text-studio-dim">
                    Design template preview — not generated client software.
                  </p>
                  <ClinicPreview theme={applied} />
                </div>
              )
            ) : tab === "Code" ? (
              <pre className="h-full overflow-auto bg-secondary p-4 font-mono text-xs">
                {html
                  ? withTheme(html, applied)
                  : "No website generated yet — send a message or press Rebuild."}
              </pre>
            ) : tab === "Design" ? (
              <div className="flex h-full">
                <div className="flex w-80 shrink-0 flex-col border-r border-border bg-card">
                  <div className="border-b border-border p-4">
                    <h2 className="text-lg font-semibold">Choose a Theme</h2>
                    <p className="mt-1 text-sm text-studio-dim">
                      Select a color theme. Changes are previewed in real-time.
                    </p>
                  </div>
                  <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setDraft(t.id)}
                        className={`site-${t.id} flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left ${draft === t.id ? "border-foreground/30 bg-secondary" : "border-border"}`}
                      >
                        <span className="flex gap-1">
                          <i className="size-5 rounded-full bg-primary" />
                          <i className="size-5 rounded-full border border-border bg-card" />
                          <i className="size-5 rounded-full bg-primary/40" />
                        </span>
                        <span>
                          <span className="block font-medium">{t.name}</span>
                          <span className="text-xs text-studio-dim">{t.note}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-border p-4">
                    <span className="text-sm text-studio-dim">
                      {draft !== applied ? "Unsaved changes" : "Saved"}
                    </span>
                    <button
                      disabled={draft === applied}
                      onClick={() => setApplied(draft)}
                      className="bg-ink rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
                    >
                      Apply
                    </button>
                  </div>
                </div>
                <div className="min-w-0 flex-1 overflow-y-auto">
                  {html ? (
                    <SiteFrame html={html} theme={draft} />
                  ) : (
                    <div>
                      <p className="p-3 text-xs text-studio-dim">Theme template preview.</p>
                      <ClinicPreview theme={draft} />
                    </div>
                  )}
                </div>
              </div>
            ) : tab === "Inspect" ? (
              <div className="mx-auto max-w-3xl p-6">
                <h2 className="text-lg font-semibold">Inspect</h2>
                <p className="mt-1 text-sm text-studio-dim">
                  Every section of your website. Pick one to change it from chat.
                </p>
                {!html && (
                  <p className="mt-6 text-sm text-studio-dim">
                    No website generated yet — send a message first.
                  </p>
                )}
                <div className="mt-4 space-y-2">
                  {sections.map((sec, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
                    >
                      <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase text-studio-dim">
                        {sec.tag}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{sec.text}</span>
                      <button
                        onClick={() => {
                          setMsg(
                            `In the "${sec.text}" ${sec.tag === "h1" ? "headline" : "section"}: `,
                          );
                          setTab("Preview");
                        }}
                        className="rounded-md border border-border px-3 py-1 text-xs"
                      >
                        Edit in chat
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-xl space-y-5 p-6">
                <h2 className="text-lg font-semibold">Settings</h2>
                <label className="block text-sm">
                  <span className="text-studio-dim">Website name</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 outline-none focus:border-primary"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-studio-dim">Maximum HTML characters (optional)</span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_SITE_HTML_CHARACTERS}
                    step={1}
                    value={maxCharacters}
                    onChange={(e) => setMaxCharacters(e.target.value)}
                    placeholder="For example, 900"
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 outline-none focus:border-primary"
                  />
                  <span className="mt-2 block text-xs text-studio-dim">
                    Counts markup and whitespace before theme CSS. If exceeded, Vala warns without
                    truncating your website. Explicit HTML limits in your prompt also apply.
                  </span>
                </label>
                <div className="rounded-lg border border-border bg-card p-4 text-sm">
                  <div className="font-medium">Theme</div>
                  <div className="mt-1 text-studio-dim">
                    {THEMES.find((t) => t.id === applied)?.name} — change it in the Design tab.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={!html}
                    onClick={download}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
                  >
                    Download website
                  </button>
                  <button
                    disabled={!html || busy}
                    onClick={() => {
                      if (confirm("Delete this website and chat?")) {
                        setHtml("");
                        setChat([]);
                        setTitle("");
                        try {
                          localStorage.removeItem(KEY);
                        } catch (error) {
                          console.error("Vala builder persistence failed", error);
                        }
                      }
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-destructive disabled:opacity-40"
                  >
                    Start over
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SiteFrame({ html, theme }: { html: string; theme: string }) {
  return (
    <iframe
      title="Website preview"
      sandbox="allow-scripts"
      srcDoc={withTheme(html, theme)}
      className="h-full w-full border-0 bg-card"
    />
  );
}

const THEMES = [
  { id: "default", name: "Default", note: "Neutral, clean" },
  { id: "arctic", name: "Arctic", note: "Cool, tech-focused" },
  { id: "summer", name: "Summer", note: "Warm, energetic" },
  { id: "fragrant", name: "Fragrant", note: "Elegant, creative" },
  { id: "slate", name: "Slate", note: "Minimal, professional" },
  { id: "feminine", name: "Feminine", note: "Soft, playful" },
  { id: "forest", name: "Forest", note: "Natural, earthy" },
  { id: "midnight", name: "Midnight", note: "Dark, mysterious" },
];

function ClinicPreview({ theme }: { theme: string }) {
  const cards = [
    {
      icon: Heart,
      c: "text-rose",
      t: "Compassionate Care",
      d: "We treat every pet like family. Our gentle approach ensures your furry friends feel safe and comfortable.",
    },
    {
      icon: Stethoscope,
      c: "text-sky",
      t: "Expert Veterinary Team",
      d: "Our experienced veterinarians are trained in the latest medical techniques to provide the best care possible.",
    },
    {
      icon: ShieldCheck,
      c: "text-emerald",
      t: "State-of-the-Art Facility",
      d: "Modern equipment and clean facilities designed for accurate diagnosis and effective treatment.",
    },
  ];
  return (
    <div className={`site-preview site-${theme}`}>
      <section className="bg-hero-wash px-8 pb-24 pt-20 text-center">
        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight">
          Compassionate Care for Your Furry Friends
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-studio-dim">
          Your trusted partner in pet health. We provide exceptional veterinary care with love and
          dedication to keep your companions happy and healthy.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <button className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground">
            Book an Appointment
          </button>
          <button className="rounded-lg border border-border bg-card px-8 py-3 text-sm font-semibold">
            Our Services
          </button>
        </div>
      </section>
      <section className="px-4 py-16 text-center">
        <h2 className="text-3xl font-bold">Why Choose Our Clinic</h2>
        <p className="mt-3 text-studio-dim">Expert care when your pets need it most</p>
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {cards.map(({ icon: I, c, t, d }) => (
            <div key={t} className="rounded-xl border border-border bg-card p-6">
              <I className={`mx-auto size-7 ${c}`} />
              <h3 className="mt-4 text-2xl font-semibold">{t}</h3>
              <p className="mt-4 text-studio-dim">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
