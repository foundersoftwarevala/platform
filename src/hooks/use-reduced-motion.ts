import { useEffect, useState } from "react";

let overrideValue: boolean | null = null;
const subscribers = new Set<(value: boolean) => void>();

function getDefaultReducedMotion() {
  if (typeof window === "undefined") return false;

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

export function setReducedMotionOverride(value: boolean | null) {
  overrideValue = value;
  notifySubscribers(getDefaultReducedMotion());
}
