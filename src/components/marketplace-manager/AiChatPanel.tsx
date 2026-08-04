import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@/lib/marketplace-manager/localFn";
import {
  Bot,
  Send,
  Sparkles,
  Trash2,
  X,
  User2,
  AlertTriangle,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Download,
  FileJson,
  FileText,
  Search,
  Calendar,
  MessageSquare,
  History,
  Copy,
  Check,
  Settings2,
  Filter,
  ArrowDownAZ,
  Eye,
  ClipboardList,
  ShieldAlert,
  Keyboard,
  Gauge,
  FileSpreadsheet,
} from "lucide-react";
import { chatWithAi, type ChatMessage } from "@/lib/marketplace-manager/chat-ai.functions";

const STORAGE_KEY = "vala-ai-chat-history-v3";
const LEGACY_STORAGE_KEY = "vala-ai-chat-history-v2";
const PREFS_KEY = "vala-ai-feedback-preferences";
const AUDIT_KEY = "vala-ai-audit-log";

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type Reaction = "up" | "down" | null;
type StoredMessage = ChatMessage & { id: string; ts: number; reaction?: Reaction };
type Prefs = { learnFromFeedback: boolean };
type AuditAction =
  | "feedback_set"
  | "feedback_cleared"
  | "feedback_bulk_reset"
  | "export_json"
  | "export_pdf"
  | "toggle_learn"
  | "storage_recovered";
type AuditEvent = { id: string; ts: number; action: AuditAction; detail?: string };
type RatingFilter = "all" | "up" | "down";
type DatePreset = "all" | "today" | "7d" | "30d" | "month" | "custom";
type SortMode = "newest" | "oldest" | "up_first" | "down_first";
type ExportScope = "chat" | "feedback";
type ExportFormat = "json" | "pdf";
type ExportPreview = { scope: ExportScope; format: ExportFormat } | null;

const DEFAULT_SUGGESTIONS = [
  "What can I manage from this panel?",
  "How do I add a Hero Banner campaign?",
  "Checklist before publishing the homepage",
  "Best practice for SEO meta + hashtags",
  "How to A/B test a Wall layout",
  "Where do I approve vendor submissions?",
];

// ---------- Safe storage helpers ----------
function quarantine(key: string, raw: string | null) {
  if (typeof window === "undefined" || raw == null) return;
  try {
    localStorage.setItem(`${key}.corrupt.${Date.now()}`, raw);
    localStorage.removeItem(key);
  } catch {}
}

function safeRead<T>(key: string, validate: (v: unknown) => v is T, fallback: T): {
  value: T;
  recovered: boolean;
} {
  if (typeof window === "undefined") return { value: fallback, recovered: false };
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
    if (raw == null) return { value: fallback, recovered: false };
    const parsed: unknown = JSON.parse(raw);
    if (!validate(parsed)) throw new Error("schema mismatch");
    return { value: parsed, recovered: false };
  } catch {
    quarantine(key, raw);
    return { value: fallback, recovered: true };
  }
}

const isMessageArray = (v: unknown): v is StoredMessage[] =>
  Array.isArray(v) &&
  v.every(
    (m) =>
      m &&
      typeof m === "object" &&
      typeof (m as StoredMessage).role === "string" &&
      typeof (m as StoredMessage).content === "string" &&
      typeof (m as StoredMessage).ts === "number",
  );

const isPrefs = (v: unknown): v is Prefs =>
  !!v && typeof v === "object" && typeof (v as Prefs).learnFromFeedback === "boolean";

const isAuditArray = (v: unknown): v is AuditEvent[] =>
  Array.isArray(v) &&
  v.every(
    (a) =>
      a &&
      typeof a === "object" &&
      typeof (a as AuditEvent).id === "string" &&
      typeof (a as AuditEvent).ts === "number" &&
      typeof (a as AuditEvent).action === "string",
  );

function logAudit(action: AuditAction, detail?: string) {
  if (typeof window === "undefined") return;
  try {
    const { value } = safeRead<AuditEvent[]>(AUDIT_KEY, isAuditArray, []);
    value.push({ id: generateId(), ts: Date.now(), action, detail });
    localStorage.setItem(AUDIT_KEY, JSON.stringify(value.slice(-500)));
  } catch {}
}

// ---------- Virtualization ----------
const FB_ROW_EST = 220;
const FB_OVERSCAN = 6;

export function AiChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const callChat = useServerFn(chatWithAi);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({ learnFromFeedback: false });
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [recoveryNotice, setRecoveryNotice] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExportPreview>(null);

  // Feedback filters
  const [fbRating, setFbRating] = useState<RatingFilter>("all");
  const [fbDatePreset, setFbDatePreset] = useState<DatePreset>("all");
  const [fbFrom, setFbFrom] = useState("");
  const [fbTo, setFbTo] = useState("");
  const [fbQuery, setFbQuery] = useState("");
  const [fbSort, setFbSort] = useState<SortMode>("newest");

  // Audit filters
  const [auQuery, setAuQuery] = useState("");
  const [auAction, setAuAction] = useState<"all" | AuditAction>("all");
  const [auPreset, setAuPreset] = useState<DatePreset>("all");
  const [auFrom, setAuFrom] = useState("");
  const [auTo, setAuTo] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fbScrollRef = useRef<HTMLDivElement>(null);
  const fbSearchRef = useRef<HTMLInputElement>(null);
  const auSearchRef = useRef<HTMLInputElement>(null);
  const [fbScrollTop, setFbScrollTop] = useState(0);
  const [fbViewportH, setFbViewportH] = useState(600);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const recovered: string[] = [];
    // Messages: try v3, else migrate legacy
    const msgResult = safeRead<StoredMessage[]>(STORAGE_KEY, isMessageArray, []);
    if (msgResult.recovered) recovered.push("chat history");
    let msgs = msgResult.value;
    if (msgs.length === 0) {
      try {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const parsed: unknown = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            msgs = (parsed as Omit<StoredMessage, "id">[]).map((m) => ({
              ...m,
              id: generateId(),
              ts: typeof m.ts === "number" ? m.ts : Date.now(),
            }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
          }
        }
      } catch {}
    }
    // Ensure IDs on any older rows
    msgs = msgs.map((m) => (m.id ? m : { ...m, id: generateId() }));
    setMessages(msgs);

    const prefsResult = safeRead<Prefs>(PREFS_KEY, isPrefs, { learnFromFeedback: false });
    if (prefsResult.recovered) recovered.push("feedback preferences");
    setPrefs(prefsResult.value);

    const auditResult = safeRead<AuditEvent[]>(AUDIT_KEY, isAuditArray, []);
    if (auditResult.recovered) recovered.push("audit log");
    setAuditLog(auditResult.value);

    if (recovered.length) {
      setRecoveryNotice(recovered);
      logAudit("storage_recovered", recovered.join(", "));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showShortcuts) setShowShortcuts(false);
        else if (preview) setPreview(null);
        else if (confirmReset) setConfirmReset(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, preview, confirmReset, showShortcuts]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Refresh audit log when opened
  useEffect(() => {
    if (!showAudit) return;
    const { value } = safeRead<AuditEvent[]>(AUDIT_KEY, isAuditArray, []);
    setAuditLog(value);
  }, [showAudit]);

  const refreshAudit = () => {
    const { value } = safeRead<AuditEvent[]>(AUDIT_KEY, isAuditArray, []);
    setAuditLog(value);
  };

  // Chat search
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo).getTime() + 86_400_000 : Infinity;
    if (!q && !dateFrom && !dateTo) return messages;
    return messages.filter(
      (m) => (!q || m.content.toLowerCase().includes(q)) && m.ts >= from && m.ts <= to,
    );
  }, [messages, query, dateFrom, dateTo]);

  const ratedMessages = useMemo(
    () => messages.filter((m) => m.role === "assistant" && m.reaction),
    [messages],
  );

  // Index of message id -> preceding user prompt (memoized to keep feedback view fast on big datasets)
  const promptByAssistantId = useMemo(() => {
    const map = new Map<string, string>();
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === "assistant") {
        const prev = messages[i - 1];
        map.set(m.id, prev?.role === "user" ? prev.content : "");
      }
    }
    return map;
  }, [messages]);

  const promptScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) {
      if (m.role !== "assistant" || !m.reaction) continue;
      const p = promptByAssistantId.get(m.id);
      if (!p) continue;
      const key = p.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + (m.reaction === "up" ? 1 : -1));
    }
    return map;
  }, [messages, promptByAssistantId]);

  const orderedSuggestions = useMemo(() => {
    if (!prefs.learnFromFeedback) return DEFAULT_SUGGESTIONS;
    return [...DEFAULT_SUGGESTIONS].sort(
      (a, b) =>
        (promptScores.get(b.toLowerCase()) ?? 0) - (promptScores.get(a.toLowerCase()) ?? 0),
    );
  }, [prefs.learnFromFeedback, promptScores]);

  function rangeForPreset(preset: DatePreset, from: string, to: string): [number, number] {
    const now = new Date();
    if (preset === "today") {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return [d.getTime(), Infinity];
    }
    if (preset === "7d") return [now.getTime() - 7 * 86_400_000, Infinity];
    if (preset === "30d") return [now.getTime() - 30 * 86_400_000, Infinity];
    if (preset === "month") return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), Infinity];
    if (preset === "custom") {
      return [from ? new Date(from).getTime() : 0, to ? new Date(to).getTime() + 86_400_000 : Infinity];
    }
    return [0, Infinity];
  }

  const { view: feedbackView, ms: feedbackFilterMs } = useMemo(() => {
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    const [from, to] = rangeForPreset(fbDatePreset, fbFrom, fbTo);
    const q = fbQuery.trim().toLowerCase();
    const items = ratedMessages
      .map((m) => ({ msg: m, prompt: promptByAssistantId.get(m.id) ?? "" }))
      .filter(({ msg, prompt }) => {
        if (fbRating !== "all" && msg.reaction !== fbRating) return false;
        if (msg.ts < from || msg.ts > to) return false;
        if (q) {
          const hay = `${prompt}\n${msg.content}\n${msg.id}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    items.sort((a, b) => {
      if (fbSort === "newest") return b.msg.ts - a.msg.ts;
      if (fbSort === "oldest") return a.msg.ts - b.msg.ts;
      const av = a.msg.reaction === "up" ? 1 : -1;
      const bv = b.msg.reaction === "up" ? 1 : -1;
      return fbSort === "up_first" ? bv - av : av - bv;
    });
    const t1 = typeof performance !== "undefined" ? performance.now() : 0;
    return { view: items, ms: t1 - t0 };
  }, [ratedMessages, promptByAssistantId, fbRating, fbDatePreset, fbFrom, fbTo, fbQuery, fbSort]);

  // Windowed slice
  const fbWindow = useMemo(() => {
    const total = feedbackView.length;
    const totalH = total * FB_ROW_EST;
    const start = Math.max(0, Math.floor(fbScrollTop / FB_ROW_EST) - FB_OVERSCAN);
    const end = Math.min(total, Math.ceil((fbScrollTop + fbViewportH) / FB_ROW_EST) + FB_OVERSCAN);
    return { start, end, totalH, items: feedbackView.slice(start, end) };
  }, [feedbackView, fbScrollTop, fbViewportH]);

  useEffect(() => {
    const el = fbScrollRef.current;
    if (!el) return;
    setFbViewportH(el.clientHeight);
  }, [showFeedback]);

  const auditView = useMemo(() => {
    const [from, to] = rangeForPreset(auPreset, auFrom, auTo);
    const q = auQuery.trim().toLowerCase();
    return auditLog
      .filter((a) => {
        if (auAction !== "all" && a.action !== auAction) return false;
        if (a.ts < from || a.ts > to) return false;
        if (q) {
          const hay = `${a.action}\n${a.detail ?? ""}\n${a.id}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => b.ts - a.ts);
  }, [auditLog, auAction, auPreset, auFrom, auTo, auQuery]);

  function doExportAuditJSON() {
    const blob = new Blob([JSON.stringify(auditView, null, 2)], { type: "application/json" });
    triggerDownload(blob, `vala-audit-${today()}.json`);
    logAudit("export_json", `audit:${auditView.length}`);
    setToast(`Exported ${auditView.length} audit event${auditView.length === 1 ? "" : "s"} (JSON)`);
  }

  function doExportAuditCSV() {
    const header = ["id", "timestamp", "action", "detail"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = auditView.map((a) =>
      [a.id, new Date(a.ts).toISOString(), a.action, a.detail ?? ""].map(escape).join(","),
    );
    const csv = [header.map(escape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `vala-audit-${today()}.csv`);
    logAudit("export_json", `audit-csv:${auditView.length}`);
    setToast(`Exported ${auditView.length} audit event${auditView.length === 1 ? "" : "s"} (CSV)`);
  }

  // Keyboard shortcuts for Feedback History & Audit Log
  useEffect(() => {
    if (!open) return;
    const isTyping = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const t = el.tagName;
      return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (preview && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        confirmExport();
        return;
      }
      if (isTyping(e.target)) return;
      if (e.key === "?" && e.shiftKey) { e.preventDefault(); setShowShortcuts((s) => !s); return; }
      if (showFeedback) {
        if (e.key === "/") { e.preventDefault(); fbSearchRef.current?.focus(); return; }
        if (e.key === "1") { setFbRating("all"); return; }
        if (e.key === "2") { setFbRating("up"); return; }
        if (e.key === "3") { setFbRating("down"); return; }
        if (e.key.toLowerCase() === "e") { setShowExport(true); return; }
      }
      if (showAudit) {
        if (e.key === "/") { e.preventDefault(); auSearchRef.current?.focus(); return; }
        if (e.key === "1") { setAuAction("all"); return; }
        if (e.key === "2") { setAuAction("feedback_set"); return; }
        if (e.key === "3") { setAuAction("feedback_cleared"); return; }
        if (e.key.toLowerCase() === "j") { doExportAuditJSON(); return; }
        if (e.key.toLowerCase() === "c") { doExportAuditCSV(); return; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preview, showFeedback, showAudit, auditView, messages, feedbackView]);


  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    const next: StoredMessage[] = [
      ...messages,
      { id: generateId(), role: "user", content, ts: Date.now() },
    ];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const out = await callChat({
        data: { messages: next.map(({ role, content }) => ({ role, content })) },
      });
      if (out.error) {
        setError(out.error);
      } else {
        setMessages([
          ...next,
          { id: generateId(), role: "assistant", content: out.reply, ts: Date.now(), reaction: null },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reach AI");
    } finally {
      setLoading(false);
    }
  }

  function setReaction(id: string, reaction: Reaction) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = m.reaction === reaction ? null : reaction;
        logAudit(next ? "feedback_set" : "feedback_cleared", `${id}:${next ?? "none"}`);
        return { ...m, reaction: next };
      }),
    );
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    });
  }

  // ---------- Preview-first exports ----------
  function feedbackRecords() {
    return feedbackView.map(({ msg, prompt }) => ({
      messageId: msg.id,
      conversationId: STORAGE_KEY,
      prompt,
      response: msg.content,
      rating: msg.reaction,
      comment: "",
      timestamp: new Date(msg.ts).toISOString(),
    }));
  }

  function chatRecords() {
    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      reaction: m.reaction ?? null,
      timestamp: new Date(m.ts).toISOString(),
    }));
  }

  function requestExport(scope: ExportScope, format: ExportFormat) {
    setShowExport(false);
    setPreview({ scope, format });
  }

  function confirmExport() {
    if (!preview) return;
    const { scope, format } = preview;
    if (scope === "chat" && format === "json") doExportChatJSON();
    else if (scope === "chat" && format === "pdf") doExportChatPDF();
    else if (scope === "feedback" && format === "json") doExportFeedbackJSON();
    else if (scope === "feedback" && format === "pdf") doExportFeedbackPDF();
    setPreview(null);
  }

  function doExportChatJSON() {
    const blob = new Blob([JSON.stringify(chatRecords(), null, 2)], { type: "application/json" });
    triggerDownload(blob, `vala-chat-${today()}.json`);
    logAudit("export_json", `chat:${messages.length}`);
    setToast(`Exported ${messages.length} messages (JSON)`);
  }

  function doExportChatPDF() {
    const rows = messages
      .map((m) => {
        const when = new Date(m.ts).toLocaleString();
        const who = m.role === "user" ? "You" : "Vala AI";
        const reaction = m.reaction === "up" ? " 👍" : m.reaction === "down" ? " 👎" : "";
        return `<div class="msg ${m.role}"><div class="meta">${who} · ${when}${reaction}</div><div class="body">${escapeHtml(m.content)}</div></div>`;
      })
      .join("");
    openPrintable(
      "Vala AI — Chat Export",
      `${messages.length} messages`,
      `<style>
        body{font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;padding:32px;max-width:780px;margin:auto}
        .msg{padding:10px 14px;border-radius:10px;margin:8px 0;page-break-inside:avoid}
        .msg.user{background:#eef4ff}.msg.assistant{background:#f6f6f6}
        .meta{font-size:11px;color:#666;margin-bottom:4px;font-weight:600}.body{white-space:pre-wrap}
      </style>${rows || "<p>No messages.</p>"}`,
    );
    logAudit("export_pdf", `chat:${messages.length}`);
  }

  function doExportFeedbackJSON() {
    const data = feedbackRecords();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    triggerDownload(blob, `vala-ai-feedback-${today()}.json`);
    logAudit("export_json", `feedback:${data.length}`);
    setToast(`Exported ${data.length} feedback records (JSON)`);
  }

  function doExportFeedbackPDF() {
    const data = feedbackRecords();
    const rows = data
      .map(
        (r, i) => `<tr>
          <td>${i + 1}</td>
          <td><code>${escapeHtml(r.messageId)}</code></td>
          <td>${r.rating === "up" ? "👍 Positive" : "👎 Negative"}</td>
          <td>${escapeHtml(new Date(r.timestamp).toLocaleString())}</td>
          <td>${escapeHtml(r.prompt)}</td>
          <td>${escapeHtml(r.response)}</td>
        </tr>`,
      )
      .join("");
    openPrintable(
      "Vala AI — Feedback Report",
      `${data.length} feedback records`,
      `<style>
        @page{size:A4;margin:18mm}
        body{font:12px/1.45 -apple-system,Segoe UI,sans-serif;color:#111}
        table{width:100%;border-collapse:collapse;table-layout:fixed}
        th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere}
        th{background:#f2f4f8;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
        code{font:11px ui-monospace,Menlo,monospace}
      </style>
      <table>
        <colgroup><col style="width:4%"><col style="width:14%"><col style="width:10%"><col style="width:14%"><col style="width:29%"><col style="width:29%"></colgroup>
        <thead><tr><th>#</th><th>Message ID</th><th>Rating</th><th>Timestamp</th><th>Prompt</th><th>Response</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#888">No feedback records</td></tr>`}</tbody>
      </table>`,
    );
    logAudit("export_pdf", `feedback:${data.length}`);
  }

  function bulkResetFeedback() {
    const count = ratedMessages.length;
    setMessages((prev) => prev.map((m) => (m.reaction ? { ...m, reaction: null } : m)));
    logAudit("feedback_bulk_reset", `count:${count}`);
    setConfirmReset(false);
    setToast(`Cleared ${count} feedback record${count === 1 ? "" : "s"}`);
  }

  function toggleLearn(v: boolean) {
    setPrefs((p) => ({ ...p, learnFromFeedback: v }));
    logAudit("toggle_learn", v ? "on" : "off");
  }

  if (!open) return null;

  const previewData =
    preview?.scope === "feedback"
      ? feedbackRecords()
      : preview?.scope === "chat"
        ? chatRecords()
        : [];

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm" />
      <aside
        role="dialog"
        aria-label="Vala AI Chat"
        className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-border bg-[oklch(0.16_0.03_240/0.95)] shadow-[0_0_60px_-10px_oklch(0.80_0.13_192/0.35)] backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent ring-1 ring-white/10">
              <Bot className="h-4.5 w-4.5 text-white" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_currentColor]" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                Vala AI
              </div>
              <div className="text-sm font-bold text-foreground">Marketplace Assistant</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn
              title="Feedback history"
              active={showFeedback}
              onClick={() => {
                setShowFeedback((s) => !s);
                setShowSearch(false);
                setShowExport(false);
                setShowSettings(false);
                setShowAudit(false);
              }}
            >
              <History className="h-3.5 w-3.5" />
              {ratedMessages.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground">
                  {ratedMessages.length}
                </span>
              )}
            </IconBtn>
            <IconBtn
              title="Audit log"
              active={showAudit}
              onClick={() => {
                setShowAudit((s) => !s);
                setShowFeedback(false);
                setShowSearch(false);
                setShowExport(false);
                setShowSettings(false);
                refreshAudit();
              }}
            >
              <ClipboardList className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn
              title="Search"
              active={showSearch}
              onClick={() => {
                setShowSearch((s) => !s);
                setShowFeedback(false);
                setShowExport(false);
                setShowSettings(false);
                setShowAudit(false);
              }}
            >
              <Search className="h-3.5 w-3.5" />
            </IconBtn>
            <div className="relative">
              <IconBtn
                title="Export"
                active={showExport}
                onClick={() => {
                  setShowExport((s) => !s);
                  setShowSearch(false);
                  setShowFeedback(false);
                  setShowSettings(false);
                  setShowAudit(false);
                }}
              >
                <Download className="h-3.5 w-3.5" />
              </IconBtn>
              {showExport && (
                <div className="absolute right-0 top-full z-10 mt-1 w-60 overflow-hidden rounded-xl border border-border bg-[oklch(0.18_0.03_240)] shadow-xl">
                  <div className="border-b border-border bg-white/[0.03] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Chat · preview before download
                  </div>
                  <button
                    onClick={() => requestExport("chat", "json")}
                    disabled={!messages.length}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    <FileJson className="h-3.5 w-3.5 text-accent" /> Preview & export chat JSON
                  </button>
                  <button
                    onClick={() => requestExport("chat", "pdf")}
                    disabled={!messages.length}
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-foreground hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    <FileText className="h-3.5 w-3.5 text-accent" /> Preview & export chat PDF
                  </button>
                  <div className="border-y border-border bg-white/[0.03] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Feedback only · uses current filters
                  </div>
                  <button
                    onClick={() => requestExport("feedback", "json")}
                    disabled={!ratedMessages.length}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    <FileJson className="h-3.5 w-3.5 text-accent" /> Preview & export feedback JSON
                  </button>
                  <button
                    onClick={() => requestExport("feedback", "pdf")}
                    disabled={!ratedMessages.length}
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-foreground hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    <FileText className="h-3.5 w-3.5 text-accent" /> Preview & export feedback PDF
                  </button>
                </div>
              )}
            </div>
            <IconBtn
              title="Settings"
              active={showSettings}
              onClick={() => {
                setShowSettings((s) => !s);
                setShowSearch(false);
                setShowFeedback(false);
                setShowExport(false);
                setShowAudit(false);
              }}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn
              title="Clear chat"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Close" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </div>

        {/* Recovery notice */}
        {recoveryNotice.length > 0 && (
          <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="flex-1">
              Recovered from corrupted <span className="font-semibold">{recoveryNotice.join(", ")}</span>.
              A backup was kept under <code className="font-mono">*.corrupt.*</code> keys.
            </div>
            <button
              onClick={() => setRecoveryNotice([])}
              className="text-amber-200/70 hover:text-amber-100"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Settings */}
        {showSettings && (
          <div className="space-y-3 border-b border-border bg-white/[0.02] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-foreground">
                  Use my feedback to improve future AI suggestions
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  Reorders suggestion prompts using your 👍 / 👎 history.{" "}
                  <span className={prefs.learnFromFeedback ? "text-emerald-400" : "text-muted-foreground"}>
                    {prefs.learnFromFeedback ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => toggleLearn(!prefs.learnFromFeedback)}
                role="switch"
                aria-checked={prefs.learnFromFeedback}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  prefs.learnFromFeedback ? "bg-emerald-500/70" : "bg-white/[0.08]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                    prefs.learnFromFeedback ? "left-4" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-foreground">Clear all AI feedback</div>
                <div className="text-[10px] text-muted-foreground">
                  Removes {ratedMessages.length} thumbs reaction
                  {ratedMessages.length === 1 ? "" : "s"}. Chats & prompts are kept.
                </div>
              </div>
              <button
                onClick={() => setConfirmReset(true)}
                disabled={!ratedMessages.length}
                className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Chat search */}
        {showSearch && (
          <div className="space-y-2 border-b border-border bg-white/[0.02] px-3 py-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-white/[0.04] px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages…"
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-[10px] text-muted-foreground hover:text-foreground">
                  clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="flex-1 rounded-lg border border-border bg-white/[0.04] px-2 py-1 text-[11px] text-foreground focus:outline-none" />
              <span className="text-[10px] text-muted-foreground">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="flex-1 rounded-lg border border-border bg-white/[0.04] px-2 py-1 text-[11px] text-foreground focus:outline-none" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{filtered.length} of {messages.length} match</span>
              {(query || dateFrom || dateTo) && (
                <button onClick={() => { setQuery(""); setDateFrom(""); setDateTo(""); }} className="text-accent hover:underline">
                  Reset filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Feedback (virtualized) */}
        {showFeedback && (
          <div
            role="region"
            aria-labelledby="feedback-history-heading"
            className="flex flex-1 min-h-0 flex-col border-b border-border bg-white/[0.02]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <div
                id="feedback-history-heading"
                className="flex items-center gap-2 text-xs font-semibold text-foreground"
              >
                <History className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Feedback History
                <span
                  className="rounded-full bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                  aria-label={`${feedbackView.length} of ${ratedMessages.length} feedback records match filters`}
                >
                  {feedbackView.length}/{ratedMessages.length}
                </span>
              </div>
              <div
                className="flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] text-muted-foreground"
                role="status"
                aria-live="polite"
                aria-label={`Performance: filtered in ${feedbackFilterMs.toFixed(1)} milliseconds, rendering ${fbWindow.items.length} of ${feedbackView.length} rows`}
                title="Filter time · window size · filter count"
              >
                <Gauge className="h-3 w-3 text-accent" aria-hidden="true" />
                <span>{feedbackFilterMs.toFixed(1)}ms</span>
                <span aria-hidden="true">·</span>
                <span>win {fbWindow.items.length}</span>
                <span aria-hidden="true">·</span>
                <span>{feedbackView.length} rows</span>
              </div>
              <button
                onClick={() => setShowFeedback(false)}
                className="text-[10px] text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded"
                aria-label="Close feedback history"
              >
                Close
              </button>
            </div>


            <div className="space-y-2 border-b border-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Filter className="h-3 w-3 text-muted-foreground" />
                {(["all", "up", "down"] as RatingFilter[]).map((r) => (
                  <Chip key={r} active={fbRating === r} onClick={() => setFbRating(r)}>
                    {r === "all" ? "All" : r === "up" ? "👍 Positive" : "👎 Negative"}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {(
                  [
                    ["all", "All time"],
                    ["today", "Today"],
                    ["7d", "7d"],
                    ["30d", "30d"],
                    ["month", "This month"],
                    ["custom", "Custom"],
                  ] as [DatePreset, string][]
                ).map(([k, l]) => (
                  <Chip key={k} active={fbDatePreset === k} onClick={() => setFbDatePreset(k)}>
                    {l}
                  </Chip>
                ))}
              </div>
              {fbDatePreset === "custom" && (
                <div className="flex items-center gap-2">
                  <input type="date" value={fbFrom} onChange={(e) => setFbFrom(e.target.value)} className="flex-1 rounded-lg border border-border bg-white/[0.04] px-2 py-1 text-[11px] text-foreground focus:outline-none" />
                  <span className="text-[10px] text-muted-foreground">to</span>
                  <input type="date" value={fbTo} onChange={(e) => setFbTo(e.target.value)} className="flex-1 rounded-lg border border-border bg-white/[0.04] px-2 py-1 text-[11px] text-foreground focus:outline-none" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-white/[0.04] px-2 py-1">
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <input ref={fbSearchRef} value={fbQuery} onChange={(e) => setFbQuery(e.target.value)} placeholder="Search prompt, response, id…" aria-label="Search feedback (press / to focus)" className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-accent" />
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-white/[0.04] px-2 py-1">
                  <ArrowDownAZ className="h-3 w-3 text-muted-foreground" />
                  <select value={fbSort} onChange={(e) => setFbSort(e.target.value as SortMode)} className="bg-transparent text-[10px] text-foreground focus:outline-none">
                    <option value="newest" className="bg-background">Newest</option>
                    <option value="oldest" className="bg-background">Oldest</option>
                    <option value="up_first" className="bg-background">Highest</option>
                    <option value="down_first" className="bg-background">Lowest</option>
                  </select>
                </div>
              </div>
            </div>

            <div
              ref={fbScrollRef}
              onScroll={(e) => setFbScrollTop((e.target as HTMLDivElement).scrollTop)}
              className="relative flex-1 overflow-y-auto"
              tabIndex={0}
              role="region"
              aria-label={`Feedback list, ${feedbackView.length} record${feedbackView.length === 1 ? "" : "s"}`}
            >
              {feedbackView.length === 0 ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="m-3 rounded-xl border border-border bg-white/[0.03] px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  {ratedMessages.length === 0
                    ? "No reactions yet. Rate AI replies with 👍 / 👎 to build your feedback history."
                    : "No feedback matches these filters."}
                </div>
              ) : (
                <div
                  style={{ height: fbWindow.totalH, position: "relative" }}
                  role="list"
                  aria-rowcount={feedbackView.length}
                  aria-label={`Virtualized feedback list, showing ${fbWindow.items.length} of ${feedbackView.length}`}
                >

                  {fbWindow.items.map(({ msg: m, prompt: userPrompt }, i) => {
                    const top = (fbWindow.start + i) * FB_ROW_EST;
                    return (
                      <div key={m.id} role="listitem" aria-posinset={fbWindow.start + i + 1} aria-setsize={feedbackView.length} style={{ position: "absolute", top, left: 0, right: 0, padding: "6px 12px" }}>
                        <div className="rounded-xl border border-border bg-white/[0.03] p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                              {m.reaction === "up" ? (
                                <ThumbsUp className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <ThumbsDown className="h-3 w-3 text-rose-400" />
                              )}
                              <span className="text-foreground">
                                {m.reaction === "up" ? "Helpful" : "Not helpful"}
                              </span>
                              <span className="text-muted-foreground">· {new Date(m.ts).toLocaleString()}</span>
                              <span className="rounded bg-white/[0.05] px-1 py-[1px] font-mono text-[9px] text-muted-foreground">
                                {m.id.slice(0, 8)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => copyText(m.content, m.id)} title="Copy response" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.08] hover:text-foreground">
                                {copiedId === m.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                              </button>
                              <button
                                onClick={() => {
                                  setShowFeedback(false);
                                  send(userPrompt);
                                }}
                                disabled={!userPrompt}
                                title="Reuse prompt"
                                className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.08] hover:text-foreground disabled:opacity-30"
                              >
                                <MessageSquare className="h-3 w-3" />
                              </button>
                              <button onClick={() => setReaction(m.id, null)} title="Clear reaction" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.08] hover:text-foreground">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Prompt</div>
                            <div className="line-clamp-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-foreground">
                              {userPrompt || <span className="text-muted-foreground">—</span>}
                            </div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Response</div>
                            <div className="line-clamp-3 whitespace-pre-wrap rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-foreground">
                              {m.content}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit log */}
        {showAudit && (
          <div
            role="region"
            aria-labelledby="audit-log-heading"
            className="flex flex-1 min-h-0 flex-col border-b border-border bg-white/[0.02]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <div
                id="audit-log-heading"
                className="flex items-center gap-2 text-xs font-semibold text-foreground"
              >
                <ClipboardList className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Audit Log
                <span
                  className="rounded-full bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                  aria-label={`${auditView.length} of ${auditLog.length} audit events match filters`}
                >
                  {auditView.length}/{auditLog.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={doExportAuditJSON}
                  disabled={auditView.length === 0}
                  className="flex items-center gap-1 rounded-md border border-border bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-white/[0.08] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label={`Export ${auditView.length} audit events as JSON (shortcut J)`}
                  title="Export audit events (J)"
                >
                  <FileJson className="h-3 w-3 text-accent" aria-hidden="true" /> JSON
                </button>
                <button
                  onClick={doExportAuditCSV}
                  disabled={auditView.length === 0}
                  className="flex items-center gap-1 rounded-md border border-border bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-white/[0.08] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label={`Export ${auditView.length} audit events as CSV (shortcut C)`}
                  title="Export audit events (C)"
                >
                  <FileSpreadsheet className="h-3 w-3 text-accent" aria-hidden="true" /> CSV
                </button>
                <button
                  onClick={() => setShowShortcuts(true)}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.08] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label="Show keyboard shortcuts (?)"
                  title="Keyboard shortcuts (?)"
                >
                  <Keyboard className="h-3 w-3" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setShowAudit(false)}
                  className="text-[10px] text-muted-foreground hover:text-foreground rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label="Close audit log"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-2 border-b border-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Filter className="h-3 w-3 text-muted-foreground" />
                {(
                  [
                    ["all", "All"],
                    ["feedback_set", "Set"],
                    ["feedback_cleared", "Cleared"],
                    ["feedback_bulk_reset", "Bulk reset"],
                    ["export_json", "Export JSON"],
                    ["export_pdf", "Export PDF"],
                    ["toggle_learn", "Toggle"],
                    ["storage_recovered", "Recovery"],
                  ] as ["all" | AuditAction, string][]
                ).map(([k, l]) => (
                  <Chip key={k} active={auAction === k} onClick={() => setAuAction(k)}>
                    {l}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {(
                  [
                    ["all", "All time"],
                    ["today", "Today"],
                    ["7d", "7d"],
                    ["30d", "30d"],
                    ["month", "Month"],
                    ["custom", "Custom"],
                  ] as [DatePreset, string][]
                ).map(([k, l]) => (
                  <Chip key={k} active={auPreset === k} onClick={() => setAuPreset(k)}>
                    {l}
                  </Chip>
                ))}
              </div>
              {auPreset === "custom" && (
                <div className="flex items-center gap-2">
                  <input type="date" value={auFrom} onChange={(e) => setAuFrom(e.target.value)} className="flex-1 rounded-lg border border-border bg-white/[0.04] px-2 py-1 text-[11px] text-foreground focus:outline-none" />
                  <span className="text-[10px] text-muted-foreground">to</span>
                  <input type="date" value={auTo} onChange={(e) => setAuTo(e.target.value)} className="flex-1 rounded-lg border border-border bg-white/[0.04] px-2 py-1 text-[11px] text-foreground focus:outline-none" />
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-white/[0.04] px-2 py-1">
                <Search className="h-3 w-3 text-muted-foreground" />
                <input ref={auSearchRef} value={auQuery} onChange={(e) => setAuQuery(e.target.value)} placeholder="Search action, detail, id…" aria-label="Search audit events (press / to focus)" className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-accent" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2" role="region" aria-label={`Audit events list, ${auditView.length} event${auditView.length === 1 ? "" : "s"}`}>
              {auditView.length === 0 ? (
                <div role="status" aria-live="polite" className="rounded-xl border border-border bg-white/[0.03] px-3 py-8 text-center text-xs text-muted-foreground">
                  No audit events match these filters.
                </div>
              ) : (
                <ul className="divide-y divide-border/60 rounded-xl border border-border bg-white/[0.03]" aria-label="Audit event list">

                  {auditView.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 px-3 py-2">
                      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${dotFor(a.action)}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-foreground">
                          {labelFor(a.action)}
                          <span className="rounded bg-white/[0.05] px-1 py-[1px] font-mono text-[9px] text-muted-foreground">
                            {new Date(a.ts).toLocaleString()}
                          </span>
                        </div>
                        {a.detail && (
                          <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                            {a.detail}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        {!showFeedback && !showAudit && (
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-border bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-accent" /> Ask Vala AI anything
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  I help you run the marketplace homepage — banners, walls, offers, SEO, analytics, integrity and more.
                </p>
                {prefs.learnFromFeedback && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] px-2 py-1 text-[10px] text-emerald-200">
                    <Sparkles className="h-3 w-3" /> Suggestions reordered from your feedback
                  </div>
                )}
                <div className="mt-3 grid gap-1.5">
                  {orderedSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:border-[oklch(0.80_0.13_192/0.35)] hover:bg-white/[0.06] hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {filtered.length === 0 && messages.length > 0 && (
              <div className="rounded-xl border border-border bg-white/[0.03] px-3 py-6 text-center text-xs text-muted-foreground">
                No messages match your search.
              </div>
            )}
            {filtered.map((m) => (
              <MessageBubble key={m.id} msg={m} highlight={query.trim()} onReact={(r) => setReaction(m.id, r)} />
            ))}
            {loading && (
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Vala AI is thinking…
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {messages.length > 0 && !showSearch && !showFeedback && !showSettings && !showAudit && (
          <div className="flex gap-1.5 overflow-x-auto border-t border-border px-4 py-2">
            {orderedSuggestions.slice(0, 4).map((s) => (
              <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-border bg-white/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground">
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-white/[0.04] p-2 focus-within:border-[oklch(0.80_0.13_192/0.45)]">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask about banners, SEO, vendors, analytics…"
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button type="submit" disabled={loading || !input.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-[0_0_18px_-6px_oklch(0.80_0.13_192/0.6)] transition-opacity disabled:opacity-40">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
            <span>Enter to send • Shift+Enter for newline</span>
            {prefs.learnFromFeedback && <span className="text-emerald-400">Feedback learning: ON</span>}
          </div>
        </form>

        {toast && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center">
            <div className="pointer-events-auto rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 shadow-lg backdrop-blur">
              {toast}
            </div>
          </div>
        )}
      </aside>

      {/* Export preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-background/70 backdrop-blur-sm p-4"
          onClick={() => setPreview(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-preview-title"
            aria-describedby="export-preview-desc"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-[oklch(0.16_0.03_240)] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent" aria-hidden="true">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <div id="export-preview-title" className="text-sm font-bold text-foreground">
                    Preview: {preview.scope === "chat" ? "Chat" : "Feedback"} · {preview.format.toUpperCase()}
                  </div>
                  <div id="export-preview-desc" className="text-[11px] text-muted-foreground">
                    {previewData.length} record{previewData.length === 1 ? "" : "s"} will be included. Press Ctrl/Cmd+Enter to confirm, Esc to cancel.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.08] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                aria-label="Close preview"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-4 py-3" role="region" aria-label="Export preview data">
              {previewData.length === 0 ? (
                <div role="status" aria-live="polite" className="rounded-xl border border-border bg-white/[0.03] px-3 py-10 text-center text-xs text-muted-foreground">
                  No records available. Adjust filters and try again.
                </div>

              ) : preview.scope === "feedback" ? (
                <table className="w-full table-fixed border-collapse text-left text-[11px]">
                  <colgroup>
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "22%" }} />
                  </colgroup>
                  <thead className="sticky top-0 bg-[oklch(0.18_0.03_240)] text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="border-b border-border px-2 py-1.5">#</th>
                      <th className="border-b border-border px-2 py-1.5">Message ID</th>
                      <th className="border-b border-border px-2 py-1.5">Rating</th>
                      <th className="border-b border-border px-2 py-1.5">Timestamp</th>
                      <th className="border-b border-border px-2 py-1.5">Prompt</th>
                      <th className="border-b border-border px-2 py-1.5">Response</th>
                    </tr>
                  </thead>
                  <tbody className="text-foreground">
                    {previewData.slice(0, 200).map((r, i) => {
                      const rec = r as ReturnType<typeof feedbackRecords>[number];
                      return (
                        <tr key={rec.messageId} className="border-b border-border/50 align-top">
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="truncate px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{rec.messageId.slice(0, 12)}…</td>
                          <td className="px-2 py-1.5">{rec.rating === "up" ? "👍" : "👎"}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{new Date(rec.timestamp).toLocaleString()}</td>
                          <td className="px-2 py-1.5"><div className="line-clamp-2">{rec.prompt || "—"}</div></td>
                          <td className="px-2 py-1.5"><div className="line-clamp-2">{rec.response}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full table-fixed border-collapse text-left text-[11px]">
                  <colgroup>
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "52%" }} />
                  </colgroup>
                  <thead className="sticky top-0 bg-[oklch(0.18_0.03_240)] text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="border-b border-border px-2 py-1.5">#</th>
                      <th className="border-b border-border px-2 py-1.5">Role</th>
                      <th className="border-b border-border px-2 py-1.5">Timestamp</th>
                      <th className="border-b border-border px-2 py-1.5">Rating</th>
                      <th className="border-b border-border px-2 py-1.5">Content</th>
                    </tr>
                  </thead>
                  <tbody className="text-foreground">
                    {previewData.slice(0, 200).map((r, i) => {
                      const rec = r as ReturnType<typeof chatRecords>[number];
                      return (
                        <tr key={rec.id} className="border-b border-border/50 align-top">
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-1.5">{rec.role}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{new Date(rec.timestamp).toLocaleString()}</td>
                          <td className="px-2 py-1.5">{rec.reaction === "up" ? "👍" : rec.reaction === "down" ? "👎" : "—"}</td>
                          <td className="px-2 py-1.5"><div className="line-clamp-2">{rec.content}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {previewData.length > 200 && (
                <div className="pt-2 text-center text-[10px] text-muted-foreground">
                  Preview shows first 200 rows. All {previewData.length} records will be included in the export.
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              <div className="text-[10px] text-muted-foreground">
                Format: <span className="font-semibold text-foreground">{preview.format.toUpperCase()}</span>
                {" · "}
                {preview.scope === "feedback" ? "current feedback filters applied" : "entire chat history"}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPreview(null)} className="rounded-lg border border-border bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-white/[0.08] hover:text-foreground">
                  Cancel
                </button>
                <button
                  onClick={confirmExport}
                  disabled={previewData.length === 0}
                  className="rounded-lg bg-gradient-to-br from-primary to-accent px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_0_18px_-6px_oklch(0.80_0.13_192/0.6)] disabled:opacity-40"
                >
                  Confirm & download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk reset confirmation */}
      {confirmReset && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-background/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/40 bg-[oklch(0.16_0.03_240)] p-5 shadow-2xl">
            <div className="mb-2 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-rose-500/20 text-rose-300">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">Clear all AI feedback?</div>
                <div className="text-[11px] text-muted-foreground">This action cannot be undone.</div>
              </div>
            </div>
            <div className="my-3 rounded-lg border border-border bg-white/[0.04] px-3 py-2 text-[11px] text-muted-foreground">
              You are about to remove{" "}
              <span className="font-bold text-foreground">
                {ratedMessages.length} feedback record{ratedMessages.length === 1 ? "" : "s"}
              </span>{" "}
              (thumbs up / down). Chats, prompts, settings and history stay intact.
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmReset(false)} className="rounded-lg border border-border bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-white/[0.08] hover:text-foreground">
                Cancel
              </button>
              <button onClick={bulkResetFeedback} className="rounded-lg border border-rose-500/50 bg-rose-500/20 px-3 py-1.5 text-[12px] font-bold text-rose-100 hover:bg-rose-500/30">
                Clear {ratedMessages.length} record{ratedMessages.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IconBtn({
  children,
  active,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; className?: string }) {
  return (
    <button
      {...rest}
      className={`relative rounded-full border p-2 transition-colors ${
        active
          ? "border-[oklch(0.80_0.13_192/0.45)] bg-[oklch(0.80_0.13_192/0.14)] text-foreground"
          : "border-border bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
        active
          ? "border-accent/50 bg-accent/15 text-foreground"
          : "border-border bg-white/[0.03] text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function MessageBubble({
  msg,
  highlight,
  onReact,
}: {
  msg: StoredMessage;
  highlight: string;
  onReact: (r: Reaction) => void;
}) {
  if (msg.role === "system") return null;
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ring-white/10 ${
          isUser ? "bg-white/[0.08] text-foreground" : "bg-gradient-to-br from-primary to-accent text-white"
        }`}
      >
        {isUser ? <User2 className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
            isUser ? "bg-[oklch(0.80_0.13_192/0.14)] text-foreground" : "border border-border bg-white/[0.03] text-foreground"
          }`}
        >
          {highlight ? highlightText(msg.content, highlight) : msg.content}
        </div>
        <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
          <span>{new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {!isUser && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onReact("up")}
                title="Helpful"
                className={`grid h-5 w-5 place-items-center rounded transition-colors ${
                  msg.reaction === "up" ? "bg-emerald-500/20 text-emerald-300" : "hover:bg-white/[0.08] hover:text-foreground"
                }`}
              >
                <ThumbsUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => onReact("down")}
                title="Not helpful"
                className={`grid h-5 w-5 place-items-center rounded transition-colors ${
                  msg.reaction === "down" ? "bg-rose-500/20 text-rose-300" : "hover:bg-white/[0.08] hover:text-foreground"
                }`}
              >
                <ThumbsDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function highlightText(text: string, q: string) {
  const needle = q.trim();
  if (!needle) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(needle)})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === needle.toLowerCase() ? (
      <mark key={i} className="rounded bg-[oklch(0.80_0.13_192/0.35)] px-0.5 text-foreground">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function openPrintable(title: string, sub: string, body: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body><h1 style="font:600 20px -apple-system,Segoe UI,sans-serif;margin:0 0 4px">${escapeHtml(title)}</h1>
<div style="color:#666;margin-bottom:16px;font:11px -apple-system,Segoe UI,sans-serif">Generated ${escapeHtml(new Date().toLocaleString())} · ${escapeHtml(sub)}</div>
${body}
<script>window.onload=()=>{setTimeout(()=>window.print(),250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function labelFor(a: AuditAction) {
  switch (a) {
    case "feedback_set":
      return "Feedback set";
    case "feedback_cleared":
      return "Feedback cleared";
    case "feedback_bulk_reset":
      return "Bulk reset";
    case "export_json":
      return "Exported JSON";
    case "export_pdf":
      return "Exported PDF";
    case "toggle_learn":
      return "Learning toggle";
    case "storage_recovered":
      return "Storage recovery";
  }
}

function dotFor(a: AuditAction) {
  switch (a) {
    case "feedback_set":
      return "bg-emerald-400";
    case "feedback_cleared":
      return "bg-muted-foreground";
    case "feedback_bulk_reset":
      return "bg-rose-400";
    case "export_json":
    case "export_pdf":
      return "bg-accent";
    case "toggle_learn":
      return "bg-primary";
    case "storage_recovered":
      return "bg-amber-400";
  }
}
