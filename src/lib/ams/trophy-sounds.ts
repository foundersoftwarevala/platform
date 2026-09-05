// Procedural unlock sounds. No assets required — WebAudio synth per tier.
// Each preset uses a distinct waveform, chord and envelope so every stage
// truly sounds different.

export type UnlockPreset =
  | "starter" | "bronze" | "silver" | "gold" | "diamond"
  | "elite" | "legend" | "master" | "founder";

const PRESETS: Record<UnlockPreset, {
  freqs: number[]; type: OscillatorType; duration: number; gain: number; sweep?: number;
}> = {
  starter: { freqs: [523.25, 659.25], type: "triangle", duration: 0.35, gain: 0.10 },
  bronze:  { freqs: [329.63, 415.30, 523.25], type: "sine", duration: 0.55, gain: 0.12 },
  silver:  { freqs: [440, 554.37, 659.25], type: "triangle", duration: 0.7, gain: 0.13, sweep: 200 },
  gold:    { freqs: [523.25, 659.25, 783.99, 1046.5], type: "sine", duration: 1.1, gain: 0.14, sweep: 300 },
  diamond: { freqs: [659.25, 830.61, 987.77, 1318.5], type: "sine", duration: 1.3, gain: 0.15, sweep: 420 },
  elite:   { freqs: [392, 523.25, 659.25, 987.77], type: "sawtooth", duration: 1.4, gain: 0.10, sweep: 260 },
  legend:  { freqs: [261.63, 329.63, 392, 523.25, 659.25, 783.99], type: "triangle", duration: 1.8, gain: 0.13, sweep: 380 },
  master:  { freqs: [349.23, 440, 523.25, 659.25, 880], type: "sine", duration: 1.9, gain: 0.15, sweep: 500 },
  founder: { freqs: [261.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.5], type: "sine", duration: 2.6, gain: 0.17, sweep: 640 },
};

let ctx: AudioContext | null = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function playUnlock(preset: UnlockPreset) {
  const ac = getCtx();
  if (!ac) return;
  const cfg = PRESETS[preset];
  const now = ac.currentTime;

  // Master bus with soft reverb-ish delay
  const master = ac.createGain();
  master.gain.value = cfg.gain;
  master.connect(ac.destination);
  const delay = ac.createDelay(0.4);
  delay.delayTime.value = 0.14;
  const feedback = ac.createGain();
  feedback.gain.value = 0.22;
  delay.connect(feedback).connect(delay);
  const wet = ac.createGain();
  wet.gain.value = 0.35;
  master.connect(delay).connect(wet).connect(ac.destination);

  cfg.freqs.forEach((f, i) => {
    const t = now + i * 0.06;
    const o = ac.createOscillator();
    o.type = cfg.type;
    o.frequency.value = f;
    if (cfg.sweep) o.frequency.exponentialRampToValueAtTime(f + cfg.sweep, t + cfg.duration * 0.6);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + cfg.duration);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + cfg.duration + 0.05);
  });

  // Metallic shimmer top layer for premium tiers
  if (["gold","diamond","elite","legend","master","founder"].includes(preset)) {
    const noise = ac.createBufferSource();
    const buffer = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    noise.buffer = buffer;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = preset === "founder" ? 6000 : 4500;
    bp.Q.value = 8;
    const ng = ac.createGain();
    ng.gain.value = 0.06;
    noise.connect(bp).connect(ng).connect(master);
    noise.start(now);
  }
}
