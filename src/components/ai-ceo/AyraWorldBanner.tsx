import { useRef, useState } from "react";
import { ActivityPanel, AgentStage, BrowserPanel, TopBar } from "@/components/ai-ceo/AyraWorld";
import type { CoreState } from "@/components/JarvisCore";
import { streamChat, type ChatTurn } from "@/components/vala-ai/chat-stream";
import { useSpeech } from "@/lib/use-speech";
import "./ayra-world.css";

export function AyraWorldBanner() {
  const [cmd, setCmd] = useState("");
  const [reply, setReply] = useState("");
  const [core, setCore] = useState<CoreState>("idle");
  const [muted, setMuted] = useState(false);
  const [look, setLook] = useState<Parameters<typeof AgentStage>[0]["look"]>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);

  const run = async (command = cmd) => {
    const content = command.trim();
    if (!content || core === "thinking" || core === "executing" || core === "speaking") return;

    const nextMessages: ChatTurn[] = [...messages, { role: "user", content }];
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setMessages(nextMessages);
    setCmd("");
    setReply("");
    setCore("thinking");

    try {
      const result = await streamChat(nextMessages, {
        signal: request.signal,
        onDelta: setReply,
      });
      if (request.signal.aborted) return;
      if (!result.trim()) throw new Error("AYRA returned an empty response. Please try again.");
      setMessages([...nextMessages, { role: "assistant", content: result }]);
      setReply(result);
      setCore("completed");
    } catch (error) {
      if (request.signal.aborted) return;
      setReply(error instanceof Error ? error.message : "AYRA could not process that request.");
      setCore("error");
    } finally {
      if (controller.current === request) controller.current = null;
    }
  };

  const speech = useSpeech((text) => void run(text));
  const toggleTalk = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    if (muted) {
      setReply("Microphone is muted. Tap Mute again to unmute.");
      return;
    }
    void speech.start();
  };

  const busy = core === "thinking" || core === "executing" || core === "speaking";
  const status = busy ? "AYRA is responding..." : core === "error" ? "Request failed" : "Ready for your command";

  return (
    <div className="ayra-world" data-testid="ayra-world-banner">
      <TopBar
        cmd={cmd}
        setCmd={setCmd}
        onRun={() => void run()}
        listening={speech.listening}
        onMic={toggleTalk}
        onTools={(tool) => setReply(`${tool} is available in the AYRA Command Center.`)}
        onSettings={() => setReply("Settings are available in the AYRA Command Center.")}
        role="AYRA"
        inputRef={inputRef}
      />
      <main className="aw-main">
        <AgentStage
          core={speech.listening ? "listening" : core}
          look={look}
          setLook={setLook}
          reply={reply}
          muted={muted}
          micNote={muted ? "Microphone muted" : undefined}
          micState={muted ? "muted" : speech.status}
          setMuted={(nextMuted) => {
            setMuted(nextMuted);
            if (nextMuted) speech.stop();
          }}
          onTalk={toggleTalk}
          onEnd={() => {
            controller.current?.abort();
            speech.stop();
            setCmd("");
            setReply("");
            setMessages([]);
            setCore("idle");
          }}
          onShortcut={(command, url) => {
            if (url) window.open(url, "_blank", "noopener");
            void run(command);
          }}
        />
        <div className="grid min-h-0 grid-rows-[1fr_auto] gap-3">
          <BrowserPanel onRun={(command) => void run(command)} reply={reply} busy={busy} />
          <ActivityPanel core={speech.listening ? "listening" : core} status={status} />
        </div>
      </main>
      <footer className="aw-foot">Powered by Software Vala™</footer>
    </div>
  );
}
