export interface WindowCapture {
  stream: MediaStream;
  stop: () => void;
}

const BLUE = "#0000FF";
const MAX_FRAME_RATE = 20;
const MAX_RECORDING_BYTES = 128 * 1024 * 1024;

export async function captureWindowWithBlueMask(): Promise<WindowCapture> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("This browser does not support secure window capture.");
  }

  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "window" },
    audio: false,
  });
  const sourceTrack = displayStream.getVideoTracks()[0];
  if (!sourceTrack || sourceTrack.getSettings().displaySurface !== "window") {
    displayStream.getTracks().forEach((track) => track.stop());
    throw new Error("Window-only capture is not confirmed by the browser; sharing was stopped.");
  }

  const width = sourceTrack.getSettings().width ?? 1280;
  const height = sourceTrack.getSettings().height ?? 720;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = displayStream;
  try {
    await video.play();
  } catch (error) {
    displayStream.getTracks().forEach((track) => track.stop());
    throw new Error("The captured window could not be rendered for privacy masking.", { cause: error });
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.min(width, 1920);
  canvas.height = Math.min(height, 1080);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    displayStream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    throw new Error("Could not create the privacy mask canvas.");
  }

  let animationFrame = 0;
  const draw = () => {
    context.fillStyle = BLUE;
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const drawWidth = video.videoWidth * scale;
      const drawHeight = video.videoHeight * scale;
      context.drawImage(
        video,
        (canvas.width - drawWidth) / 2,
        (canvas.height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
    }
    animationFrame = requestAnimationFrame(draw);
  };
  draw();

  const stream = canvas.captureStream(MAX_FRAME_RATE);
  if (stream.getVideoTracks().length !== 1 || stream.getAudioTracks().length !== 0) {
    cancelAnimationFrame(animationFrame);
    stream.getTracks().forEach((track) => track.stop());
    displayStream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    throw new Error("The privacy-masked stream could not be verified.");
  }

  sourceTrack.addEventListener(
    "ended",
    () => stream.getTracks().forEach((track) => track.stop()),
    { once: true },
  );

  return {
    stream,
    stop: () => {
      cancelAnimationFrame(animationFrame);
      stream.getTracks().forEach((track) => track.stop());
      displayStream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    },
  };
}

export interface MaskedRecording {
  stop: () => Promise<void>;
}

export function recordMaskedStream(stream: MediaStream, sessionId: string): MaskedRecording {
  if (stream.getAudioTracks().length) {
    throw new Error("Assist recordings must contain only the masked video stream.");
  }
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  let recordedBytes = 0;
  let overflow = false;
  recorder.addEventListener("dataavailable", (event) => {
    if (!event.data.size) return;
    recordedBytes += event.data.size;
    if (recordedBytes > MAX_RECORDING_BYTES) {
      overflow = true;
      if (recorder.state !== "inactive") recorder.stop();
      return;
    }
    chunks.push(event.data);
  });

  const complete = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener(
      "stop",
      () => {
        if (overflow) {
          reject(new Error("The recording exceeded the 128 MB safety limit."));
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (!blob.size) {
          reject(new Error("The recording was empty."));
          return;
        }
        resolve(blob);
      },
      { once: true },
    );
    recorder.addEventListener(
      "error",
      () => reject(new Error("The browser could not record the masked stream.")),
      { once: true },
    );
  });
  let upload: Promise<void> | undefined;
  recorder.start(5000);

  return {
    stop: () => {
      if (upload) return upload;
      if (recorder.state !== "inactive") recorder.stop();
      upload = complete.then(async (blob) => {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Sign in again to upload the session recording.");
        const response = await fetch("/api/assist/recording", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": blob.type,
            "X-Assist-Session-Id": sessionId,
          },
          body: blob,
        });
        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(result?.error ?? "The recording could not be saved.");
        }
      });
      return upload;
    },
  };
}
