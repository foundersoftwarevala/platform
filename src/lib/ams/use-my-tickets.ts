import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServerFn } from "@/lib/serverFn";
import type { CrudRecord } from "@/lib/crud-store";

import {
  archiveTicket,
  changeStatus,
  createTicket,
  getTicket,
  listTickets,
  postChatMessage,
} from "./tickets.functions";
import type { AmsChatChannel, AmsPriority, AmsStatus } from "./tickets.types";

/**
 * A partner's own support tickets, from the AMS ticket system.
 *
 * The dashboard's AMS desk kept its tickets in the browser: a ticket raised
 * there was gone on reload and never reached the support team, whose AMS
 * Manager reads ams_tickets. It now raises, reads and moves real tickets, in
 * the shape the desk already renders.
 */

/** The desk's own status words, which predate the ticket system's. */
export type DeskStatus =
  | "new" | "assigned" | "under-review" | "in-progress"
  | "waiting-customer" | "waiting-developer" | "waiting-qa"
  | "testing" | "resolved" | "closed" | "reopened";

const TO_DESK: Record<AmsStatus, DeskStatus> = {
  draft: "new",
  submitted: "new",
  assigned: "assigned",
  accepted: "under-review",
  in_progress: "in-progress",
  waiting_customer: "waiting-customer",
  waiting_developer: "waiting-developer",
  waiting_qa: "waiting-qa",
  testing: "testing",
  resolved: "resolved",
  closed: "closed",
  reopened: "reopened",
  cancelled: "closed",
  archived: "closed",
};

const FROM_DESK: Record<DeskStatus, AmsStatus> = {
  new: "submitted",
  assigned: "assigned",
  "under-review": "accepted",
  "in-progress": "in_progress",
  "waiting-customer": "waiting_customer",
  "waiting-developer": "waiting_developer",
  "waiting-qa": "waiting_qa",
  testing: "testing",
  resolved: "resolved",
  closed: "closed",
  reopened: "reopened",
};

export const deskToAms = (s: DeskStatus): AmsStatus => FROM_DESK[s];

type Ticket = {
  id: string;
  ticket_no: string | null;
  subject: string;
  description: string | null;
  product: string | null;
  category: string | null;
  priority: string;
  status: AmsStatus;
  department: string | null;
  expected_resolution_at: string | null;
  created_at: string;
  updated_at: string;
};

function toRecord(t: Ticket): CrudRecord {
  return {
    id: t.id,
    name: t.subject,
    status: "pending",
    owner: "",
    category: t.category ?? "",
    amount: 0,
    date: t.created_at,
    notes: t.description ?? "",
    tags: [],
    comments: [],
    audit: [],
    attachments: [],
    extra: {
      amsId: t.ticket_no ?? t.id.slice(0, 8),
      product: t.product ?? "",
      category: t.category ?? "",
      priority: t.priority,
      status: TO_DESK[t.status] ?? "new",
      amsStatus: t.status,
      expected: t.expected_resolution_at ? t.expected_resolution_at.slice(0, 10) : "",
      department: t.department ?? "Support",
      updated: t.updated_at,
    },
  };
}

const LIST_KEY = ["ams", "my-tickets"];

export function useMyTickets() {
  const list = useServerFn(listTickets);
  const create = useServerFn(createTicket);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: LIST_KEY,
    queryFn: async () =>
      (((await list({ data: { mine: true } })) as { rows: unknown[] }).rows as Ticket[]).map(toRecord),
  });
  const creating = useMutation({
    mutationFn: (input: {
      subject: string;
      description: string;
      product: string;
      category: string;
      priority: AmsPriority;
      expected: string;
    }) =>
      create({
        data: {
          subject: input.subject,
          description: input.description,
          product: input.product || undefined,
          category: input.category,
          priority: input.priority,
          expected_resolution_at: input.expected ? new Date(input.expected).toISOString() : null,
          submit: true,
        },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: LIST_KEY }),
  });
  return {
    records: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => void query.refetch(),
    create: async (input: Parameters<typeof creating.mutateAsync>[0]) =>
      toRecord((await creating.mutateAsync(input)) as Ticket),
  };
}

type ChatRow = { id: string; channel: string; author_id: string | null; body: string; created_at: string };
type EventRow = { id: string; kind: string; from_value: string | null; to_value: string | null; created_at: string };

/** One ticket in full: its conversation and its history. */
export function useMyTicket(id: string | null) {
  const get = useServerFn(getTicket);
  const move = useServerFn(changeStatus);
  const post = useServerFn(postChatMessage);
  const archive = useServerFn(archiveTicket);
  const client = useQueryClient();
  const key = ["ams", "my-ticket", id];
  const query = useQuery({
    queryKey: key,
    enabled: !!id,
    queryFn: async () => {
      const full = (await get({ data: { id: id as string } })) as
        | { ticket: unknown; chat: unknown[]; events: unknown[] }
        | null;
      if (!full) return null;
      const record = toRecord(full.ticket as Ticket);
      record.comments = (full.chat as ChatRow[]).map((m) => ({
        id: m.id,
        author: m.channel,
        text: m.body,
        date: m.created_at,
      }));
      record.audit = (full.events as EventRow[]).map((e) => ({
        id: e.id,
        action: e.kind.replace(/_/g, " "),
        by: "",
        date: e.created_at,
        detail: e.from_value || e.to_value ? `${e.from_value ?? "—"} → ${e.to_value ?? "—"}` : undefined,
      }));
      return record;
    },
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: key }),
      client.invalidateQueries({ queryKey: LIST_KEY }),
    ]);
  };
  return {
    record: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    setStatus: async (to: AmsStatus) => {
      await move({ data: { id: id as string, to } });
      await refresh();
    },
    send: async (channel: AmsChatChannel, body: string) => {
      await post({ data: { ticket_id: id as string, channel, body } });
      await refresh();
    },
    archive: async () => {
      await archive({ data: { id: id as string } });
      await client.invalidateQueries({ queryKey: LIST_KEY });
    },
  };
}
