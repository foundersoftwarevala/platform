// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatVoice } from "./useChatVoice";

const mocks = vi.hoisted(() => ({ api: vi.fn(), getUserMedia: vi.fn() }));
vi.mock("./api", () => ({ api: mocks.api }));

const recorders: TestRecorder[] = [];
const utterances: TestUtterance[] = [];
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
let audioTrack: { readyState: "live"; stop: ReturnType<typeof vi.fn> };
let audioStream: {
  getAudioTracks: () => (typeof audioTrack)[];
  getTracks: () => (typeof audioTrack)[];
};

class TestRecorder {
  static isTypeSupported = vi.fn(() => true);
  state: RecordingState = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstart: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn(() => {
    this.state = "recording";
    queueMicrotask(() => this.onstart?.());
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["recorder fixture bytes"], { type: this.mimeType }),
    } as BlobEvent);
    this.onstop?.();
  });
  constructor(
    public stream: MediaStream,
    public options?: MediaRecorderOptions,
  ) {
    recorders.push(this);
  }
}

class TestUtterance {
  lang = "";
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {
    utterances.push(this);
  }
}

const synthesis = { speak: vi.fn(), cancel: vi.fn() };
beforeEach(() => {
  recorders.length = 0;
  utterances.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("MediaRecorder", TestRecorder);
  vi.stubGlobal("SpeechSynthesisUtterance", TestUtterance);
  vi.stubGlobal("speechSynthesis", synthesis);
  audioTrack = { readyState: "live", stop: vi.fn() };
  audioStream = { getAudioTracks: () => [audioTrack], getTracks: () => [audioTrack] };
  mocks.getUserMedia.mockResolvedValue(audioStream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: mocks.getUserMedia },
  });
  mocks.api.mockImplementation(async (path: string) => {
    if (path === "/voice/transcribe-audio") return { text: "Open dashboard" };
    return { text: "The dashboard is ready.", lang: "en-IN" };
  });
});
afterEach(async () => {
  cleanup();
  await Promise.resolve();
  if (originalMediaDevices) Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  else Reflect.deleteProperty(navigator, "mediaDevices");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function beginAndStop(result: { current: ReturnType<typeof useChatVoice> }) {
  act(() => result.current.toggleMic());
  await waitFor(() => expect(recorders).toHaveLength(1));
  await waitFor(() => expect(result.current.listening).toBe(true));
  act(() => result.current.toggleMic());
}

describe("local MediaRecorder voice lifecycle (simulated browser events, not real speech acceptance)", () => {
  it("uploads the recorded Blob to authenticated local Whisper, sends its transcript to chat, and speaks the reply", async () => {
    const model = vi.fn(async () => "The dashboard is ready.");
    const { result } = renderHook(() => useChatVoice(model, ""));
    await beginAndStop(result);

    await waitFor(() => expect(model).toHaveBeenCalledWith("Open dashboard"));
    expect(mocks.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(recorders[0].options).toEqual({ mimeType: "audio/webm;codecs=opus" });
    expect(recorders[0].start).toHaveBeenCalledWith(1000);
    expect(audioTrack.stop).toHaveBeenCalledOnce();
    expect(mocks.api.mock.calls[0][0]).toBe("/voice/transcribe-audio");
    expect(mocks.api.mock.calls[0][1].body).toBeInstanceOf(FormData);
    expect((mocks.api.mock.calls[0][1].body as FormData).get("audio")).toBeInstanceOf(Blob);
    expect(mocks.api.mock.calls[1][0]).toBe("/voice/speak");
    expect(utterances).toHaveLength(1);
    expect(utterances[0].text).toBe("The dashboard is ready.");
    expect(synthesis.speak).toHaveBeenCalledWith(utterances[0]);
  });

  it("releases a permission-granted stream that arrives after cancellation", async () => {
    let grant: (stream: typeof audioStream) => void = () => {
      throw new Error("Capture promise was not initialized.");
    };
    mocks.getUserMedia.mockImplementationOnce(
      () =>
        new Promise<typeof audioStream>((resolve) => {
          grant = resolve;
        }),
    );
    const model = vi.fn();
    const { result } = renderHook(() => useChatVoice(model, ""));
    act(() => result.current.toggleMic());
    act(() => result.current.toggleMic());
    await act(async () => grant(audioStream));
    expect(audioTrack.stop).toHaveBeenCalledOnce();
    expect(recorders).toHaveLength(0);
    expect(model).not.toHaveBeenCalled();
  });

  it("stops recording and releases the track when the project context changes", async () => {
    const { result, rerender } = renderHook(({ project }) => useChatVoice(vi.fn(), project), {
      initialProps: { project: "one" },
    });
    act(() => result.current.toggleMic());
    await waitFor(() => expect(result.current.listening).toBe(true));
    rerender({ project: "two" });
    expect(audioTrack.stop).toHaveBeenCalledOnce();
    expect(recorders[0].state).toBe("inactive");
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it.each(["error", "unmount"])("releases a live input on %s", async (action) => {
    const { result, unmount } = renderHook(() => useChatVoice(vi.fn(), ""));
    act(() => result.current.toggleMic());
    await waitFor(() => expect(result.current.listening).toBe(true));
    if (action === "error") act(() => recorders[0].onerror?.(new Event("error")));
    else unmount();
    expect(audioTrack.stop).toHaveBeenCalledOnce();
    expect(recorders[0].state).toBe("inactive");
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("surfaces actual microphone denial without uploading audio", async () => {
    mocks.getUserMedia.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    const { result } = renderHook(() => useChatVoice(vi.fn(), ""));
    act(() => result.current.toggleMic());
    await waitFor(() => expect(result.current.error?.message).toMatch(/capture was denied/i));
    expect(recorders).toHaveLength(0);
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("rejects an insecure origin before requesting microphone access", () => {
    vi.stubGlobal("isSecureContext", false);
    const { result } = renderHook(() => useChatVoice(vi.fn(), ""));
    act(() => result.current.toggleMic());
    expect(result.current.error?.message).toMatch(/requires HTTPS or a secure localhost/);
    expect(mocks.getUserMedia).not.toHaveBeenCalled();
  });

  it("surfaces transcription failures and never sends a fabricated transcript to chat", async () => {
    mocks.api.mockRejectedValueOnce(new Error("Local Whisper is not ready."));
    const model = vi.fn();
    const { result } = renderHook(() => useChatVoice(model, ""));
    await beginAndStop(result);
    await waitFor(() => expect(result.current.error?.message).toMatch(/Whisper is not ready/));
    expect(model).not.toHaveBeenCalled();
    expect(audioTrack.stop).toHaveBeenCalledOnce();
  });

  it("does not submit when the recorder produced an empty recording", async () => {
    const model = vi.fn();
    const { result } = renderHook(() => useChatVoice(model, ""));
    act(() => result.current.toggleMic());
    await waitFor(() => expect(result.current.listening).toBe(true));
    recorders[0].ondataavailable = null;
    recorders[0].mimeType = "";
    act(() => result.current.toggleMic());
    await waitFor(() => expect(result.current.error?.message).toMatch(/produced no audio/));
    expect(mocks.api).not.toHaveBeenCalled();
    expect(model).not.toHaveBeenCalled();
  });
});
