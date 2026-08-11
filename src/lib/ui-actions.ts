import { toast } from "sonner";

/**
 * Honest feedback for controls whose data source lives in the host system.
 * Never silent: the user always gets a clear, specific response.
 */
export function notifyPending(label: string, detail?: string) {
  toast.info(label, {
    description:
      detail ??
      "This control is wired and will use your existing Software Vala service once its endpoint is connected.",
  });
}

export async function copyToClipboard(text: string, label = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Clipboard permission denied");
  }
}

export function readPref(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(`sv.pref.${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(`sv.pref.${key}`, value);
  } catch {
    /* storage unavailable — preference stays session-only */
  }
}
