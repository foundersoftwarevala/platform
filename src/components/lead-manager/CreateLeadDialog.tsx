import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { leadApi } from "@/lib/lead-manager/api";
import type { Lead, LeadPriority, LeadSourceType } from "@/lib/lead-manager/types";

const SOURCES: LeadSourceType[] = [
  "website",
  "seo",
  "social",
  "ads",
  "marketplace",
  "referral",
  "manual",
  "api",
  "whatsapp",
];

const initialForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  city: "",
  state: "",
  source: "manual" as LeadSourceType,
  sub_source: "Manual Entry",
  priority: "medium" as LeadPriority,
  deal_value: "",
  requirements: "",
};

export function CreateLeadDialog({ onCreated }: { onCreated: (lead: Lead) => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    // Clear the complaint as soon as the operator starts fixing it, rather than
    // leaving red text under a field they have already corrected.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const submit = async () => {
    // This used to be a bare `return` when a required field was blank: the
    // button did nothing and said nothing. The button is disabled in that case
    // anyway, so what the guard really hid was the other half - an address like
    // "abc@" or a phone like "123" passed straight through to the database,
    // because nothing checked the shape of either. A lead nobody can reply to
    // is not a lead.
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setPending(true);
    try {
      const lead = await leadApi.createLead({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        company: form.company.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        source: form.source,
        sub_source: form.sub_source.trim() || "Manual Entry",
        priority: form.priority,
        deal_value: Number(form.deal_value) || 0,
        requirements: form.requirements.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["lm"] });
      toast.success("Lead created");
      setForm(initialForm);
      setErrors({});
      setOpen(false);
      onCreated(lead);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lead could not be created");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="lift sheen">
          <Plus className="size-4" /> New lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create lead</DialogTitle>
          <DialogDescription>Add a verified enquiry to the live lead pipeline.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field label="Name" required error={errors.name}>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Company">
            <Input value={form.company} onChange={(e) => update("company", e.target.value)} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>
          <Field label="Phone" required error={errors.phone}>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </Field>
          <Field label="State">
            <Input value={form.state} onChange={(e) => update("state", e.target.value)} />
          </Field>
          <Field label="Source">
            <Select value={form.source} onValueChange={(value) => update("source", value)}>
              <SelectTrigger className="capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((source) => (
                  <SelectItem key={source} value={source} className="capitalize">
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sub-source">
            <Input value={form.sub_source} onChange={(e) => update("sub_source", e.target.value)} />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onValueChange={(value) => update("priority", value)}>
              <SelectTrigger className="capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["critical", "high", "medium", "low"].map((priority) => (
                  <SelectItem key={priority} value={priority} className="capitalize">
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Deal value (INR)" error={errors.deal_value}>
            <Input
              min="0"
              type="number"
              value={form.deal_value}
              onChange={(e) => update("deal_value", e.target.value)}
            />
          </Field>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Requirements</Label>
            <Textarea
              value={form.requirements}
              onChange={(e) => update("requirements", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || !form.name.trim() || !form.email.trim() || !form.phone.trim()}
            onClick={submit}
          >
            {pending ? "Creating…" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What has to be true before a lead is worth creating.
 *
 * Deliberately not a strict address grammar - the aim is to catch what would
 * make the lead unusable, not to argue with unusual but valid addresses. A
 * phone is counted in digits so that spaces, dashes, brackets and a country
 * code are all fine; seven is the shortest national number in use anywhere.
 */
export function validate(form: {
  name: string;
  email: string;
  phone: string;
  deal_value: string;
}): Partial<Record<"name" | "email" | "phone" | "deal_value", string>> {
  const errors: Partial<Record<"name" | "email" | "phone" | "deal_value", string>> = {};

  if (!form.name.trim()) errors.name = "A name is required.";

  const email = form.email.trim();
  if (!email) errors.email = "An email address is required.";
  else if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email))
    errors.email = "That does not look like an email address.";

  const digits = form.phone.replace(/\D/g, "");
  if (!form.phone.trim()) errors.phone = "A phone number is required.";
  else if (digits.length < 7) errors.phone = "A phone number needs at least 7 digits.";
  else if (digits.length > 15) errors.phone = "That is longer than any phone number.";

  if (form.deal_value.trim()) {
    const value = Number(form.deal_value);
    if (!Number.isFinite(value)) errors.deal_value = "Deal value must be a number.";
    else if (value < 0) errors.deal_value = "Deal value cannot be negative.";
  }

  return errors;
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
