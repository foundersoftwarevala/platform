import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { PAGES, type Col, type Row } from "@/lib/vala-ai/studio/manager-pages";
import { loadManagerRecordsFn, saveManagerRecordsFn } from "@/lib/vala-ai/studio/manager.functions";
import { useCan } from "../session";

/** These are module records, never a replacement for platform account or payment management. */
export function ManagerPage({ name }: { name: string }) {
  const cfg = PAGES[name];
  const [rows, setRows] = useState<Row[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = useCan("boss") && !readOnly && !busy;
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    let current = true;
    setRows([]);
    setReadOnly(true);
    setVersion(null);
    setError(null);
    void loadManagerRecordsFn({ data: { name } })
      .then((result) => {
        if (!current) return;
        setRows(result.rows);
        setVersion(result.version);
        setReadOnly(result.readOnly);
      })
      .catch((e: unknown) => {
        if (current) setError(e instanceof Error ? e.message : "Module records could not load.");
      });
    setQ("");
    setEdit(null);
    return () => {
      current = false;
    };
  }, [name]);
  const save = async (next: Row[]) => {
    setBusy(true);
    setError(null);
    try {
      const result = await saveManagerRecordsFn({ data: { name, rows: next, version } });
      setRows(next);
      setVersion(result.version);
      setEdit(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Module records could not save.");
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          !r.archived && (!q || Object.values(r).join(" ").toLowerCase().includes(q.toLowerCase())),
      ),
    [rows, q],
  );
  if (!cfg)
    return <div className="grid h-full place-items-center text-sm text-studio-dim">{name}</div>;

  const blank = (): Row =>
    Object.fromEntries([
      ["id", crypto.randomUUID()],
      ...cfg.cols.map((c) => [c.key, c.type === "toggle" ? true : (c.options?.[0] ?? "")]),
    ]);
  const submit = () => {
    if (!edit) return;
    void save(isNew ? [edit, ...rows] : rows.map((r) => (r["id"] === edit["id"] ? edit : r)));
  };

  return (
    <div className="mx-auto max-w-[1040px] px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{name}</h1>
          <p className="mt-1 text-xs text-studio-dim">{cfg.desc}</p>
          <p className="mt-1 text-xs text-studio-dim">
            {readOnly
              ? "Read-only platform configuration. Manage access and models in the existing Control Panel."
              : "Vala AI module records only. These do not change platform business data or execute payments."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs">
            <Search className="size-3.5 text-studio-dim" />
            <input
              aria-label={`Search ${name}`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="w-40 bg-transparent outline-none"
            />
          </label>
          <button
            disabled={!canEdit}
            onClick={() => {
              setEdit(blank());
              setIsNew(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"
          >
            <Plus className="size-3.5" /> {cfg.add ?? "Add"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-destructive p-3 text-destructive">
          {error}
        </p>
      )}
      <div className="mt-5 overflow-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead className="bg-secondary text-[10px] uppercase tracking-[0.12em] text-studio-dim">
            <tr>
              {cfg.cols.map((c) => (
                <th key={c.key} className="px-4 py-2.5 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={String(r["id"])} className="border-t border-border">
                {cfg.cols.map((c) => (
                  <td key={c.key} className="px-4 py-2.5">
                    {c.type === "toggle" ? (
                      <button
                        disabled={!canEdit}
                        aria-label={`Toggle ${c.label}`}
                        onClick={() =>
                          void save(
                            rows.map((x) =>
                              x["id"] === r["id"] ? { ...x, [c.key]: !x[c.key] } : x,
                            ),
                          )
                        }
                        className={`h-5 w-9 rounded-full p-0.5 transition ${r[c.key] ? "bg-primary" : "bg-secondary"}`}
                      >
                        <span
                          className={`block size-4 rounded-full bg-foreground transition ${r[c.key] ? "translate-x-4" : ""}`}
                        />
                      </button>
                    ) : c.type === "select" ? (
                      <span className="rounded-full bg-secondary px-2 py-0.5">
                        {String(r[c.key] ?? "")}
                      </span>
                    ) : (
                      <span
                        className={c.key === cfg.cols[0]!.key ? "font-medium" : "text-studio-dim"}
                      >
                        {String(r[c.key] ?? "")}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <button
                    disabled={!canEdit}
                    aria-label="Edit"
                    onClick={() => {
                      setEdit({ ...r });
                      setIsNew(false);
                    }}
                    className="p-1 text-studio-dim hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    disabled={!canEdit}
                    aria-label="Retire"
                    onClick={() =>
                      void save(rows.map((x) => (x.id === r.id ? { ...x, archived: true } : x)))
                    }
                    className="p-1 text-studio-dim hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td
                  colSpan={cfg.cols.length + 1}
                  className="px-4 py-10 text-center text-studio-dim"
                >
                  Nothing here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-studio-dim">{rows.length} item(s)</p>

      {edit && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4"
          onClick={() => setEdit(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{isNew ? (cfg.add ?? "Add") : "Edit"}</h2>
              <button aria-label="Close" onClick={() => setEdit(null)}>
                <X className="size-4 text-studio-dim" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {cfg.cols.map((c: Col) => (
                <label key={c.key} className="block text-xs">
                  <span className="text-studio-dim">{c.label}</span>
                  {c.type === "toggle" ? (
                    <input
                      type="checkbox"
                      checked={!!edit[c.key]}
                      onChange={(e) => setEdit({ ...edit, [c.key]: e.target.checked })}
                      className="ml-2 align-middle"
                    />
                  ) : c.type === "select" ? (
                    <select
                      value={String(edit[c.key] ?? "")}
                      onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })}
                      className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2"
                    >
                      {c.options!.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={String(edit[c.key] ?? "")}
                      onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })}
                      className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEdit(null)}
                className="h-9 rounded-lg border border-border px-4 text-xs"
              >
                Cancel
              </button>
              <button
                disabled={!canEdit}
                onClick={submit}
                className="h-9 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground"
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
