import { useState } from "react";
import { Plus } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSaveRule } from "@/hooks/usePromiseTracker";

const EMPTY = { name: "", rule_type: "fixed", amount: "", auto_apply: false, is_active: true };

/** Create a new fine or tip rule. Codes (FR-00x / TR-00x) are assigned server-side. */
export function RuleFormDialog({ kind }: { kind: "fine" | "tip" }) {
  const saveRule = useSaveRule();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const submit = () => {
    const amount = Number(form.amount);
    if (!form.name.trim() || Number.isNaN(amount) || amount <= 0) return;
    saveRule.mutate(
      {
        kind,
        name: form.name.trim(),
        rule_type: form.rule_type,
        amount,
        auto_apply: form.auto_apply,
        is_active: form.is_active,
      },
      {
        onSuccess: () => {
          setForm(EMPTY);
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          New {kind} rule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {kind} rule</DialogTitle>
          <DialogDescription>
            {kind === "fine"
              ? "Charged when a tracked promise is breached."
              : "Released when a tracked promise beats its deadline."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`rule-name-${kind}`}>Rule name</Label>
            <Input
              id={`rule-name-${kind}`}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={kind === "fine" ? "Late delivery penalty" : "Early delivery bonus"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Rule type</Label>
              <Select
                value={form.rule_type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, rule_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="per_day">Per day of delay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`rule-amount-${kind}`}>
                {form.rule_type === "percentage" ? "Percent" : "Amount"}
              </Label>
              <Input
                id={`rule-amount-${kind}`}
                type="number"
                min={0}
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Apply automatically</p>
              <p className="text-xs text-muted-foreground">
                Run this rule without manual confirmation.
              </p>
            </div>
            <Switch
              checked={form.auto_apply}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, auto_apply: checked }))}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive rules cannot be applied.</p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saveRule.isPending}>
            Create rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
