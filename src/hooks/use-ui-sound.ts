import { useCallback, useEffect, useState } from "react";
import {
  getSoundPrefs, setSoundPrefs, subscribeSoundPrefs, playSound,
  type SoundPrefs, type UiSound,
} from "@/lib/ams/ui-sound";

/**
 * Reactive access to the enterprise UI sound system.
 * SSR-safe: preferences are read after hydration.
 */
export function useUiSound() {
  const [prefs, setPrefs] = useState<SoundPrefs>({ enabled: true, volume: 0.6 });

  useEffect(() => {
    setPrefs(getSoundPrefs());
    const unsub = subscribeSoundPrefs(setPrefs);
    return () => { unsub(); };
  }, []);

  const play = useCallback((name: UiSound) => playSound(name), []);

  const setEnabled = useCallback((enabled: boolean) => {
    setSoundPrefs({ enabled });
    if (enabled) playSound("toggle");
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSoundPrefs({ volume });
  }, []);

  return { prefs, play, setEnabled, setVolume };
}

export type { UiSound };
