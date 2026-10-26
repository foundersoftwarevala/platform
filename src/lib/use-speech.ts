import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MicStatus = "checking" | "ready" | "asking" | "listening" | "blocked" | "unsupported" | "no-device" | "error";

export const MIC_MESSAGES: Record<MicStatus, string> = {
  checking: "",
  ready: "",
  asking: "Allow microphone access in the browser pop-up.",
  listening: "Listening...",
  blocked: "Microphone is blocked. Click the lock icon in the address bar, allow Microphone, then tap Talk again.",
  unsupported: "Voice input isn't supported in this browser. Use Chrome or Edge on a computer or Android phone.",
  "no-device": "No microphone found. Plug one in or check your device settings.",
  error: "",
};

/** Pure helper: map a browser error to a status (kept separate so it can be tested). */
export function micStatusFromError(name: string): MicStatus {
  if (name === "not-allowed" || name === "NotAllowedError" || name === "SecurityError" || name === "service-not-allowed") return "blocked";
  if (name === "NotFoundError" || name === "audio-capture" || name === "OverconstrainedError") return "no-device";
  return "error";
}

// Real microphone input: asks permission with getUserMedia, then transcribes with the Web Speech API.
export function useSpeech(onFinal: (text: string) => void) {
  const recRef = useRef<any>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;
  const [status, setStatus] = useState<MicStatus>("checking");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setStatus("unsupported"); return; }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = "";
      let final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      setInterim(text);
      if (final && text.trim()) cb.current(text.trim());
    };
    rec.onerror = (e: any) => {
      if (e.error === "aborted") return;
      if (e.error === "no-speech") { setError("I didn't hear anything. Tap Talk and speak again."); return; }
      const s = micStatusFromError(e.error);
      setStatus(s);
      setError(s === "error" ? "Microphone problem: " + e.error : MIC_MESSAGES[s]);
    };
    rec.onend = () => { setStatus((s) => (s === "listening" ? "ready" : s)); setInterim(""); };
    recRef.current = rec;
    let perm: PermissionStatus | null = null;
    const apply = (state: string) => setStatus(state === "denied" ? "blocked" : "ready");
    (navigator.permissions?.query({ name: "microphone" as PermissionName }) ?? Promise.reject())
      .then((p) => { perm = p; apply(p.state); p.onchange = () => apply(p.state); })
      .catch(() => setStatus("ready"));
    return () => { if (perm) perm.onchange = null; try { rec.abort(); } catch { /* noop */ } };
  }, []);

  const start = async () => {
    setError("");
    if (!recRef.current) { setStatus("unsupported"); setError(MIC_MESSAGES.unsupported); return; }
    setStatus("asking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e: any) {
      const s = micStatusFromError(e?.name ?? "");
      setStatus(s);
      setError(s === "error" ? "Microphone problem: " + (e?.message ?? "unknown") : MIC_MESSAGES[s]);
      return;
    }
    try { recRef.current.start(); setStatus("listening"); } catch { setStatus("listening"); }
  };
  const stop = () => {
    try { recRef.current?.abort(); } catch { /* noop */ }
    setStatus((s) => (s === "listening" || s === "asking" ? "ready" : s));
  };
  const listening = status === "listening";
  return { listening, status, interim, error, supported: status !== "unsupported", start, stop };
}
