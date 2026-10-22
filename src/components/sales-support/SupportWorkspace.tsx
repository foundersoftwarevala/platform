import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  assignTicket,
  createTicket,
  getSupportWorkspace,
  linkTeamMember,
  replyToTicket,
} from "@/lib/sales-support/core.functions";

type SupportTab = "dashboard" | "tickets" | "knowledge" | "chat" | "team";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}

export function SupportWorkspace() {
  const queryClient = useQueryClient();
  const load = useServerFn(getSupportWorkspace);
  const createTicketFn = useServerFn(createTicket);
  const replyFn = useServerFn(replyToTicket);
  const assignFn = useServerFn(assignTicket);
  const linkMemberFn = useServerFn(linkTeamMember);
  const [tab, setTab] = useState<SupportTab>("dashboard");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["sales-support-workspace", "support"],
    queryFn: () => load({ data: undefined }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sales-support-workspace"] });
  const createMutation = useMutation({
    mutationFn: (data: {
      customerName: string;
      subject: string;
      description: string;
      category: string;
      priority: "low" | "medium" | "high" | "urgent";
      assignedUserId?: string;
    }) => createTicketFn({ data }),
    onSuccess: (ticket) => {
      setSelectedTicketId(ticket.id);
      setTab("tickets");
      return refresh();
    },
  });
  const replyMutation = useMutation({
    mutationFn: (data: { ticketId: string; body: string }) => replyFn({ data }),
    onSuccess: refresh,
  });
  const assignMutation = useMutation({
    mutationFn: (data: { ticketId: string; agentUserId: string }) => assignFn({ data }),
    onSuccess: refresh,
  });
  const linkMutation = useMutation({
    mutationFn: (data: { teamMemberId: string; userId: string }) => linkMemberFn({ data }),
    onSuccess: refresh,
  });

  function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const assignedUserId = String(form.get("assignedUserId") ?? "");
    const priorityValue = String(form.get("priority") ?? "");
    if (
      priorityValue !== "low" &&
      priorityValue !== "medium" &&
      priorityValue !== "high" &&
      priorityValue !== "urgent"
    )
      return;
    createMutation.mutate(
      {
        customerName: String(form.get("customerName") ?? ""),
        subject: String(form.get("subject") ?? ""),
        description: String(form.get("description") ?? ""),
        category: String(form.get("category") ?? "general"),
        priority: priorityValue,
        ...(assignedUserId ? { assignedUserId } : {}),
      },
      { onSuccess: () => formElement.reset() },
    );
  }

  function submitReply(event: FormEvent<HTMLFormElement>, ticketId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const body = String(new FormData(formElement).get("body") ?? "");
    replyMutation.mutate({ ticketId, body }, { onSuccess: () => formElement.reset() });
  }

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-7xl p-6 text-sm text-muted-foreground" role="status">
        Loading Support workspace…
      </main>
    );
  }
  if (query.error || !query.data) {
    return (
      <main className="mx-auto max-w-7xl p-6 text-sm text-destructive" role="alert">
        {errorMessage(query.error)}
      </main>
    );
  }

  const data = query.data;
  const selectedTicket = data.tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const linkedSupport = data.team.filter(
    (member) => member.authUserId && member.department.toLowerCase().includes("support"),
  );
  const tabs: { id: SupportTab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "tickets", label: "Tickets" },
    { id: "knowledge", label: "Knowledge base" },
    { id: "chat", label: "Chat" },
    ...(data.isManager ? [{ id: "team" as const, label: "Team access" }] : []),
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header>
        <p className="text-sm font-medium text-primary">Support workspace</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Support</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Assigned tickets and replies are read and written through authenticated server functions.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          className="flex gap-2 overflow-x-auto border-b pb-3 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4"
          aria-label="Support pages"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
              className={`rounded-md px-4 py-2 text-sm ${tab === item.id ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          {tab === "dashboard" && (
            <section className="grid gap-4 sm:grid-cols-3" aria-label="Support totals">
              <Metric label="Visible tickets" value={data.tickets.length} />
              <Metric
                label="Open tickets"
                value={
                  data.tickets.filter(
                    (ticket) => !["closed", "resolved"].includes(ticket.status.toLowerCase()),
                  ).length
                }
              />
              <Metric label="Visible replies" value={data.replies.length} />
            </section>
          )}

          {tab === "tickets" && (
            <section className="space-y-5">
              <h2 className="text-xl font-semibold">Ticket queue</h2>
              <form
                onSubmit={submitTicket}
                className="grid gap-3 rounded-lg border p-4 md:grid-cols-2"
              >
                <label className="grid gap-1 text-sm">
                  Customer name
                  <input
                    className="h-10 rounded-md border bg-background px-3"
                    name="customerName"
                    required
                    maxLength={160}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Subject
                  <input
                    className="h-10 rounded-md border bg-background px-3"
                    name="subject"
                    required
                    maxLength={200}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Category
                  <input
                    className="h-10 rounded-md border bg-background px-3"
                    name="category"
                    defaultValue="general"
                    required
                    maxLength={80}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Priority
                  <select
                    className="h-10 rounded-md border bg-background px-3"
                    name="priority"
                    defaultValue="medium"
                  >
                    {(["low", "medium", "high", "urgent"] as const).map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
                {data.isManager && (
                  <label className="grid gap-1 text-sm">
                    Assign to (optional)
                    <select
                      className="h-10 rounded-md border bg-background px-3"
                      name="assignedUserId"
                      defaultValue=""
                    >
                      <option value="">Leave unassigned</option>
                      {linkedSupport.map((member) => (
                        <option key={member.id} value={member.authUserId!}>
                          {member.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="grid gap-1 text-sm md:col-span-2">
                  Description
                  <textarea
                    className="min-h-24 rounded-md border bg-background p-3"
                    name="description"
                    maxLength={5000}
                  />
                </label>
                {!data.isManager && !data.teamMemberId && (
                  <p className="text-sm text-amber-700 md:col-span-2" role="status">
                    A manager must link this account to a Support team member before tickets can be
                    created.
                  </p>
                )}
                <button
                  type="submit"
                  className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  disabled={createMutation.isPending || (!data.isManager && !data.teamMemberId)}
                >
                  {createMutation.isPending ? "Creating…" : "Create ticket"}
                </button>
                {createMutation.error && (
                  <p className="text-sm text-destructive md:col-span-2" role="alert">
                    {errorMessage(createMutation.error)}
                  </p>
                )}
              </form>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="space-y-2">
                  {data.tickets.length === 0 ? (
                    <Empty>No tickets are assigned to this Support account.</Empty>
                  ) : (
                    data.tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={`block w-full rounded-lg border p-4 text-left ${selectedTicketId === ticket.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                      >
                        <span className="block font-medium">{ticket.subject}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {ticket.reference} · {ticket.customerName} · {ticket.status} ·{" "}
                          {ticket.priority}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="min-h-48 rounded-lg border p-4">
                  {!selectedTicket ? (
                    <p className="text-sm text-muted-foreground" role="status">
                      Select a ticket to view its replies.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <header>
                        <h3 className="font-semibold">{selectedTicket.subject}</h3>
                        <p className="text-xs text-muted-foreground">
                          {selectedTicket.reference} · {selectedTicket.customerName} ·{" "}
                          {selectedTicket.status}
                        </p>
                        {selectedTicket.description && (
                          <p className="mt-2 whitespace-pre-wrap text-sm">
                            {selectedTicket.description}
                          </p>
                        )}
                      </header>
                      {data.isManager && (
                        <label className="grid max-w-sm gap-1 text-sm">
                          Assigned Support agent
                          <select
                            className="h-10 rounded-md border bg-background px-3"
                            value={
                              linkedSupport.find(
                                (member) => member.id === selectedTicket.assignedTo,
                              )?.authUserId ?? ""
                            }
                            disabled={assignMutation.isPending}
                            onChange={(event) => {
                              if (event.currentTarget.value)
                                assignMutation.mutate({
                                  ticketId: selectedTicket.id,
                                  agentUserId: event.currentTarget.value,
                                });
                            }}
                          >
                            <option value="" disabled>
                              Select a mapped Support agent
                            </option>
                            {linkedSupport.map((member) => (
                              <option key={member.id} value={member.authUserId!}>
                                {member.fullName}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="space-y-2 border-t pt-3">
                        <h4 className="text-sm font-medium">Reply history</h4>
                        {data.replies.filter((reply) => reply.ticketId === selectedTicket.id)
                          .length === 0 ? (
                          <p className="text-sm text-muted-foreground">No replies recorded.</p>
                        ) : (
                          data.replies
                            .filter((reply) => reply.ticketId === selectedTicket.id)
                            .map((reply) => (
                              <article key={reply.id} className="rounded-md bg-muted/40 p-3">
                                <p className="whitespace-pre-wrap text-sm">{reply.body}</p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {reply.actorId} · {new Date(reply.createdAt).toLocaleString()}
                                </p>
                              </article>
                            ))
                        )}
                      </div>
                      <form
                        className="grid gap-2 border-t pt-3"
                        onSubmit={(event) => submitReply(event, selectedTicket.id)}
                      >
                        <label className="grid gap-1 text-sm">
                          Reply
                          <textarea
                            className="min-h-20 rounded-md border bg-background p-3"
                            name="body"
                            required
                            maxLength={5000}
                          />
                        </label>
                        <button
                          type="submit"
                          className="h-10 justify-self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                          disabled={replyMutation.isPending}
                        >
                          {replyMutation.isPending ? "Sending…" : "Send reply"}
                        </button>
                      </form>
                      {replyMutation.error && (
                        <p className="text-sm text-destructive" role="alert">
                          {errorMessage(replyMutation.error)}
                        </p>
                      )}
                      {assignMutation.error && (
                        <p className="text-sm text-destructive" role="alert">
                          {errorMessage(assignMutation.error)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {tab === "knowledge" && (
            <section className="space-y-3 rounded-lg border p-6">
              <h2 className="text-xl font-semibold">Knowledge base</h2>
              <p className="text-sm text-muted-foreground">
                Open the existing Solution Wiki workspace.
              </p>
              <a
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                href="/support?section=wiki"
              >
                Open Solution Wiki
              </a>
            </section>
          )}

          {tab === "chat" && (
            <section className="space-y-3 rounded-lg border p-6">
              <h2 className="text-xl font-semibold">Support chat</h2>
              <p className="text-sm text-muted-foreground">
                Open the existing authenticated Chat Manager.
              </p>
              <a
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                href="/chat-manager"
              >
                Open Chat Manager
              </a>
            </section>
          )}

          {tab === "team" && data.isManager && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">
                Link existing Support staff records to authenticated accounts
              </h2>
              <p className="text-sm text-muted-foreground">
                Unlinked ticket assignments stay manager-only until a manager links a real Support
                account.
              </p>
              {data.team.filter(
                (member) =>
                  !member.authUserId && member.department.toLowerCase().includes("support"),
              ).length === 0 ? (
                <Empty>All Support team records are linked.</Empty>
              ) : (
                data.team
                  .filter(
                    (member) =>
                      !member.authUserId && member.department.toLowerCase().includes("support"),
                  )
                  .map((member) => {
                    const options = data.accounts.filter((account) => account.role === "support");
                    return (
                      <form
                        key={member.id}
                        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto]"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const userId = String(
                            new FormData(event.currentTarget).get("userId") ?? "",
                          );
                          if (userId) linkMutation.mutate({ teamMemberId: member.id, userId });
                        }}
                      >
                        <div>
                          <p className="font-medium">{member.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.department} · {member.roleTitle}
                          </p>
                        </div>
                        <select
                          className="h-10 rounded-md border bg-background px-3 text-sm"
                          name="userId"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Select a Support account
                          </option>
                          {options.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.fullName}
                              {account.email ? ` — ${account.email}` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="h-10 rounded-md border px-4 text-sm disabled:opacity-50"
                          disabled={linkMutation.isPending || options.length === 0}
                        >
                          Link account
                        </button>
                      </form>
                    );
                  })
              )}
              {linkMutation.error && (
                <p className="text-sm text-destructive" role="alert">
                  {errorMessage(linkMutation.error)}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground" role="status">
      {children}
    </p>
  );
}
