import { useCallback, useEffect, useState } from "react";

import { getCurrentLanguage } from "@/lib/i18n/language-service";
import { getLanguage, normalizeLanguageCode } from "@/lib/i18n/registry";

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
  // Replaced on load by the stored choice, or the site's language.
  language: "en",
  density: "comfortable",
  enterToSend: true,
};

const KEY = "vala.chat.preferences";

/** Languages offered for chat translation. Codes and labels come from the language registry. */
const CHAT_LANGUAGE_CODES = ["en", "hi", "mr", "ta", "es", "fr", "de", "ar", "ja"];

export const LANGUAGES = CHAT_LANGUAGE_CODES.map((code) => ({
  code,
  label: getLanguage(code)?.nativeName ?? code,
}));

/** A stored chat language, if it is still a language this dialog offers. */
function chatLanguage(value: unknown): string | null {
  const code = typeof value === "string" ? normalizeLanguageCode(value) : null;
  return code && CHAT_LANGUAGE_CODES.includes(code) ? code : null;
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    let stored: Partial<Preferences> = {};
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) stored = JSON.parse(raw) as Partial<Preferences>;
    } catch {
      /* ignore malformed local settings */
    }
    // No separate language state: without a valid chat choice, chat follows
    // the language the site is shown in.
    const language = chatLanguage(stored.language) ?? chatLanguage(getCurrentLanguage()) ?? DEFAULTS.language;
    setPrefs({ ...DEFAULTS, ...stored, language });
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
