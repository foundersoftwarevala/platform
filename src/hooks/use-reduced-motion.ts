import { useEffect, useState } from "react";

/**
 * Reduced motion: the operating system's setting, or the person's own choice
 * in the sound and motion settings. The choice is kept in this browser, so it
 * still holds after a reload; before, it lasted only until the page changed.
 */
const STORAGE_KEY = "ams.motion.reduced";

let overrideValue: boolean | null = null;
let overrideLoaded = false;
const subscribers = new Set<(value: boolean) => void>();

function loadOverride() {
  if (overrideLoaded || typeof window === "undefined") return;
  overrideLoaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "1") overrideValue = true;
  } catch {
    /* storage unavailable: the system setting decides */
  }
}

function getDefaultReducedMotion() {
  if (typeof window === "undefined") return false;

  loadOverride();
  if (overrideValue !== null) return overrideValue;
  const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  return query?.matches ?? false;
}

function notifySubscribers(value: boolean) {
  subscribers.forEach((subscriber) => subscriber(value));
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => getDefaultReducedMotion());

  useEffect(() => {
    const onChange = () => setReduced(getDefaultReducedMotion());
    subscribers.add(onChange);

    const mediaQuery = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const listener = () => onChange();
    mediaQuery?.addEventListener("change", listener);

    setReduced(getDefaultReducedMotion());

    return () => {
      subscribers.delete(onChange);
      mediaQuery?.removeEventListener("change", listener);
    };
  }, []);

  return reduced;
}

/** Outside React (the claim-confetti helper, say), the same answer. */
export function prefersReducedMotion() {
  return getDefaultReducedMotion();
}

export function setReducedMotionOverride(value: boolean | null) {
  loadOverride();
  overrideValue = value;
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* not persisted; still applies for this visit */
  }
  notifySubscribers(getDefaultReducedMotion());
}
