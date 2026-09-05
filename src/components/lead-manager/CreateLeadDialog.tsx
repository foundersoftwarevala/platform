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
  "website", "seo", "social", "ads", "marketplace", "referral", "manual", "api", "whatsapp",
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

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) return;
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
        <Button className="lift sheen"><Plus className="size-4" /> New lead</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create lead</DialogTitle>
          <DialogDescription>Add a verified enquiry to the live lead pipeline.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field label="Name" required><Input value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
          <Field label="Company"><Input value={form.company} onChange={(e) => update("company", e.target.value)} /></Field>
          <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
          <Field label="Phone" required><Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => update("city", e.target.value)} /></Field>
          <Field label="State"><Input value={form.state} onChange={(e) => update("state", e.target.value)} /></Field>
          <Field label="Source">
            <Select value={form.source} onValueChange={(value) => update("source", value)}>
              <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>{SOURCES.map((source) => <SelectItem key={source} value={source} className="capitalize">{source}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Sub-source"><Input value={form.sub_source} onChange={(e) => update("sub_source", e.target.value)} /></Field>
          <Field label="Priority">
            <Select value={form.priority} onValueChange={(value) => update("priority", value)}>
              <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>{["critical", "high", "medium", "low"].map((priority) => <SelectItem key={priority} value={priority} className="capitalize">{priority}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Deal value (INR)"><Input min="0" type="number" value={form.deal_value} onChange={(e) => update("deal_value", e.target.value)} /></Field>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Requirements</Label>
            <Textarea value={form.requirements} onChange={(e) => update("requirements", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending || !form.name.trim() || !form.email.trim() || !form.phone.trim()} onClick={submit}>
            {pending ? "Creating…" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}{required ? " *" : ""}</Label>{children}</div>;
}