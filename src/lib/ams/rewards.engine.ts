// AMS Rewards Engine — central ledger for XP, coins, tokens, award unlocks.
//
// Any mission / quest / achievement completion pipes through `grant()`.
// Subscribers (UI wallets, toasts, celebration overlays) read via getState()
// or subscribe(). In-memory today; swap the store for Supabase later without
// touching call sites.

export interface RewardPayload {
  xp?: number;
  coins?: number;
  tokens?: number;
  awardIds?: string[];   // award ids to unlock
  reason?: string;       // human-readable source (e.g. "mission:daily-login")
  actor?: string;        // user id — defaults to "me"
}

export interface LedgerEntry extends Required<Omit<RewardPayload, "awardIds">> {
  id: string;
  at: string;
  awardIds: string[];
}

export interface WalletState {
  xp: number;
  coins: number;
  tokens: number;
  unlockedAwardIds: Set<string>;
  ledger: LedgerEntry[];
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

let STATE: WalletState = {
  xp: 0,
  coins: 0,
  tokens: 0,
  unlockedAwardIds: new Set(),
  ledger: [],
};

type Listener = (s: WalletState) => void;
const listeners = new Set<Listener>();
function emit() { for (const fn of listeners) fn(STATE); }

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getWallet(): WalletState { return STATE; }

export function grant(p: RewardPayload): LedgerEntry {
  const entry: LedgerEntry = {
    id: uid(),
    at: new Date().toISOString(),
    xp: p.xp ?? 0,
    coins: p.coins ?? 0,
    tokens: p.tokens ?? 0,
    awardIds: p.awardIds ?? [],
    reason: p.reason ?? "manual",
    actor: p.actor ?? "me",
  };
  const unlocked = new Set(STATE.unlockedAwardIds);
  for (const id of entry.awardIds) unlocked.add(id);
  STATE = {
    xp: STATE.xp + entry.xp,
    coins: STATE.coins + entry.coins,
    tokens: STATE.tokens + entry.tokens,
    unlockedAwardIds: unlocked,
    ledger: [entry, ...STATE.ledger].slice(0, 500),
  };
  emit();
  return entry;
}

export function resetWallet() {
  STATE = { xp: 0, coins: 0, tokens: 0, unlockedAwardIds: new Set(), ledger: [] };
  emit();
}
