/**
 * EXEC SIGNALS — real, in-session signal store for the Executive Productivity Panel.
 * Only records things that actually happened (user actions, resolved items, saved notes).
 * No synthetic/random values are ever produced here.
 */

import { useSyncExternalStore } from "react";

export interface ExecAction {
  id: string;
  label: string;
  detail: string;
  at: number;
  kind: "approval" | "task" | "note" | "test" | "nav" | "import";
}

interface ExecState {
  sessionStart: number;
  actions: ExecAction[];
  notes: string;
}

const NOTES_KEY = "sv.exec.notes.v1";

let state: ExecState = { sessionStart: Date.now(), actions: [], notes: "" };
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(NOTES_KEY);
    if (raw) {
      state = { ...state, notes: raw };
      emit();
    }
  } catch {
    /* ignore */
  }
}

export function logExecAction(kind: ExecAction["kind"], label: string, detail = "") {
  state = {
    ...state,
    actions: [
      { id: `${Date.now()}-${state.actions.length}`, kind, label, detail, at: Date.now() },
      ...state.actions,
    ].slice(0, 40),
  };
  emit();
}

export function saveExecNotes(notes: string) {
  state = { ...state, notes };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(NOTES_KEY, notes);
    } catch {
      /* ignore */
    }
  }
  emit();
}

function subscribe(cb: () => void) {
  hydrate();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useExecSignals(): ExecState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
