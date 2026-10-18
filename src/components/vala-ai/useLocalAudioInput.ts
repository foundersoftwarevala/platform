import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAudioRecorder,
  microphoneCaptureError,
  microphoneEnvironmentError,
} from "./browser-speech";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_RECORDING_MS = 30_000;

export function useLocalAudioInput(
  onAudio: (audio: Blob, signal: AbortSignal) => Promise<void>,
  contextKey: string,
) {
  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0);
  const onAudioRef = useRef(onAudio);
  onAudioRef.current = onAudio;

  const releaseStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const cancelRecording = useCallback(
    (updateState = true) => {
      generation.current++;
      clearTimeout(timer.current);
      uploadAbort.current?.abort();
      uploadAbort.current = null;
      const active = recorder.current;
      recorder.current = null;
      if (active) {
        active.ondataavailable = null;
        active.onstart = null;
        active.onerror = null;
        active.onstop = null;
        if (active.state !== "inactive") active.stop();
      }
      releaseStream();
      if (updateState) {
        setStarting(false);
        setRecording(false);
        setProcessing(false);
      }
    },
    [releaseStream],
  );

  useEffect(() => {
    cancelRecording(false);
    setStarting(false);
    setRecording(false);
    setProcessing(false);
    setError(null);
    return () => cancelRecording(false);
  }, [cancelRecording, contextKey]);

  async function beginRecording() {
    const environmentError = microphoneEnvironmentError();
    if (environmentError) {
      setError(environmentError);
      return;
    }
    const current = ++generation.current;
    setError(null);
    setStarting(true);
    timer.current = setTimeout(() => {
      if (generation.current !== current || recorder.current) return;
      cancelRecording();
      setError(new Error("Microphone access did not start. Check browser permission and retry."));
    }, 10_000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation.current !== current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState !== "live")
        throw new Error("The browser returned no live microphone audio track.");

      const active = createAudioRecorder(stream);
      recorder.current = active;
      const chunks: Blob[] = [];
      let tooLarge = false;
      let bytes = 0;
      active.ondataavailable = (event) => {
        if (!event.data.size || tooLarge) return;
        bytes += event.data.size;
        if (bytes > MAX_AUDIO_BYTES) {
          tooLarge = true;
          if (active.state !== "inactive") active.stop();
          return;
        }
        chunks.push(event.data);
      };
      active.onstart = () => {
        if (recorder.current !== active || generation.current !== current) return;
        clearTimeout(timer.current);
        setStarting(false);
        setRecording(true);
        timer.current = setTimeout(() => {
          if (recorder.current === active && active.state === "recording") active.stop();
        }, MAX_RECORDING_MS);
      };
      active.onerror = () => {
        if (recorder.current !== active) return;
        cancelRecording();
        setError(new Error("Microphone recording failed. Check that the microphone is available."));
      };
      active.onstop = () => {
        clearTimeout(timer.current);
        if (recorder.current !== active || generation.current !== current) return;
        recorder.current = null;
        releaseStream();
        setStarting(false);
        setRecording(false);
        if (tooLarge) {
          setError(new Error("Recording exceeds the 20 MiB limit. Use a shorter recording."));
          return;
        }
        const mimeType = active.mimeType || chunks.find((chunk) => chunk.type)?.type || "";
        if (!mimeType || !chunks.length) {
          setError(new Error("The microphone produced no audio. Record again and speak clearly."));
          return;
        }
        const audio = new Blob(chunks, { type: mimeType });
        if (!audio.size) {
          setError(new Error("The microphone produced an empty recording."));
          return;
        }
        const controller = new AbortController();
        uploadAbort.current = controller;
        setProcessing(true);
        void onAudioRef
          .current(audio, controller.signal)
          .catch((failure: unknown) => {
            if (generation.current === current)
              setError(new Error(microphoneCaptureError(failure)));
          })
          .finally(() => {
            if (uploadAbort.current === controller) uploadAbort.current = null;
            if (generation.current === current) setProcessing(false);
          });
      };
      active.start(1000);
    } catch (failure) {
      if (generation.current !== current) return;
      cancelRecording();
      setError(new Error(microphoneCaptureError(failure)));
    }
  }

  function toggleRecording() {
    setError(null);
    if (starting) {
      cancelRecording();
      return;
    }
    const active = recorder.current;
    if (active?.state === "recording") {
      clearTimeout(timer.current);
      setRecording(false);
      active.stop();
      return;
    }
    if (processing) return;
    void beginRecording();
  }

  return {
    starting,
    recording,
    processing,
    error,
    toggleRecording,
    clearError: () => setError(null),
  };
}
