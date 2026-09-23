import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type LeadAction = "buy_intent" | "notify_me" | "request_demo";

const COPY: Record<LeadAction, { title: string; description: string; submit: string; done: string }> = {
  buy_intent: {
    title: "Buy this software",
    description: "Share your details and our team confirms your lifetime licence.",
    submit: "Confirm purchase request",
    done: "Purchase request saved. Our team will contact you shortly.",
  },
  notify_me: {
    title: "Notify me at launch",
    description: "We will email you the moment this product goes live.",
    submit: "Notify me",
    done: "You are on the launch list.",
  },
  request_demo: {
    title: "Request a live demo",
    description: "Tell us how to reach you and we will schedule the walkthrough.",
    submit: "Request demo",
    done: "Demo request saved. We will be in touch.",
  },
};

export function ProductLeadDialog({
  open,
  onOpenChange,
  action,
  productName,
  productId,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  action: LeadAction;
  productName: string;
  productId?: string;
}) {
  const copy = COPY[action];
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", requirements: "" });

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async () => {
    if (form.name.trim().length < 2) {
      toast.error("Please enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/marketplace/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          requirements: form.requirements.trim(),
          productName,
          productId: productId ?? "",
          sourcePage: window.location.pathname + window.location.search,
          ctaAction: action,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "We could not save that. Please try again.");
        return;
      }
      toast.success(copy.done, { description: productName });
      setForm({ name: "", email: "", phone: "", requirements: "" });
      onOpenChange(false);
    } catch {
      toast.error("We could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {productName} — {copy.description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="lead-name">Name</Label>
            <Input id="lead-name" value={form.name} onChange={set("name")} placeholder="Your full name" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lead-email">Email</Label>
            <Input id="lead-email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lead-phone">Phone (optional)</Label>
            <Input id="lead-phone" value={form.phone} onChange={set("phone")} placeholder="+91…" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lead-notes">Requirements (optional)</Label>
            <Textarea id="lead-notes" value={form.requirements} onChange={set("requirements")} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} loading={saving}>
            {copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProductLeadDialog;
