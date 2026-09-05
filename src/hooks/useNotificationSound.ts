import { useCallback, useRef } from 'react';

export type SoundTone = 
  | 'success_chime'
  | 'info_bell'
  | 'pending_tick'
  | 'warning_ping'
  | 'critical_buzzer'
  | 'vip_bell'
  | 'soft_bell'
  | 'low_ping'
  | 'minimal_ping'
  | 'soft_bass_bell'
  | 'golden_vip_bell';

interface SoundConfig {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  harmonics?: number[];
}

const soundConfigs: Record<SoundTone, SoundConfig> = {
  success_chime: { frequency: 880, duration: 0.4, type: 'sine', gain: 0.15, harmonics: [1320, 1760] },
  info_bell: { frequency: 659, duration: 0.3, type: 'sine', gain: 0.12 },
  pending_tick: { frequency: 440, duration: 0.1, type: 'triangle', gain: 0.08 },
  warning_ping: { frequency: 220, duration: 0.5, type: 'sine', gain: 0.18 },
  critical_buzzer: { frequency: 330, duration: 1.5, type: 'sine', gain: 0.12 },
  vip_bell: { frequency: 523, duration: 0.6, type: 'sine', gain: 0.2, harmonics: [784, 1047] },
  soft_bell: { frequency: 587, duration: 0.35, type: 'sine', gain: 0.1 },
  low_ping: { frequency: 294, duration: 0.25, type: 'sine', gain: 0.1 },
  minimal_ping: { frequency: 440, duration: 0.15, type: 'triangle', gain: 0.06 },
  soft_bass_bell: { frequency: 196, duration: 0.5, type: 'sine', gain: 0.15 },
  golden_vip_bell: { frequency: 698, duration: 0.8, type: 'sine', gain: 0.22, harmonics: [880, 1047, 1319] },
};

// Volume multipliers per role (developer gets minimal)
const roleVolumeMultipliers: Record<string, number> = {
  developer: 0.4,
  super_admin: 1.0,
  franchise: 0.8,
  reseller: 0.8,
  support: 0.7,
  seo: 0.7,
  task_manager: 0.7,
  influencer: 0.8,
  client_success: 0.7,
  performance: 0.7,
  finance: 0.8,
  marketing: 0.8,
  demo_manager: 0.7,
  rnd: 0.8,
  legal: 0.7,
  hr: 0.7,
  prime: 1.0,
};

export const useNotificationSound = (userRole: string = 'developer') => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef(false);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((tone: SoundTone) => {
    if (isMutedRef.current) return;

    const config = soundConfigs[tone];
    if (!config) return;

    try {
      const ctx = getAudioContext();
      const volumeMultiplier = roleVolumeMultipliers[userRole] || 0.7;
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(config.gain * volumeMultiplier, ctx.currentTime + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration);

      // Main oscillator
      const osc = ctx.createOscillator();
      osc.type = config.type;
      osc.frequency.setValueAtTime(config.frequency, ctx.currentTime);
      osc.connect(masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + config.duration);

      // Harmonics for richer sound
      if (config.harmonics) {
        config.harmonics.forEach((freq, i) => {
          const harmGain = ctx.createGain();
          harmGain.connect(ctx.destination);
          harmGain.gain.setValueAtTime(0, ctx.currentTime);
          harmGain.gain.linearRampToValueAtTime((config.gain * volumeMultiplier) / (i + 2), ctx.currentTime + 0.02);
          harmGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration * 0.8);

          const harmOsc = ctx.createOscillator();
          harmOsc.type = 'sine';
          harmOsc.frequency.setValueAtTime(freq, ctx.currentTime);
          harmOsc.connect(harmGain);
          harmOsc.start(ctx.currentTime);
          harmOsc.stop(ctx.currentTime + config.duration);
        });
      }
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  }, [getAudioContext, userRole]);

  const playSuccess = useCallback(() => playTone('success_chime'), [playTone]);
  const playInfo = useCallback(() => playTone('info_bell'), [playTone]);
  const playWarning = useCallback(() => playTone('warning_ping'), [playTone]);
  const playCritical = useCallback(() => playTone('critical_buzzer'), [playTone]);
  const playVIP = useCallback(() => playTone('vip_bell'), [playTone]);
  const playGoldenVIP = useCallback(() => playTone('golden_vip_bell'), [playTone]);
  const playSoftBell = useCallback(() => playTone('soft_bell'), [playTone]);
  const playMinimalPing = useCallback(() => playTone('minimal_ping'), [playTone]);
  const playLowPing = useCallback(() => playTone('low_ping'), [playTone]);

  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
  }, []);

  return {
    playTone,
    playSuccess,
    playInfo,
    playWarning,
    playCritical,
    playVIP,
    playGoldenVIP,
    playSoftBell,
    playMinimalPing,
    playLowPing,
    setMuted,
  };
};

export default useNotificationSound;
