import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import {
  acceptBid,
  getBiddingWorkspace,
  submitBid,
  withdrawBid,
} from "@/lib/bidding/core.functions";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}

function BidAmount({ amount, currency }: { amount: string; currency: string }) {
  return (
    <span>
      {amount} {currency}
    </span>
  );
}

export function BiddingWorkspace() {
  const queryClient = useQueryClient();
  const load = useServerFn(getBiddingWorkspace);
  const submit = useServerFn(submitBid);
  const withdraw = useServerFn(withdrawBid);
  const accept = useServerFn(acceptBid);
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["task-bidding"],
    queryFn: () => load({ data: undefined }),
  });
  const refresh = async () => {
    setActionError(null);
    await queryClient.invalidateQueries({ queryKey: ["task-bidding"] });
  };
  const submitMutation = useMutation({
    mutationFn: (data: { taskId: string; amount: string; proposal: string }) =>
      submit({ data }),
    onSuccess: refresh,
    onError: (error) => setActionError(errorMessage(error)),
  });
  const withdrawMutation = useMutation({
    mutationFn: (data: { bidId: string }) => withdraw({ data }),
    onSuccess: refresh,
    onError: (error) => setActionError(errorMessage(error)),
  });
  const acceptMutation = useMutation({
    mutationFn: (data: { bidId: string }) => accept({ data }),
    onSuccess: refresh,
    onError: (error) => setActionError(errorMessage(error)),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const amount = String(form.get("amount") ?? "");
    const proposal = String(form.get("proposal") ?? "");
    submitMutation.mutate(
      { taskId, amount, proposal },
      { onSuccess: () => formElement.reset() },
    );
  }

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground" role="status">
        Loading bidding workspace…
      </main>
    );
  }
  if (query.error || !query.data) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-sm text-destructive" role="alert">
        {errorMessage(query.error)}
      </main>
    );
  }

  const data = query.data;
  const ownSubmittedBids = new Map(
    data.bids
      .filter((bid) => bid.status === "submitted")
      .map((bid) => [bid.taskId, bid]),
  );
  const submittedBids = data.bids.filter((bid) => bid.status === "submitted");
  const isPending =
    submitMutation.isPending || withdrawMutation.isPending || acceptMutation.isPending;

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Task Manager</p>
        <h1 className="text-3xl font-bold tracking-tight">Task bidding</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Developers can bid on unassigned tasks routed to the developer pool.
          A manager’s acceptance assigns the task and closes the other submitted bids.
        </p>
      </header>

      {actionError && (
        <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}

      {data.isManager ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Submitted bids</h2>
            <p className="text-sm text-muted-foreground">
              Accepting a bid claims the task for that developer.
            </p>
          </div>
          {submittedBids.length === 0 ? (
            <p className="rounded-lg border p-5 text-sm text-muted-foreground">
              No submitted bids.
            </p>
          ) : (
            <div className="space-y-3">
              {submittedBids.map((bid) => {
                const taskOpen =
                  bid.taskStatus === "available_for_claim" && bid.taskAssignedTo === null;
                return (
                  <article key={bid.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{bid.taskTitle}</h3>
                        <p className="text-xs text-muted-foreground">
                          {bid.taskCode} · {bid.bidderName} · {bid.status}
                        </p>
                      </div>
                      <p className="font-semibold">
                        <BidAmount amount={bid.amount} currency={bid.currency} />
                      </p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{bid.proposal}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(bid.createdAt).toLocaleString()}
                    </p>
                    <button
                      type="button"
                      disabled={!taskOpen || isPending}
                      onClick={() => acceptMutation.mutate({ bidId: bid.id })}
                      className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {acceptMutation.isPending ? "Accepting…" : "Accept and assign"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Open tasks</h2>
            <p className="text-sm text-muted-foreground">
              You can edit one submitted bid per task until a manager decides it.
            </p>
          </div>
          {data.tasks.length === 0 ? (
            <p className="rounded-lg border p-5 text-sm text-muted-foreground">
              There are no tasks currently open for developer bids.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.tasks.map((task) => {
                const existing = ownSubmittedBids.get(task.id);
                return (
                  <article key={task.id} className="space-y-4 rounded-lg border p-5">
                    <header>
                      <h3 className="text-lg font-semibold">{task.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {task.code} · {task.category} · {task.priority}
                        {task.assignedRole ? ` · ${task.assignedRole}` : ""}
                      </p>
                    </header>
                    {task.description && (
                      <p className="whitespace-pre-wrap text-sm">{task.description}</p>
                    )}
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Reference cost</dt>
                        <dd>
                          <BidAmount amount={task.referenceAmount} currency={task.currency} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Deadline</dt>
                        <dd>
                          {task.deadline ? new Date(task.deadline).toLocaleString() : "Not set"}
                        </dd>
                      </div>
                    </dl>
                    <form
                      className="space-y-3 border-t pt-4"
                      onSubmit={(event) => onSubmit(event, task.id)}
                    >
                      <label className="grid gap-1 text-sm">
                        Your bid ({task.currency})
                        <input
                          className="h-10 rounded-md border bg-background px-3"
                          name="amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          defaultValue={existing?.amount ?? ""}
                          required
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        Proposal
                        <textarea
                          className="min-h-24 rounded-md border bg-background p-3"
                          name="proposal"
                          minLength={1}
                          maxLength={5000}
                          defaultValue={existing?.proposal ?? ""}
                          required
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={isPending}
                          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                        >
                          {submitMutation.isPending
                            ? "Saving…"
                            : existing
                              ? "Update bid"
                              : "Submit bid"}
                        </button>
                        {existing && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => withdrawMutation.mutate({ bidId: existing.id })}
                            className="h-10 rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                          >
                            Withdraw bid
                          </button>
                        )}
                      </div>
                    </form>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!data.isManager && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Your bid history</h2>
          {data.bids.length === 0 ? (
            <p className="rounded-lg border p-5 text-sm text-muted-foreground">
              You have not submitted a bid.
            </p>
          ) : (
            <div className="space-y-3">
              {data.bids.map((bid) => (
                <article key={bid.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="font-medium">{bid.taskTitle}</h3>
                    <span className="text-sm">
                      <BidAmount amount={bid.amount} currency={bid.currency} />
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bid.taskCode} · {bid.status} · {new Date(bid.updatedAt).toLocaleString()}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{bid.proposal}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
