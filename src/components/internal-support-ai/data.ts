/**
 * Internal Support AI - live data sources.
 *
 * Every figure on the Internal Support AI screens comes from one of these
 * reads. Nothing is invented: where the platform records nothing for a
 * figure, the screens say "Not tracked" instead of drawing a number.
 *
 *   support_tickets / support_escalations  - browser client, RLS is_crm_staff
 *   error_events / ai_decision_logs        - manager data server functions
 *                                            (admin / boss; service-role read)
 *   founder_healing_* views                - loadHealingBoard (boss / admin)
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import {
  loadHealingBoard,
  type HealingBoard,
  type TimelineRow,
} from "@/lib/founder/healing/healing.functions";
import { isAccessError, useRecords, type Row } from "@/lib/manager-queries";

export type { HealingBoard, TimelineRow, Row };

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error)
    return String((error as { message: unknown }).message);
  return String(error ?? "Unknown error");
}

/** Signed out or not permitted: retrying can never succeed. */
export function isDenied(error: unknown): boolean {
  return (
    isAccessError(error) ||
    /sign-in required|permission required|permission denied|row-level security/i.test(
      errorText(error),
    )
  );
}

/** At most two retries, none for access failures, no refetch storms. */
const READ_POLICY = {
  staleTime: 30_000,
  retry: (failureCount: number, error: unknown) => !isDenied(error) && failureCount < 2,
  retryDelay: (attempt: number) => Math.min(1_000 * 2 ** (attempt + 1), 8_000),
  retryOnMount: false,
  refetchOnWindowFocus: false,
} as const;

// support_tickets / support_escalations are not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface SupportTicketRow {
  id: string;
  reference: string | null;
  subject: string | null;
  category: string | null;
  priority: string | null;
  status: string | null;
  channel: string | null;
  customer_id: string | null;
  sla_minutes_remaining: number | null;
  sla_breached: boolean | null;
  first_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SupportEscalationRow {
  id: string;
  ticket_id: string | null;
  reference: string | null;
  reason: string | null;
  level: number | null;
  status: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export const TICKET_LIMIT = 500;
export const ERROR_EVENT_LIMIT = 500;

export function useSupportTickets() {
  return useQuery({
    queryKey: ["internal-support-ai", "support_tickets"],
    ...READ_POLICY,
    queryFn: async (): Promise<SupportTicketRow[]> => {
      const { data, error } = await db
        .from("support_tickets")
        .select(
          "id,reference,subject,category,priority,status,channel,customer_id,sla_minutes_remaining,sla_breached,first_response_at,resolved_at,created_at,updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(TICKET_LIMIT);
      if (error) throw new Error(`support_tickets: ${error.message}`);
      return (data ?? []) as SupportTicketRow[];
    },
  });
}

export function useSupportEscalations() {
  return useQuery({
    queryKey: ["internal-support-ai", "support_escalations"],
    ...READ_POLICY,
    queryFn: async (): Promise<SupportEscalationRow[]> => {
      const { data, error } = await db
        .from("support_escalations")
        .select("id,ticket_id,reference,reason,level,status,resolution_notes,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(TICKET_LIMIT);
      if (error) throw new Error(`support_escalations: ${error.message}`);
      return (data ?? []) as SupportEscalationRow[];
    },
  });
}

/** The self-healing board (incidents, attempts, engine state). */
export function useHealing() {
  const load = useServerFn(loadHealingBoard);
  return useQuery({
    queryKey: ["internal-support-ai", "healing-board"],
    ...READ_POLICY,
    queryFn: () => load() as Promise<HealingBoard>,
  });
}

export function useErrorEvents() {
  return useRecords({
    table: "error_events",
    select: "id,occurred_at,source,severity,message,route,fn_name,resolved",
    orderBy: "occurred_at",
    limit: ERROR_EVENT_LIMIT,
  });
}

export function useAiDecisions() {
  return useRecords({
    table: "ai_decision_logs",
    select: "id,occurred_at,confidence,outcome",
    orderBy: "occurred_at",
    limit: 200,
  });
}

/* ---------- derivations ---------- */

const CLOSED_TICKET = new Set(["resolved", "closed"]);
export const isOpenTicket = (t: { status: string | null }) =>
  !CLOSED_TICKET.has((t.status ?? "").toLowerCase());

const CLOSED_ESCALATION = new Set(["resolved", "closed"]);
export const isOpenEscalation = (e: { status: string | null }) =>
  !CLOSED_ESCALATION.has((e.status ?? "").toLowerCase());

/** Mean minutes from creation to resolution over resolved tickets, or null. */
export function avgResolutionMinutes(tickets: SupportTicketRow[]): number | null {
  const spans = tickets
    .filter((t) => t.resolved_at)
    .map(
      (t) =>
        (new Date(t.resolved_at as string).getTime() - new Date(t.created_at).getTime()) / 60_000,
    )
    .filter((m) => Number.isFinite(m) && m >= 0);
  if (!spans.length) return null;
  return spans.reduce((a, b) => a + b, 0) / spans.length;
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 48) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return "—";
  return at.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const shortId = (id: string | null | undefined) => (id ? id.slice(0, 8).toUpperCase() : "—");

/** Internal ID only - never a name, email or phone. */
export const maskUser = (id: string | null | undefined) =>
  id ? `USR-***${id.slice(-2).toUpperCase()}` : "—";

export const pct = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

export const isToday = (iso: string | null | undefined) => {
  if (!iso) return false;
  const at = new Date(iso);
  const now = new Date();
  return at.toDateString() === now.toDateString();
};

/** A healing attempt that reported success. */
export const attemptSucceeded = (row: TimelineRow) =>
  (row.whatHappened ?? "").toUpperCase() === "SUCCEEDED";
