import { useCallback, useRef, useState } from "react";

import { ChatRequestError, streamChat } from "./chat-stream";

export type ValaMessage = { id: string; role: "user" | "assistant"; content: string };

const WELCOME =
  "Hello Boss. Welcome back. All enterprise systems are online. How may I assist you today?";

function errorMessage(e: unknown): string {
  if (e instanceof ChatRequestError) {
    if (e.status === 401)
      return "Please sign in again, Boss. This session is not authorised for AI.";
    if (e.status === 429) return "Too many requests, Boss. Ek minute me phir try karein.";
    if (e.status === 402) return "AI credits khatam ho gaye. Please add credits to continue.";
    return e.message || "AI abhi respond nahi kar pa rahi hai.";
  }
  return (e as Error)?.message || "Something went wrong.";
}

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
      // The welcome line is local UI text, not something the assistant said.
      const history = [...messages, userMsg];
      setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
      setStatus("thinking");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const full = await streamChat(
          history
            .filter((m) => m.id !== "welcome")
            .map((m) => ({ role: m.role, content: m.content })),
          {
            signal: controller.signal,
            onDelta: (partial) => {
              setStatus("speaking");
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: partial } : m)),
              );
            },
          },
        );

        if (!full) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Sorry Boss, mujhe koi reply nahi mila." }
                : m,
            ),
          );
        } else {
          onDone?.(full);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = errorMessage(e);
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
