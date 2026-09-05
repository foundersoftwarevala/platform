// Cinematic WebAudio celebration sounds — no asset files needed.
// Premium award orchestra, crystal chimes, fanfares, crown stings.

let ctx: AudioContext | null = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Wave = OscillatorType;
function tone(freq: number, start: number, dur: number, gain = 0.18, type: Wave = "triangle", detune = 0) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (detune) osc.detune.setValueAtTime(detune, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(start: number, dur: number, gain = 0.12, freq = 800, q = 8) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const filt = ac.createBiquadFilter(); filt.type = "bandpass"; filt.frequency.value = freq; filt.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(g).connect(ac.destination);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

// Crystal "ting" — UI hover
export function playCoin() {
  tone(1760, 0, 0.18, 0.07, "triangle");
  tone(2637, 0.02, 0.22, 0.05, "sine");
}

// Coin drop — bright metallic
export function playCoinDrop() {
  [1320, 1760, 2349, 1976].forEach((f, i) => tone(f, i * 0.05, 0.2, 0.08, "triangle"));
  noise(0, 0.25, 0.06, 4000, 12);
}

// Triumphant win arpeggio (general achievement)
export function playWin() {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  notes.forEach((f, i) => tone(f, i * 0.07, 0.35, 0.16, "triangle"));
  tone(2093, 0.42, 0.45, 0.09, "sine");
  tone(2637, 0.5, 0.5, 0.07, "sine");
  tone(110, 0, 0.25, 0.18, "sine");
}

// Soft trophy unveil whoosh + bell
export function playUnveil() {
  noise(0, 0.5, 0.08, 600, 2);
  tone(330, 0, 0.4, 0.12, "sine");
  tone(660, 0.08, 0.5, 0.14, "triangle");
  tone(1320, 0.18, 0.7, 0.1, "sine");
}

// LEVEL UP — rising sweep + sparkle
export function playLevelUp() {
  const ac = getCtx(); if (!ac) return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator(); const g = ac.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, t0);
  osc.frequency.exponentialRampToValueAtTime(1760, t0 + 0.55);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.12, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
  osc.connect(g).connect(ac.destination); osc.start(t0); osc.stop(t0 + 0.65);
  [1318, 1760, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.45 + i * 0.04, 0.3, 0.07, "sine"));
}

// CROWN / RANK UP — orchestra hit + bell choir
export function playRankUp() {
  // Sub thump
  tone(82.4, 0, 0.5, 0.22, "sine");
  tone(164.8, 0, 0.45, 0.16, "triangle");
  // Brass-like chord (C major)
  [261.63, 329.63, 392, 523.25].forEach((f) => {
    tone(f, 0.05, 0.9, 0.1, "sawtooth", -8);
    tone(f, 0.05, 0.9, 0.1, "sawtooth", +8);
  });
  // Bell cascade
  [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.5 + i * 0.08, 0.7, 0.09, "sine"));
  noise(0, 0.3, 0.1, 3000, 6);
}

// FIREWORKS — multiple bursts
export function playFireworks() {
  for (let i = 0; i < 4; i++) {
    const t = i * 0.35;
    noise(t, 0.08, 0.18, 200, 1); // boom
    noise(t + 0.05, 0.5, 0.06, 6000, 14); // crackle
    tone(80, t, 0.2, 0.2, "sine");
  }
}

// DIAMOND chime — bright crystal cascade
export function playDiamond() {
  [2637, 3136, 3520, 4186, 3520, 3136].forEach((f, i) => tone(f, i * 0.05, 0.4, 0.06, "sine"));
  noise(0, 0.6, 0.04, 8000, 16);
}

// MYTHIC / Founder — deep gong + choir shimmer
export function playMythic() {
  tone(55, 0, 1.4, 0.28, "sine");
  tone(110, 0, 1.2, 0.18, "sine");
  tone(220, 0.02, 1.0, 0.12, "triangle");
  [523, 659, 784, 988, 1175].forEach((f, i) => tone(f, 0.3 + i * 0.12, 1.0, 0.08, "sine"));
  noise(0, 1.4, 0.05, 1200, 4);
}

/**
 * Awarding a certificate: a short rising figure with a soft seal underneath,
 * quieter than a trophy so it reads as formal rather than celebratory.
 */
export function playCertificate() {
  [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.09, "sine"));
  tone(392, 0.28, 0.7, 0.06, "triangle");
  noise(0.26, 0.5, 0.03, 900, 3);
}

// Random surprise for logo clicks
export function playRandom() {
  const fns = [playCoinDrop, playLevelUp, playRankUp, playDiamond, playFireworks];
  fns[Math.floor(Math.random() * fns.length)]();
}
