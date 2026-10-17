export function microphoneEnvironmentError(): Error | null {
  if (typeof window === "undefined") return new Error("Microphone access requires a browser.");
  if (window.isSecureContext === false)
    return new Error("Microphone access requires HTTPS or a secure localhost origin.");
  const page: Document & {
    permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
    featurePolicy?: { allowsFeature: (feature: string) => boolean };
  } = window.document;
  const policy = page.permissionsPolicy ?? page.featurePolicy;
  if (policy && !policy.allowsFeature("microphone"))
    return new Error(
      'Microphone access is blocked by page or iframe policy. The parent must allow microphone access, including allow="microphone" on an embedded frame.',
    );
  if (typeof navigator.mediaDevices?.getUserMedia !== "function")
    return new Error("This browser does not provide microphone capture.");
  if (typeof MediaRecorder !== "function")
    return new Error("This browser does not support local audio recording.");
  return null;
}

export function createAudioRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

export function microphoneCaptureError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError")
    return "Microphone capture was denied. Check permission for this origin and browser profile, and Windows microphone privacy settings.";
  if (error instanceof DOMException && error.name === "NotFoundError")
    return "No microphone was found. Connect or select an audio input and try again.";
  if (error instanceof DOMException && error.name === "NotReadableError")
    return "The microphone is in use or unavailable to this browser.";
  if (error instanceof Error) return error.message;
  return String(error);
}
