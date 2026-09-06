import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, PTPageHeader, StatusBadge } from "@/components/promise-tracker/PTPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NANO_CATEGORIES } from "@/lib/promise-tracker/constants";
import {
  useCategories,
  usePromises,
  useSaveCategory,
  useSaveSubcategory,
  useSubcategories,
} from "@/hooks/usePromiseTracker";

export const Route = createFileRoute("/promise-tracker/categories")({
  head: () => ({
    meta: [
      { title: "Promise Categories — Promise Tracker" },
      {
        name: "description",
        content:
          "Category, sub category and nano category hierarchy used to classify every commitment in Software Vala.",
      },
      { property: "og:title", content: "Promise Categories — Promise Tracker" },
      {
        property: "og:description",
        content: "Manage the category hierarchy behind Software Vala's promise register.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTCategories,
});

function PTCategories() {
  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();
  const { data: promises = [] } = usePromises();
  const saveCategory = useSaveCategory();
  const saveSubcategory = useSaveSubcategory();

  const [catOpen, setCatOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [catForm, setCatForm] = useState({ label: "", accent: "primary" });
  const [subForm, setSubForm] = useState({ categoryId: "", label: "" });
  const [editCat, setEditCat] = useState<{ id: string; label: string; accent: string } | null>(
    null,
  );
  const [editSub, setEditSub] = useState<{ id: string; categoryId: string; label: string } | null>(
    null,
  );

  const slugify = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  return (
    <div>
      <PTPageHeader
        title="Categories"
        description="Three-level classification: category, sub category and nano category. Categories drive routing, escalation and reporting."
        actions={
          <>
            <Dialog open={catOpen} onOpenChange={setCatOpen}>
              <DialogTrigger asChild>
                <Button>New category</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New category</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cat-label">Label</Label>
                    <Input
                      id="cat-label"
                      value={catForm.label}
                      onChange={(event) =>
                        setCatForm((prev) => ({ ...prev, label: event.target.value }))
                      }
                      placeholder="Compliance"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Accent</Label>
                    <Select
                      value={catForm.accent}
                      onValueChange={(value) => setCatForm((prev) => ({ ...prev, accent: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["primary", "info", "success", "warning", "destructive", "tracker"].map(
                          (entry) => (
                            <SelectItem key={entry} value={entry} className="capitalize">
                              {entry}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={!catForm.label.trim() || saveCategory.isPending}
                    onClick={() =>
                      saveCategory.mutate(
                        {
                          slug: slugify(catForm.label),
                          label: catForm.label.trim(),
                          accent: catForm.accent,
                        },
                        {
                          onSuccess: () => {
                            setCatForm({ label: "", accent: "primary" });
                            setCatOpen(false);
                          },
                        },
                      )
                    }
                  >
                    Create category
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={subOpen} onOpenChange={setSubOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">New sub category</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New sub category</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Parent category</Label>
                    <Select
                      value={subForm.categoryId}
                      onValueChange={(value) =>
                        setSubForm((prev) => ({ ...prev, categoryId: value }))
                      }
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
                    <Label htmlFor="sub-label">Label</Label>
                    <Input
                      id="sub-label"
                      value={subForm.label}
                      onChange={(event) =>
                        setSubForm((prev) => ({ ...prev, label: event.target.value }))
                      }
                      placeholder="Contract Renewal"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={
                      !subForm.categoryId || !subForm.label.trim() || saveSubcategory.isPending
                    }
                    onClick={() =>
                      saveSubcategory.mutate(
                        {
                          categoryId: subForm.categoryId,
                          slug: slugify(subForm.label),
                          label: subForm.label.trim(),
                        },
                        {
                          onSuccess: () => {
                            setSubForm({ categoryId: "", label: "" });
                            setSubOpen(false);
                          },
                        },
                      )
                    }
                  >
                    Create sub category
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {categories.length === 0 ? (
        <EmptyState title="No categories yet" description="Create the first category to begin." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const catPromises = promises.filter((row) => row.category_id === category.id);
            const subs = subcategories.filter((sub) => sub.category_id === category.id);
            return (
              <div key={category.id} className="glass-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold">{category.label}</p>
                    <p className="mono text-xs text-muted-foreground">{category.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {catPromises.length} promises
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditCat({
                          id: category.id,
                          label: category.label,
                          accent: category.accent,
                        })
                      }
                    >
                      Edit
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {subs.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                      onClick={() =>
                        setEditSub({
                          id: sub.id,
                          categoryId: sub.category_id,
                          label: sub.label,
                        })
                      }
                      aria-label={`Edit sub category ${sub.label}`}
                    >
                      {sub.label}
                    </button>
                  ))}
                  {subs.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No sub categories</span>
                  ) : null}
                </div>

                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  {catPromises.slice(0, 3).map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm">{row.title}</p>
                      <StatusBadge status={row.status} />
                    </div>
                  ))}
                  {catPromises.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No promises in this category.</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Nano categories</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          The third classification level applied when a promise is created.
        </p>
        <div className="glass-panel divide-y divide-border">
          {NANO_CATEGORIES.map((nano) => {
            const count = promises.filter((row) => row.nano_category === nano).length;
            return (
              <div key={nano} className="flex items-center justify-between gap-4 p-4">
                <p className="text-sm">{nano}</p>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                  {count} promises
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={editCat !== null} onOpenChange={(open) => !open && setEditCat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          {editCat ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-cat-label">Label</Label>
                <Input
                  id="edit-cat-label"
                  value={editCat.label}
                  onChange={(event) =>
                    setEditCat((prev) => (prev ? { ...prev, label: event.target.value } : prev))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Accent</Label>
                <Select
                  value={editCat.accent}
                  onValueChange={(value) =>
                    setEditCat((prev) => (prev ? { ...prev, accent: value } : prev))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["primary", "info", "success", "warning", "destructive", "tracker"].map(
                      (entry) => (
                        <SelectItem key={entry} value={entry} className="capitalize">
                          {entry}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditCat(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editCat?.label.trim() || saveCategory.isPending}
              onClick={() =>
                editCat &&
                saveCategory.mutate(
                  {
                    id: editCat.id,
                    slug: slugify(editCat.label),
                    label: editCat.label.trim(),
                    accent: editCat.accent,
                  },
                  { onSuccess: () => setEditCat(null) },
                )
              }
            >
              Save category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editSub !== null} onOpenChange={(open) => !open && setEditSub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit sub category</DialogTitle>
          </DialogHeader>
          {editSub ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Parent category</Label>
                <Select
                  value={editSub.categoryId}
                  onValueChange={(value) =>
                    setEditSub((prev) => (prev ? { ...prev, categoryId: value } : prev))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label htmlFor="edit-sub-label">Label</Label>
                <Input
                  id="edit-sub-label"
                  value={editSub.label}
                  onChange={(event) =>
                    setEditSub((prev) => (prev ? { ...prev, label: event.target.value } : prev))
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditSub(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editSub?.label.trim() || saveSubcategory.isPending}
              onClick={() =>
                editSub &&
                saveSubcategory.mutate(
                  {
                    id: editSub.id,
                    categoryId: editSub.categoryId,
                    slug: slugify(editSub.label),
                    label: editSub.label.trim(),
                  },
                  { onSuccess: () => setEditSub(null) },
                )
              }
            >
              Save sub category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
