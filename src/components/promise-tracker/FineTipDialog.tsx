import { useMemo, useState } from "react";
import { BadgeIndianRupee, Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatCurrency,
  formatRuleAmount,
  type PromiseWithCategory,
} from "@/lib/promise-tracker/constants";
import { useApplyFine, useReleaseTip, useRules } from "@/hooks/usePromiseTracker";

/**
 * Applies a configured fine (breach) or tip (early delivery) rule to a promise.
 * Percentage rules are computed against a base value entered at apply time.
 */
export function FineTipDialog({
  promise,
  kind,
  open: controlledOpen,
  onOpenChange,
}: {
  promise: PromiseWithCategory;
  kind: "fine" | "tip";
  /** Omit for the built-in trigger button; pass to drive it from a menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data: rules = [] } = useRules();
  const applyFine = useApplyFine();
  const releaseTip = useReleaseTip();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [ruleId, setRuleId] = useState("");
  const [base, setBase] = useState("");

  const available = useMemo(
    () => rules.filter((rule) => rule.kind === kind && rule.is_active),
    [rules, kind],
  );
  const rule = available.find((entry) => entry.id === ruleId);
  const isPercentage = rule?.rule_type === "percentage";
  const isPerDay = rule?.rule_type === "per_day";
  const amount = rule
    ? isPercentage
      ? (Number(base || 0) * Number(rule.amount)) / 100
      : isPerDay
        ? Math.max(1, Number(promise.delay_days)) * Number(rule.amount)
        : Number(rule.amount)
    : 0;

  const mutation = kind === "fine" ? applyFine : releaseTip;
  const label = kind === "fine" ? "Apply fine" : "Release tip";

  const submit = () => {
    if (!rule || amount <= 0) return;
    mutation.mutate(
      // The rule and its basis go to the server, which prices it. The
      // displayed amount above is a preview, not the decision.
      { promise, ruleId: rule.id, base: base ? Number(base) : undefined,
        note: `${rule.code} · ${rule.name}` },
      {
        onSuccess: () => {
          setOpen(false);
          setRuleId("");
          setBase("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isControlled ? null : (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            {kind === "fine" ? (
              <BadgeIndianRupee className="size-4" />
            ) : (
              <Gift className="size-4" />
            )}
            {label}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {label} · {promise.code}
          </DialogTitle>
          <DialogDescription>{promise.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{kind === "fine" ? "Fine rule" : "Tip rule"}</Label>
            <Select value={ruleId} onValueChange={setRuleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an active rule" />
              </SelectTrigger>
              <SelectContent>
                {available.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name} · {formatRuleAmount(entry)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {available.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No active {kind} rules. Configure one on the Fine &amp; Tip Rules screen.
              </p>
            ) : null}
          </div>

          {isPercentage ? (
            <div className="space-y-2">
              <Label htmlFor="ft-base">Base value for percentage</Label>
              <Input
                id="ft-base"
                type="number"
                min={0}
                value={base}
                onChange={(event) => setBase(event.target.value)}
                placeholder="Contract or milestone value"
              />
            </div>
          ) : null}

          {isPerDay ? (
            <p className="text-xs text-muted-foreground">
              {formatRuleAmount(rule)} × {Math.max(1, Number(promise.delay_days))} delayed day(s)
            </p>
          ) : null}

          <p className="text-sm text-muted-foreground">
            Amount to record:{" "}
            <span className="font-medium text-foreground">{formatCurrency(amount)}</span>
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!rule || amount <= 0 || mutation.isPending}>
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
