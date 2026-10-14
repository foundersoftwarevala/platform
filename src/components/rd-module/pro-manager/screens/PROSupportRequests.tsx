import { useState } from "react";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/rd-module/ui/select";
import { usePMTickets } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { PMEmpty, PMLoading, PMPanel, PMSection, StatusBadge, formatDate } from "../pm-ui";

const TYPES = ["Technical", "Billing", "Feature", "Bug"] as const;
const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
const STATUSES = ["new", "in_progress", "waiting_user", "resolved", "escalated"] as const;

export const PROSupportRequests = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMTickets();
  const { createTicket, updateTicketStatus, run } = useProManagerActions();
  const [form, setForm] = useState({
    user_code: "",
    type: "Technical" as (typeof TYPES)[number],
    severity: "Medium" as (typeof SEVERITIES)[number],
    product: "",
    subject: "",
  });

  const term = search.trim().toLowerCase();
  const tickets = (data ?? []).filter((ticket) =>
    term
      ? [ticket.code, ticket.user_code, ticket.subject, ticket.product, ticket.status]
          .join(" ")
          .toLowerCase()
          .includes(term)
      : true,
  );

  const canSubmit = form.user_code.length > 0 && form.product.length > 0 && form.subject.length > 2;

  return (
    <PMSection
      title="Support requests"
      description="Premium support queue with live ticket governance."
    >
      <PMPanel
        title="Log a support request"
        description="Creates a real ticket and a communication log entry"
      >
        <div className="grid gap-2 md:grid-cols-5">
          <Input
            placeholder="Account code"
            value={form.user_code}
            onChange={(event) => setForm((prev) => ({ ...prev, user_code: event.target.value }))}
          />
          <Select
            value={form.type}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, type: value as typeof form.type }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={form.severity}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, severity: value as typeof form.severity }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((severity) => (
                <SelectItem key={severity} value={severity}>
                  {severity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Product"
            value={form.product}
            onChange={(event) => setForm((prev) => ({ ...prev, product: event.target.value }))}
          />
          <Input
            placeholder="Subject"
            value={form.subject}
            onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
          />
        </div>
        <Button
          className="mt-3"
          size="sm"
          disabled={!canSubmit}
          onClick={async () => {
            const created = await run("Support request created", createTicket({ data: form }));
            if (created) setForm((prev) => ({ ...prev, subject: "" }));
          }}
        >
          Create ticket
        </Button>
      </PMPanel>

      <PMPanel>
        {isLoading ? (
          <PMLoading rows={5} />
        ) : tickets.length === 0 ? (
          <PMEmpty message="No support requests match this search." />
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-border bg-surface-2/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {ticket.code} — {ticket.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.user_code} • {ticket.type} • {ticket.product} • opened{" "}
                      {formatDate(ticket.opened_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={ticket.severity} />
                    <StatusBadge value={ticket.status} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {STATUSES.filter((status) => status !== ticket.status).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={status === "escalated" ? "destructive" : "outline"}
                      onClick={() =>
                        void run(
                          `Ticket ${status.replace("_", " ")}`,
                          updateTicketStatus({
                            data: { id: ticket.id, code: ticket.code, status, note: "" },
                          }),
                        )
                      }
                    >
                      {status.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PMPanel>
    </PMSection>
  );
};
