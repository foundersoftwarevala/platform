import { useCallback, useEffect, useRef, useState } from "react";

export interface SpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

const FEMALE_VOICE_NAMES =
  /google uk english female|female|samantha|victoria|karen|moira|tessa|serena|ava/i;

export function selectAyraVoice(voices: SpeechSynthesisVoice[], language = "en-IN") {
  const preferred = voices.find((voice) => FEMALE_VOICE_NAMES.test(voice.name));
  if (preferred) return preferred;
  const languagePrefix = language.split("-")[0].toLowerCase();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase()) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${languagePrefix}-`)) ??
    null
  );
}

export function useSpeechSynthesis(language = "en-IN") {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    const utterance = utteranceRef.current;
    utteranceRef.current = null;
    if (utterance) {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    }
    if (utterance && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]);

  const speak = useCallback(
    (text: string, callbacks: SpeechCallbacks = {}): boolean => {
      const cleanText = text.trim();
      if (!cleanText) return false;
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        typeof SpeechSynthesisUtterance === "undefined"
      ) {
        const message = "Speech playback isn't supported in this browser.";
        setError(message);
        callbacks.onError?.(message);
        return false;
      }

      stop();
      setError("");
      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = language;
        utterance.rate = 0.96;
        utterance.pitch = 1.04;
        utterance.voice = selectAyraVoice(window.speechSynthesis.getVoices(), language);
        utterance.onstart = () => {
          setSpeaking(true);
          callbacks.onStart?.();
        };
        utterance.onend = () => {
          if (utteranceRef.current !== utterance) return;
          utteranceRef.current = null;
          setSpeaking(false);
          callbacks.onEnd?.();
        };
        utterance.onerror = (event) => {
          if (utteranceRef.current !== utterance) return;
          utteranceRef.current = null;
          setSpeaking(false);
          const message = `Speech playback failed: ${event.error}.`;
          setError(message);
          callbacks.onError?.(message);
        };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        return true;
      } catch (cause) {
        const message =
          cause instanceof Error
            ? `Speech playback failed: ${cause.message}`
            : "Speech playback failed.";
        setError(message);
        callbacks.onError?.(message);
        return false;
      }
    },
    [language, stop],
  );

  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";

  return { speaking, supported, error, speak, stop };
}
