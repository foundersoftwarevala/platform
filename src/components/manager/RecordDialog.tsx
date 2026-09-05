import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import type { Column } from "@/components/seo/DataTable";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SeoTableName, SeoValue } from "@/lib/use-seo-actions";
import { useRecordActions } from "@/lib/use-seo-actions";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "date" | "datetime" | "boolean" | "tags";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  default?: SeoValue;
  /** Hide from the create form (server/derived defaults only). */
  editOnly?: boolean;
};

export type EntitySpec = {
  table: SeoTableName;
  label: string;
  /** Column used in confirmation copy. */
  titleField: string;
  fields: FieldSpec[];
  /** Field driving the quick inline status control. */
  statusField?: string;
  statusOptions?: string[];
};

type FormState = Record<string, string | boolean>;

function toFormValue(field: FieldSpec, value: unknown): string | boolean {
  if (field.type === "boolean") return Boolean(value);
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (field.type === "date" && typeof value === "string") return value.slice(0, 10);
  if (field.type === "datetime" && typeof value === "string") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  return String(value);
}

function initialState(spec: EntitySpec, row?: Record<string, unknown>): FormState {
  const state: FormState = {};
  for (const field of spec.fields) {
    state[field.name] = row
      ? toFormValue(field, row[field.name])
      : toFormValue(field, field.default ?? (field.type === "number" ? 0 : ""));
  }
  return state;
}

function toDbValues(spec: EntitySpec, state: FormState): Record<string, SeoValue> {
  const values: Record<string, SeoValue> = {};
  for (const field of spec.fields) {
    const raw = state[field.name];
    if (field.type === "boolean") {
      values[field.name] = Boolean(raw);
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (field.type === "number") {
      values[field.name] = text === "" ? 0 : Number(text);
      continue;
    }
    if (field.type === "tags") {
      values[field.name] = text === "" ? [] : text.split(",").map((t) => t.trim()).filter(Boolean);
      continue;
    }
    if (field.type === "datetime") {
      values[field.name] = text === "" ? null : new Date(text).toISOString();
      continue;
    }
    values[field.name] = text === "" ? (field.required ? "" : null) : text;
  }
  return values;
}

function FieldControl({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: FieldSpec;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${field.name}`;
  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <Label htmlFor={id}>{field.label}</Label>
        <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {field.label}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {field.type === "select" ? (
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full capitalize">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option} className="capitalize">
                {option.replace(/[_-]/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          rows={5}
          value={String(value)}
          placeholder={field.placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={
            field.type === "number"
              ? "number"
              : field.type === "date"
                ? "date"
                : field.type === "datetime"
                  ? "datetime-local"
                  : "text"
          }
          {...(field.type === "number"
            ? { min: field.min ?? 0, ...(field.max != null ? { max: field.max } : {}), step: field.step ?? 1 }
            : {})}
          value={String(value)}
          placeholder={field.placeholder ?? (field.type === "tags" ? "comma, separated, values" : "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function RecordDialog({
  spec,
  row,
  open,
  onOpenChange,
}: {
  spec: EntitySpec;
  row?: Record<string, unknown> | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { insert, update } = useRecordActions();
  const editing = Boolean(row);
  const fields = useMemo(
    () => spec.fields.filter((f) => (editing ? true : !f.editOnly)),
    [editing, spec.fields],
  );
  const [state, setState] = useState<FormState>(() => initialState(spec, row));

  useEffect(() => {
    if (open) setState(initialState(spec, row));
  }, [open, row, spec]);

  const missingRequired = fields.some(
    (f) => f.required && f.type !== "boolean" && String(state[f.name] ?? "").trim() === "",
  );
  const pending = insert.isPending || update.isPending;

  function submit() {
    if (missingRequired || pending) return;
    const all = toDbValues(spec, state);
    const values: Record<string, SeoValue> = {};
    for (const field of fields) values[field.name] = all[field.name] as SeoValue;
    if (editing && row) {
      update.mutate(
        { table: spec.table, id: String(row["id"]), values },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      insert.mutate({ table: spec.table, values }, { onSuccess: () => onOpenChange(false) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${spec.label.toLowerCase()}` : `New ${spec.label.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>
            Saved directly to the connected database — the table refreshes immediately.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {fields.map((field) => (
            <FieldControl
              key={field.name}
              field={field}
              idPrefix={`${spec.table}-${editing ? "edit" : "new"}`}
              value={state[field.name] ?? ""}
              onChange={(value) => setState((prev) => ({ ...prev, [field.name]: value }))}
            />
          ))}
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={missingRequired || pending}>
              {editing ? "Save changes" : `Create ${spec.label.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateRecordButton({
  spec,
  label,
  size = "sm",
  variant,
}: {
  spec: EntitySpec;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant ?? "default"} onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" className="h-4 w-4" /> {label ?? `New ${spec.label.toLowerCase()}`}
      </Button>
      <RecordDialog spec={spec} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function RowActions({ spec, row }: { spec: EntitySpec; row: Record<string, unknown> }) {
  const { remove } = useRecordActions();
  const [open, setOpen] = useState(false);
  const title = String(row[spec.titleField] ?? spec.label);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label={`Edit ${title}`}
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete ${title}`}>
            <Trash2 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {spec.label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{title}” will be permanently removed from the database. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate({ table: spec.table, id: String(row["id"]) })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RecordDialog spec={spec} row={row} open={open} onOpenChange={setOpen} />
    </div>
  );
}

/** Inline status editor that persists immediately. */
export function StatusSelect({
  table,
  id,
  field = "status",
  value,
  options,
  label,
}: {
  table: SeoTableName;
  id: string;
  field?: string;
  value: string;
  options: string[];
  label?: string;
}) {
  const { update } = useRecordActions();
  return (
    <Select
      value={value}
      onValueChange={(next) =>
        next !== value && update.mutate({ table, id, values: { [field]: next } })
      }
    >
      <SelectTrigger aria-label={label ?? "Change status"} className="h-9 w-[150px] capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option} className="capitalize">
            {option.replace(/[_-]/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function actionsColumn<T extends { id: string }>(spec: EntitySpec): Column<T> {
  return {
    key: "__actions",
    header: "Actions",
    className: "text-right",
    render: (row) => <RowActions spec={spec} row={row as unknown as Record<string, unknown>} />,
  };
}

export function statusColumn<T extends { id: string }>(
  spec: EntitySpec,
  header = "Status",
): Column<T> {
  const field = spec.statusField ?? "status";
  return {
    key: `__status_${field}`,
    header,
    render: (row) => (
      <StatusSelect
        table={spec.table}
        id={row.id}
        field={field}
        value={String((row as unknown as Record<string, unknown>)[field] ?? "")}
        options={spec.statusOptions ?? []}
      />
    ),
  };
}
