// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectAyraVoice, useSpeechSynthesis } from "./use-speech-synthesis";

class TestUtterance {
  lang = "";
  rate = 1;
  pitch = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(readonly text: string) {}
}

const preferredVoice = { name: "Google UK English Female", lang: "en-GB" } as SpeechSynthesisVoice;
const fallbackVoice = { name: "English India", lang: "en-IN" } as SpeechSynthesisVoice;
const utterances: TestUtterance[] = [];
const synthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn(() => [fallbackVoice, preferredVoice]),
};
const synthesisDescriptor = Object.getOwnPropertyDescriptor(window, "speechSynthesis");

beforeEach(() => {
  utterances.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class extends TestUtterance {
      constructor(text: string) {
        super(text);
        utterances.push(this);
      }
    },
  );
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: synthesis as unknown as SpeechSynthesis,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (synthesisDescriptor) Object.defineProperty(window, "speechSynthesis", synthesisDescriptor);
  else Reflect.deleteProperty(window, "speechSynthesis");
});

describe("AYRA native speech synthesis", () => {
  it("prefers an available female-named voice and otherwise matches the requested language", () => {
    expect(selectAyraVoice([fallbackVoice, preferredVoice])).toBe(preferredVoice);
    expect(selectAyraVoice([fallbackVoice])).toBe(fallbackVoice);
    expect(selectAyraVoice([])).toBeNull();
  });

  it("speaks one completed response with a selected voice and reports active/end states", async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => expect(result.current.speak("Hello from AYRA.", { onStart, onEnd })).toBe(true));
    expect(synthesis.speak).toHaveBeenCalledOnce();
    expect(utterances).toHaveLength(1);
    expect(utterances[0].text).toBe("Hello from AYRA.");
    expect(utterances[0].voice).toBe(preferredVoice);
    expect(utterances[0].lang).toBe("en-IN");

    act(() => utterances[0].onstart?.());
    expect(result.current.speaking).toBe(true);
    expect(onStart).toHaveBeenCalledOnce();
    act(() => utterances[0].onend?.());
    await waitFor(() => expect(result.current.speaking).toBe(false));
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("cancels active speech and ignores stale completion callbacks", () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useSpeechSynthesis());
    act(() => result.current.speak("A response.", { onEnd }));
    act(() => utterances[0].onstart?.());
    act(() => result.current.stop());
    act(() => utterances[0].onend?.());

    expect(synthesis.cancel).toHaveBeenCalledOnce();
    expect(result.current.speaking).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("reports unsupported speech playback without throwing", () => {
    vi.stubGlobal("SpeechSynthesisUtterance", undefined);
    const onError = vi.fn();
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => expect(result.current.speak("Hello.", { onError })).toBe(false));
    expect(result.current.supported).toBe(false);
    expect(result.current.error).toMatch(/isn't supported/i);
    expect(onError).toHaveBeenCalledOnce();
    expect(synthesis.speak).not.toHaveBeenCalled();
  });
});
