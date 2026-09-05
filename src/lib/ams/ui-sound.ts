/**
 * Enterprise UI Sound System
 * ---------------------------------------------------------------
 * One unified, procedural sound language for the AMS Manager.
 * No audio assets: every cue is synthesised with WebAudio so the
 * palette stays consistent, tiny and instant.
 *
 * Design rules: soft, short, professional. Nothing game-like.
 * Users can mute or set volume; preferences persist locally.
 */

export type UiSound =
  | "click" | "toggle" | "checkbox" | "switch" | "dropdown"
  | "notification" | "mention" | "success" | "warning" | "error"
  | "approval" | "rejection" | "save" | "publish" | "archive"
  | "delete" | "uploadComplete" | "downloadComplete"
  | "importComplete" | "exportComplete"
  | "ai" | "message" | "announcement" | "reminder"
  | "achievement" | "reward" | "badge" | "trophy" | "verified";

type Voice = {
  /** note frequencies in Hz, played as a short arpeggio */
  notes: number[];
  type?: OscillatorType;
  /** per-note length in seconds */
  dur?: number;
  /** gap between notes in seconds */
  step?: number;
  /** relative loudness (0-1) */
  gain?: number;
  /** subtle upward/downward glide in Hz */
  sweep?: number;
  /** airy noise transient for "premium" cues */
  air?: number;
};

const A = 440;
const n = (semi: number) => A * Math.pow(2, semi / 12);

const VOICES: Record<UiSound, Voice> = {
  // --- primitives: extremely short, near-subliminal ---
  click:      { notes: [n(4)], type: "sine", dur: 0.045, gain: 0.05 },
  toggle:     { notes: [n(2), n(9)], type: "sine", dur: 0.05, step: 0.035, gain: 0.05 },
  checkbox:   { notes: [n(7), n(12)], type: "triangle", dur: 0.05, step: 0.03, gain: 0.05 },
  switch:     { notes: [n(0), n(7)], type: "sine", dur: 0.055, step: 0.035, gain: 0.05 },
  dropdown:   { notes: [n(9)], type: "sine", dur: 0.05, gain: 0.04, sweep: -60 },

  // --- feedback ---
  success:    { notes: [n(4), n(9), n(16)], type: "sine", dur: 0.16, step: 0.06, gain: 0.07, air: 0.02 },
  warning:    { notes: [n(2), n(2)], type: "triangle", dur: 0.13, step: 0.13, gain: 0.06 },
  error:      { notes: [n(1), n(-4)], type: "sine", dur: 0.18, step: 0.09, gain: 0.07 },
  approval:   { notes: [n(7), n(12), n(19)], type: "sine", dur: 0.15, step: 0.055, gain: 0.07, air: 0.02 },
  rejection:  { notes: [n(5), n(0), n(-3)], type: "sine", dur: 0.15, step: 0.06, gain: 0.06 },

  // --- workflow ---
  save:       { notes: [n(9), n(14)], type: "sine", dur: 0.12, step: 0.05, gain: 0.06 },
  publish:    { notes: [n(4), n(11), n(16), n(23)], type: "sine", dur: 0.16, step: 0.05, gain: 0.07, air: 0.03 },
  archive:    { notes: [n(4), n(-1)], type: "triangle", dur: 0.14, step: 0.06, gain: 0.05 },
  delete:     { notes: [n(0), n(-5)], type: "triangle", dur: 0.16, step: 0.07, gain: 0.06 },

  uploadComplete:   { notes: [n(2), n(9), n(14)], type: "sine", dur: 0.12, step: 0.05, gain: 0.06 },
  downloadComplete: { notes: [n(14), n(9), n(4)], type: "sine", dur: 0.12, step: 0.05, gain: 0.06 },
  importComplete:   { notes: [n(0), n(7), n(12)], type: "sine", dur: 0.12, step: 0.05, gain: 0.06 },
  exportComplete:   { notes: [n(12), n(7), n(2)], type: "sine", dur: 0.12, step: 0.05, gain: 0.06 },

  // --- communication ---
  notification:  { notes: [n(12), n(16)], type: "sine", dur: 0.13, step: 0.06, gain: 0.06, air: 0.015 },
  mention:       { notes: [n(9), n(16), n(21)], type: "sine", dur: 0.12, step: 0.05, gain: 0.07, air: 0.02 },
  message:       { notes: [n(7), n(12)], type: "sine", dur: 0.1, step: 0.045, gain: 0.05 },
  announcement:  { notes: [n(4), n(9), n(11), n(16)], type: "sine", dur: 0.14, step: 0.055, gain: 0.06, air: 0.02 },
  reminder:      { notes: [n(9), n(7)], type: "triangle", dur: 0.14, step: 0.07, gain: 0.05 },
  ai:            { notes: [n(11), n(18)], type: "sine", dur: 0.2, step: 0.07, gain: 0.05, sweep: 90, air: 0.02 },

  // --- recognition (still restrained: premium, not arcade) ---
  achievement: { notes: [n(4), n(11), n(16), n(20)], type: "sine", dur: 0.18, step: 0.06, gain: 0.08, air: 0.03 },
  reward:      { notes: [n(7), n(12), n(19)], type: "sine", dur: 0.18, step: 0.06, gain: 0.07, air: 0.03 },
  badge:       { notes: [n(9), n(14), n(21)], type: "sine", dur: 0.18, step: 0.06, gain: 0.07, air: 0.03 },
  trophy:      { notes: [n(4), n(11), n(16), n(23), n(28)], type: "sine", dur: 0.2, step: 0.06, gain: 0.08, air: 0.04 },
  verified:    { notes: [n(12), n(19), n(24)], type: "sine", dur: 0.16, step: 0.05, gain: 0.07, air: 0.03 },
};

/* ---------------------------------------------------------------- */
/* Preferences                                                      */
/* ---------------------------------------------------------------- */

export type SoundPrefs = { enabled: boolean; volume: number };

const STORAGE_KEY = "ams.sound.prefs";
const DEFAULTS: SoundPrefs = { enabled: true, volume: 0.6 };

let prefs: SoundPrefs = { ...DEFAULTS };
let loaded = false;
const listeners = new Set<(p: SoundPrefs) => void>();

function load(): SoundPrefs {
  if (loaded || typeof window === "undefined") return prefs;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SoundPrefs>;
      prefs = {
        enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULTS.enabled,
        volume: typeof parsed.volume === "number" ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULTS.volume,
      };
    }
  } catch {
    /* storage unavailable — fall back to defaults, never break the UI */
  }
  return prefs;
}

export function getSoundPrefs(): SoundPrefs {
  return load();
}

export function setSoundPrefs(next: Partial<SoundPrefs>) {
  prefs = { ...load(), ...next };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(prefs));
}

export function subscribeSoundPrefs(fn: (p: SoundPrefs) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------------------------------------------------------------- */
/* Engine                                                           */
/* ---------------------------------------------------------------- */

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;

function audio(): { ac: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      bus = ctx.createGain();
      // gentle low-pass keeps every cue soft and non-piercing
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 7200;
      bus.connect(lp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return bus ? { ac: ctx, out: bus } : null;
  } catch {
    return null;
  }
}

/** Play a UI cue. Silent when muted, unsupported or reduced-motion-quiet. */
export function playSound(name: UiSound) {
  const p = load();
  if (!p.enabled || p.volume <= 0) return;
  const a = audio();
  if (!a) return;

  const v = VOICES[name];
  const now = a.ac.currentTime;
  const dur = v.dur ?? 0.12;
  const step = v.step ?? 0.05;
  const level = (v.gain ?? 0.06) * p.volume;

  a.out.gain.setTargetAtTime(1, now, 0.01);

  v.notes.forEach((f, i) => {
    const t = now + i * step;
    const osc = a.ac.createOscillator();
    osc.type = v.type ?? "sine";
    osc.frequency.setValueAtTime(f, t);
    if (v.sweep) osc.frequency.linearRampToValueAtTime(Math.max(60, f + v.sweep), t + dur);
    const g = a.ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(a.out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  });

  if (v.air) {
    const len = Math.floor(a.ac.sampleRate * 0.18);
    const buffer = a.ac.createBuffer(1, len, a.ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = a.ac.createBufferSource();
    src.buffer = buffer;
    const bp = a.ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 5200;
    bp.Q.value = 6;
    const g = a.ac.createGain();
    g.gain.value = v.air * p.volume;
    src.connect(bp).connect(g).connect(a.out);
    src.start(now);
  }
}
