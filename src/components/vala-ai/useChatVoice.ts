import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useLocalAudioInput } from "./useLocalAudioInput";

export function useChatVoice(onTranscript: (text: string) => Promise<string>, contextKey: string) {
  const [processing, setProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [outputEnabled, setOutputEnabled] = useState(true);
  const outputAllowed = useRef(true);
  const [playbackError, setPlaybackError] = useState<Error | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const stopOutput = useCallback(() => {
    clearTimeout(timer.current);
    if (utterance.current) {
      utterance.current.onend = null;
      utterance.current.onerror = null;
      utterance.current.onstart = null;
      window.speechSynthesis.cancel();
      utterance.current = null;
    }
    setSpeaking(false);
  }, []);

  useEffect(() => {
    const current = generation.current + 1;
    generation.current = current;
    setProcessing(false);
    setSpeaking(false);
    setPlaybackError(null);
    return () => {
      generation.current = current + 1;
      clearTimeout(timer.current);
      if (utterance.current) {
        utterance.current.onend = null;
        utterance.current.onerror = null;
        utterance.current.onstart = null;
        window.speechSynthesis.cancel();
        utterance.current = null;
      }
    };
  }, [contextKey]);

  const respond = useCallback(
    async (audio: Blob, signal: AbortSignal) => {
      const current = generation.current;
      try {
        setProcessing(true);
        setPlaybackError(null);
        const form = new FormData();
        form.append(
          "audio",
          audio,
          audio.type.includes("webm") ? "recording.webm" : "recording.audio",
        );
        const transcription = await api<{ text: string }>("/voice/transcribe-audio", {
          method: "POST",
          body: form,
          signal,
        });
        if (signal.aborted || current !== generation.current) return;
        const transcript = transcription.text.trim();
        if (!transcript) throw new Error("Local Whisper returned an empty transcript.");
        const reply = await onTranscriptRef.current(transcript);
        if (current !== generation.current || !outputAllowed.current) return;
        if (typeof window.speechSynthesis !== "object")
          throw new Error("Speech playback is not supported in this browser.");
        const playback = await api<{ text: string; lang: string }>("/voice/speak", {
          method: "POST",
          body: { text: reply },
          signal,
        });
        if (current !== generation.current || !outputAllowed.current) return;
        if (typeof playback.text !== "string" || !playback.text.trim())
          throw new Error("Jarvis returned no speech text.");
        const speech = new SpeechSynthesisUtterance(playback.text);
        speech.lang = playback.lang;
        stopOutput();
        utterance.current = speech;
        speech.onstart = () => {
          clearTimeout(timer.current);
          setSpeaking(true);
        };
        speech.onend = () => {
          clearTimeout(timer.current);
          utterance.current = null;
          setSpeaking(false);
        };
        speech.onerror = (event) => {
          clearTimeout(timer.current);
          utterance.current = null;
          setSpeaking(false);
          setPlaybackError(new Error(`Speech playback failed: ${event.error}.`));
        };
        timer.current = setTimeout(() => {
          stopOutput();
          setPlaybackError(
            new Error("Speech playback did not start. Check browser voices and audio output."),
          );
        }, 10_000);
        window.speechSynthesis.speak(speech);
      } catch (failure) {
        if (current === generation.current)
          setPlaybackError(failure instanceof Error ? failure : new Error(String(failure)));
      } finally {
        if (current === generation.current) setProcessing(false);
      }
    },
    [stopOutput],
  );

  const capture = useLocalAudioInput(respond, contextKey);

  return {
    starting: capture.starting,
    listening: capture.recording,
    processing: capture.processing || processing,
    speaking,
    outputEnabled,
    error: capture.error ?? playbackError,
    toggleMic: capture.toggleRecording,
    clearError: () => {
      capture.clearError();
      setPlaybackError(null);
    },
    toggleOutput: () => {
      stopOutput();
      outputAllowed.current = !outputAllowed.current;
      setOutputEnabled(outputAllowed.current);
    },
  };
}
