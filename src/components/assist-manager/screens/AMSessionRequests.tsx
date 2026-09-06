/**
 * SESSION REQUESTS
 * Incoming assist requests queue with approve / reject / re-scope actions.
 */

import { useState } from "react";
import { Check, Clock, Edit, Inbox, Shield, User, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useDecideRequest, useRequests } from "@/lib/assist-manager/hooks";
import {
  CodeChip,
  EmptyState,
  LoadingBlock,
  RiskPill,
  ScreenHeader,
  StatusPill,
  timeAgo,
  titleCase,
} from "../am-ui";

type Filter = "pending" | "approved" | "rejected" | "all";

export function AMSessionRequests() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data: requests = [], isLoading } = useRequests();
  const decide = useDecideRequest();

  const visible = requests.filter((r) => filter === "all" || r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Session Requests"
          subtitle="Incoming assist session requests"
          actions={
            <span className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
              <Inbox className="h-3.5 w-3.5" />
              {pendingCount} Pending
            </span>
          }
        />

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <LoadingBlock />
        ) : visible.length === 0 ? (
          <EmptyState title="Nothing here" description="No requests match this filter." />
        ) : (
          <div className="space-y-4">
            {visible.map((request) => (
              <Card
                key={request.id}
                className={cn(
                  "border-l-4",
                  request.priority === "critical"
                    ? "border-l-destructive"
                    : request.priority === "high"
                      ? "border-l-warning"
                      : "border-l-info",
                )}
              >
                <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CodeChip>{request.request_code}</CodeChip>
                      <RiskPill risk={request.priority} />
                      <CodeChip>{titleCase(request.assist_type)}</CodeChip>
                      <StatusPill status={request.status} />
                      {request.ai_assist_enabled ? <CodeChip>AI assist</CodeChip> : null}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                      <div>
                        <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                          <User className="h-3 w-3" /> From
                        </p>
                        <p className="code-chip mt-1">{request.end_user?.user_code ?? "—"}</p>
                      </div>
                      <div>
                        <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                          <Shield className="h-3 w-3" /> Scope
                        </p>
                        <p className="mt-1">{titleCase(request.requested_scope)}</p>
                      </div>
                      <div>
                        <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                          <Clock className="h-3 w-3" /> Duration
                        </p>
                        <p className="mt-1">{request.requested_duration_minutes} min</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Requested
                        </p>
                        <p className="mt-1">{timeAgo(request.created_at)}</p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Purpose:</span>{" "}
                      {request.purpose}
                    </p>

                    {request.review_note ? (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Review note:</span>{" "}
                        {request.review_note}
                      </p>
                    ) : null}

                    {request.status === "pending" ? (
                      <Input
                        placeholder="Optional review note…"
                        value={notes[request.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                        }
                      />
                    ) : null}
                  </div>

                  {request.status === "pending" ? (
                    <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            id: request.id,
                            decision: "approved",
                            note: notes[request.id],
                          })
                        }
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            id: request.id,
                            decision: "rejected",
                            note: notes[request.id] || "Rejected by Assist Manager",
                          })
                        }
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            id: request.id,
                            decision: "approved",
                            note: `Scope reduced to view only. ${notes[request.id] ?? ""}`.trim(),
                          })
                        }
                      >
                        <Edit className="mr-1 h-4 w-4" />
                        Modify
                      </Button>
                    </div>
                  ) : (
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      Reviewed {request.reviewed_at ? timeAgo(request.reviewed_at) : "—"}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

export default AMSessionRequests;
