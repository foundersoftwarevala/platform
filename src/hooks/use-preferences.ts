import { useCallback, useEffect, useState } from "react";

export interface Preferences {
  theme: "dark" | "light";
  sound: boolean;
  reducedMotion: boolean;
  autoTranslate: boolean;
  language: string;
  density: "comfortable" | "compact";
  enterToSend: boolean;
}

const DEFAULTS: Preferences = {
  theme: "dark",
  sound: true,
  reducedMotion: false,
  autoTranslate: false,
  language: "hi",
  density: "comfortable",
  enterToSend: true,
};

const KEY = "vala.chat.preferences";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ar", label: "العربية" },
  { code: "ja", label: "日本語" },
];

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) });
    } catch {
      /* ignore malformed local settings */
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
    document.documentElement.dataset["motion"] = prefs.reducedMotion ? "reduced" : "full";
  }, [prefs.theme, prefs.reducedMotion]);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return { prefs, update };
}

let audioContext: AudioContext | null = null;

/** Short synthesised cue — no asset download, respects the sound preference. */
export function playCue(kind: "incoming" | "sent", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.value = kind === "incoming" ? 660 : 880;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);
    osc.connect(gain).connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.24);
  } catch {
    /* audio blocked */
  }
}
