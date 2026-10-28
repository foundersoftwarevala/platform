// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AyraWorldBanner } from "./AyraWorldBanner";

const mocks = vi.hoisted(() => ({
  streamChat: vi.fn(),
  onFinal: (text: string) => {
    void text;
  },
  stopMic: vi.fn(),
  speak: vi.fn(),
  stopVoice: vi.fn(),
  voiceError: "",
  speakCallbacks: null as { onEnd?: () => void; onError?: (message: string) => void } | null,
}));

vi.mock("@/components/vala-ai/chat-stream", () => ({ streamChat: mocks.streamChat }));
vi.mock("@/lib/use-speech", () => ({
  useSpeech: (onFinal: (text: string) => void) => {
    mocks.onFinal = onFinal;
    return {
      listening: false,
      status: "ready",
      interim: "",
      error: "",
      supported: true,
      start: vi.fn(),
      stop: mocks.stopMic,
    };
  },
}));
vi.mock("@/lib/use-speech-synthesis", () => ({
  useSpeechSynthesis: () => ({
    speaking: false,
    supported: true,
    error: mocks.voiceError,
    speak: mocks.speak,
    stop: mocks.stopVoice,
  }),
}));
vi.mock("@/components/ai-ceo/AyraWorld", () => ({
  TopBar: ({
    cmd,
    setCmd,
    onRun,
    onMic,
    onSettings,
  }: {
    cmd: string;
    setCmd: (value: string) => void;
    onRun: () => void;
    onMic: () => void;
    onSettings: () => void;
  }) => (
    <div>
      <input
        aria-label="Command AYRA"
        value={cmd}
        onChange={(event) => setCmd(event.target.value)}
      />
      <button aria-label="Send command" onClick={onRun}>
        Send
      </button>
      <button aria-label="Talk to AYRA" onClick={onMic}>
        Talk
      </button>
      <button aria-label="Open Ayra Command Center settings" onClick={onSettings}>
        Settings
      </button>
    </div>
  ),
  AgentStage: ({
    core,
    reply,
    muted,
    micNote,
    setMuted,
    onTalk,
    onEnd,
  }: {
    core: string;
    reply: string;
    muted: boolean;
    micNote?: string;
    setMuted: (muted: boolean) => void;
    onTalk: () => void;
    onEnd: () => void;
  }) => (
    <section>
      <output data-testid="agent-core">{core}</output>
      <output data-testid="agent-reply">{reply}</output>
      <output data-testid="agent-mic-note">{micNote}</output>
      <button aria-label="Talk" onClick={onTalk}>
        Talk
      </button>
      <button aria-label="Mute" onClick={() => setMuted(!muted)}>
        Mute
      </button>
      <button aria-label="End" onClick={onEnd}>
        End
      </button>
      <output data-testid="agent-muted">{String(muted)}</output>
    </section>
  ),
  BrowserPanel: () => null,
  ActivityPanel: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.voiceError = "";
  mocks.speakCallbacks = null;
  mocks.streamChat.mockResolvedValue("AYRA's spoken response.");
  mocks.speak.mockImplementation((_text: string, callbacks: typeof mocks.speakCallbacks) => {
    mocks.speakCallbacks = callbacks;
    return true;
  });
});

afterEach(() => cleanup());

function renderBanner() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AyraWorldBanner />
    </QueryClientProvider>,
  );
}

describe("AYRA voice chat flow", () => {
  it("sends a recognized transcript to the existing chat backend and speaks the completed reply once", async () => {
    renderBanner();

    act(() => mocks.onFinal("Find my latest tasks"));
    await waitFor(() => expect(mocks.speak).toHaveBeenCalledOnce());

    expect(mocks.streamChat).toHaveBeenCalledWith(
      [{ role: "user", content: "Find my latest tasks" }],
      expect.objectContaining({ signal: expect.any(AbortSignal), onDelta: expect.any(Function) }),
    );
    expect(mocks.speak).toHaveBeenCalledWith(
      "AYRA's spoken response.",
      expect.objectContaining({ onEnd: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(screen.getByTestId("agent-core").textContent).toBe("speaking");
    act(() => mocks.speakCallbacks?.onEnd?.());
    expect(screen.getByTestId("agent-core").textContent).toBe("completed");
  });

  it("opens the Command Center from the existing gear/settings action", () => {
    renderBanner();

    fireEvent.click(screen.getByRole("button", { name: "Open Ayra Command Center settings" }));

    expect(screen.getByRole("dialog", { name: "AYRA COMMAND CENTER" })).toBeTruthy();
  });

  it("Mute stops recognition and speech output, and End stops audio and resets the conversation", async () => {
    renderBanner();
    act(() => mocks.onFinal("Tell me a short update"));
    await waitFor(() => expect(mocks.speak).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(mocks.stopVoice).toHaveBeenCalledOnce();
    expect(mocks.stopMic).toHaveBeenCalledOnce();
    expect(screen.getByTestId("agent-muted").textContent).toBe("true");
    expect(screen.getByTestId("agent-core").textContent).toBe("completed");

    fireEvent.click(screen.getByRole("button", { name: "End" }));
    expect(mocks.stopVoice).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("agent-muted").textContent).toBe("false");
    expect(screen.getByTestId("agent-core").textContent).toBe("idle");
    expect(screen.getByTestId("agent-reply").textContent).toBe("");
  });

  it("does not start speech if the user mutes while the chat response is pending", async () => {
    let resolveResponse: (response: string) => void = () => {
      throw new Error("Response promise was not initialized.");
    };
    mocks.streamChat.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    renderBanner();
    act(() => mocks.onFinal("Give me an update"));
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    await act(async () => resolveResponse("A muted response."));

    expect(mocks.speak).not.toHaveBeenCalled();
    expect(screen.getByTestId("agent-reply").textContent).toBe("A muted response.");
  });

  it("End aborts an in-flight chat request and prevents its late reply from restoring the session", async () => {
    let resolveResponse: (response: string) => void = () => {
      throw new Error("Response promise was not initialized.");
    };
    let requestSignal: AbortSignal | undefined;
    mocks.streamChat.mockImplementationOnce(
      (_messages: unknown, options: { signal: AbortSignal }) => {
        requestSignal = options.signal;
        return new Promise<string>((resolve) => {
          resolveResponse = resolve;
        });
      },
    );
    renderBanner();
    act(() => mocks.onFinal("Start a long request"));
    await waitFor(() => expect(requestSignal).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "End" }));
    expect(requestSignal?.aborted).toBe(true);
    await act(async () => resolveResponse("This late result must be ignored."));

    expect(mocks.speak).not.toHaveBeenCalled();
    expect(screen.getByTestId("agent-core").textContent).toBe("idle");
    expect(screen.getByTestId("agent-reply").textContent).toBe("");
  });
});
