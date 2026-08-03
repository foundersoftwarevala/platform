import { useCallback, useRef, useState } from "react";

export type ValaMessage = { id: string; role: "user" | "assistant"; content: string };

const WELCOME =
  "Hello Boss. Welcome back. All enterprise systems are online. How may I assist you today?";

export function useValaChat() {
  const [messages, setMessages] = useState<ValaMessage[]>([
    { id: "welcome", role: "assistant", content: WELCOME },
  ]);
  const [status, setStatus] = useState<"idle" | "thinking" | "speaking">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([{ id: "welcome", role: "assistant", content: WELCOME }]);
    setStatus("idle");
    setError(null);
  }, []);

  const send = useCallback(
    async (text: string, onDone?: (full: string) => void) => {
      const clean = text.trim();
      if (!clean || status !== "idle") return;

      setError(null);
      const userMsg: ValaMessage = { id: `u-${Date.now()}`, role: "user", content: clean };
      const assistantId = `a-${Date.now()}`;
      const history = [...messages, userMsg];
      setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
      setStatus("thinking");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (res.status === 429) throw new Error("Too many requests, Boss. Ek minute me phir try karein.");
        if (res.status === 402) throw new Error("AI credits khatam ho gaye. Please add credits to continue.");
        if (!res.ok || !res.body) throw new Error("AI abhi respond nahi kar pa rahi hai.");

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let full = "";
        setStatus("speaking");

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta: string = parsed?.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                full += delta;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m)),
                );
              }
            } catch {
              /* ignore malformed chunk */
            }
          }
        }

        if (!full) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: "Sorry Boss, mujhe koi reply nahi mila." } : m,
            ),
          );
        } else {
          onDone?.(full);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = (e as Error).message || "Something went wrong.";
        setError(msg);
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: msg } : m)));
      } finally {
        setStatus("idle");
      }
    },
    [messages, status],
  );

  return { messages, status, error, send, reset };
}
