import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PTPageHeader } from "@/components/promise-tracker/PTPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useCreatePromise, useSubcategories } from "@/hooks/usePromiseTracker";
import {
  LINKED_MODULES,
  NANO_CATEGORIES,
  PROMISE_PRIORITIES,
} from "@/lib/promise-tracker/constants";

export const Route = createFileRoute("/promise-tracker/create")({
  head: () => ({
    meta: [
      { title: "Create Promise — Promise Tracker" },
      {
        name: "description",
        content:
          "Register a new commitment in Software Vala with owner, receiver, category hierarchy, deadline, priority and linked module.",
      },
      { property: "og:title", content: "Create Promise — Promise Tracker" },
      {
        property: "og:description",
        content: "Register a new tracked commitment with full category hierarchy and deadline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTCreatePromise,
});

const EMPTY = {
  title: "",
  description: "",
  categoryId: "",
  subCategory: "",
  nanoCategory: "",
  owner: "",
  receiver: "",
  deadline: "",
  priority: "medium",
  linkedModule: "",
};

function PTCreatePromise() {
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();
  const createPromise = useCreatePromise();
  const [form, setForm] = useState(EMPTY);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const availableSubs = subcategories.filter((sub) => sub.category_id === form.categoryId);
  const isValid =
    form.title.trim() &&
    form.categoryId &&
    form.owner.trim() &&
    form.receiver.trim() &&
    form.deadline;

  const submit = (status: "pending" | "active") => {
    if (!isValid) return;
    createPromise.mutate(
      {
        ...form,
        deadline: new Date(form.deadline).toISOString(),
        status,
      },
      {
        onSuccess: () => {
          setForm(EMPTY);
          navigate({
            to: status === "active" ? "/promise-tracker/active" : "/promise-tracker/all",
          });
        },
      },
    );
  };

  return (
    <div className="max-w-4xl">
      <PTPageHeader
        title="Create Promise"
        description="Every promise needs an owner, a receiver and a hard deadline. Categories drive the escalation and fine rules applied later."
      />

      <form
        className="glass-panel space-y-6 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit("active");
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="title">Promise title</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="Deliver signed MSA to the client"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={4}
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="What exactly is being committed, and what counts as done?"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.categoryId}
              onValueChange={(value) => {
                set("categoryId", value);
                set("subCategory", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sub category</Label>
            <Select
              value={form.subCategory}
              onValueChange={(value) => set("subCategory", value)}
              disabled={availableSubs.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sub category" />
              </SelectTrigger>
              <SelectContent>
                {availableSubs.map((sub) => (
                  <SelectItem key={sub.id} value={sub.label}>
                    {sub.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nano category</Label>
            <Select value={form.nanoCategory} onValueChange={(value) => set("nanoCategory", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select nano category" />
              </SelectTrigger>
              <SelectContent>
                {NANO_CATEGORIES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="owner">Promise owner</Label>
            <Input
              id="owner"
              value={form.owner}
              onChange={(event) => set("owner", event.target.value)}
              placeholder="Who is accountable"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receiver">Promise receiver</Label>
            <Input
              id="receiver"
              value={form.receiver}
              onChange={(event) => set("receiver", event.target.value)}
              placeholder="Who is owed this"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={form.deadline}
              onChange={(event) => set("deadline", event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(value) => set("priority", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROMISE_PRIORITIES.map((entry) => (
                  <SelectItem key={entry} value={entry} className="capitalize">
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Linked module</Label>
            <Select value={form.linkedModule} onValueChange={(value) => set("linkedModule", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select module" />
              </SelectTrigger>
              <SelectContent>
                {LINKED_MODULES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border pt-5">
          <Button type="submit" disabled={!isValid || createPromise.isPending}>
            {createPromise.isPending ? "Saving…" : "Create & activate"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!isValid || createPromise.isPending}
            onClick={() => submit("pending")}
          >
            Save as draft
          </Button>
          <Button type="button" variant="ghost" onClick={() => setForm(EMPTY)}>
            Reset
          </Button>
        </div>
      </form>
    </div>
  );
}
