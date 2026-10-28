import { useEffect, useRef, useState } from "react";
import { ActivityPanel, AgentStage, BrowserPanel, TopBar } from "@/components/ai-ceo/AyraWorld";
import type { CoreState } from "@/components/JarvisCore";
import { streamChat, type ChatTurn } from "@/components/vala-ai/chat-stream";
import { useSpeech } from "@/lib/use-speech";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import { AyraCommandCenter } from "@/components/ai-ceo/AyraCommandCenter";
import { AyraLocalBridgePanel } from "@/components/ai-ceo/AyraLocalBridgePanel";
import "./ayra-world.css";

export function AyraWorldBanner() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cmd, setCmd] = useState("");
  const [reply, setReply] = useState("");
  const [core, setCore] = useState<CoreState>("idle");
  const [muted, setMuted] = useState(false);
  const [look, setLook] = useState<Parameters<typeof AgentStage>[0]["look"]>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const mutedRef = useRef(muted);
  const voice = useSpeechSynthesis();

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
      if (mutedRef.current) {
        setCore("completed");
      } else {
        let speechFailed = false;
        const accepted = voice.speak(result, {
          onEnd: () => setCore("completed"),
          onError: (message) => {
            speechFailed = true;
            setReply(`${result}\n\n${message}`);
            setCore("error");
          },
        });
        setCore(accepted ? "speaking" : speechFailed ? "error" : "completed");
      }
    } catch (error) {
      if (request.signal.aborted) return;
      setReply(error instanceof Error ? error.message : "AYRA could not process that request.");
      setCore("error");
    } finally {
      if (controller.current === request) controller.current = null;
    }
  };

  const speech = useSpeech((text) => {
    if (!mutedRef.current) void run(text);
  });
  const toggleTalk = () => {
    if (speech.listening || speech.status === "asking") {
      speech.stop();
      return;
    }
    if (muted) {
      setReply("Microphone is muted. Tap Mute again to unmute.");
      return;
    }
    void speech.start();
  };
  const updateMuted = (nextMuted: boolean) => {
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    if (nextMuted) {
      speech.stop();
      voice.stop();
      setCore((current) => (current === "speaking" ? "completed" : current));
    }
  };
  useEffect(() => () => controller.current?.abort(), []);

  const busy = core === "thinking" || core === "executing" || core === "speaking";
  const status = busy
    ? "AYRA is responding..."
    : core === "error"
      ? "Request failed"
      : "Ready for your command";

  return (
    <div className="ayra-world" data-testid="ayra-world-banner">
      <TopBar
        cmd={cmd}
        setCmd={setCmd}
        onRun={() => void run()}
        listening={speech.listening}
        onMic={toggleTalk}
        onTools={(tool) => {
          if (tool === "settings" || tool === "roles") {
            setSettingsOpen(true);
          } else if (tool === "security") {
            window.location.assign("/ai-ceo/security");
          } else if (tool === "chat") {
            inputRef.current?.focus();
          } else if (tool === "ops") {
            window.location.assign("/ai-ceo/agents");
          } else if (tool === "lookbook") {
            setLook(null);
            setReply("Choose an AYRA look from the strip on the left to preview it.");
          }
        }}
        onSettings={() => setSettingsOpen(true)}
        role="AYRA"
        inputRef={inputRef}
      />
      <main className="aw-main">
        <AgentStage
          core={speech.listening ? "listening" : voice.speaking ? "speaking" : core}
          look={look}
          setLook={setLook}
          reply={reply}
          muted={muted}
          micNote={muted ? "Microphone muted" : speech.error || voice.error || undefined}
          micState={muted ? "muted" : speech.status}
          setMuted={updateMuted}
          onTalk={toggleTalk}
          onEnd={() => {
            controller.current?.abort();
            speech.stop();
            voice.stop();
            mutedRef.current = false;
            setMuted(false);
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
        <div className="aw-workspace">
          <BrowserPanel onRun={(command) => void run(command)} reply={reply} busy={busy} />
          <ActivityPanel core={speech.listening ? "listening" : core} status={status} />
        </div>
      </main>
      <AyraLocalBridgePanel />
      <footer className="aw-foot">Powered by Software Vala™</footer>
      <AyraCommandCenter open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
