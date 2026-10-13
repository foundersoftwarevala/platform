import { randomUUID } from "node:crypto";
import { z } from "zod";
import { all, run, tx } from "../db.server";
import { requireRole, type Operator } from "../auth.server";
import type { Database, Json, Tables } from "./source-types";

type Collection = keyof Database["public"]["Tables"];
type Document = { [key: string]: Json | undefined };
type Related<T extends Collection> = Tables<T> & {
  library_items?: Tables<"library_items"> | null;
  dev_clients?: Tables<"dev_clients"> | null;
};
const COLLECTIONS = new Set<Collection>([
  "agent_builds",
  "dev_audit_logs",
  "dev_clients",
  "dev_issues",
  "dev_matches",
  "dev_projects",
  "dev_requirements",
  "dev_versions",
  "dev_workspaces",
  "library_items",
]);
const json: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(json),
    z.record(json.optional()),
  ]),
);
const documentSchema = z.record(json.optional());

function records(collection: Collection): Document[] {
  return all<{ document: string }>(
    "select document from studio_records where collection = ? order by rowid",
    collection,
  ).map((r) => documentSchema.parse(JSON.parse(r.document)));
}

function defaults(collection: Collection, actor: string): Document {
  const at = new Date().toISOString();
  const id = randomUUID();
  const common = { id, created_at: at, updated_at: at };
  switch (collection) {
    case "agent_builds":
      return { ...common, data: {}, owner_id: actor };
    case "dev_projects":
      return {
        ...common,
        project_code: `SV-PROJECT-${id.slice(0, 8).toUpperCase()}`,
        status: "intake",
        client_name: null,
        client_id: null,
        selected_item_id: null,
        branding: {},
      };
    case "dev_requirements":
      return { ...common, analysis: null };
    case "dev_clients":
      return { ...common, email: null, phone: null, source: "local", data: {} };
    case "dev_workspaces":
      return { ...common, files: [], branding: {}, changes: [] };
    case "dev_versions":
      return { ...common, build_info: {}, license_info: {}, release_id: null };
    case "dev_audit_logs":
      return { ...common, actor, project_id: null, details: {} };
    case "dev_issues":
      return {
        ...common,
        issue_code: `SV-ISS-${id.slice(0, 8).toUpperCase()}`,
        status: "open",
        fixed_version_id: null,
        version_id: null,
      };
    case "dev_matches":
      return { ...common, requirement_id: null, evidence: {} };
    case "library_items":
      return {
        ...common,
        category: null,
        modules: [],
        features: [],
        technology: [],
        capabilities: [],
        database_engine: null,
        framework: null,
        version: null,
        compatibility: null,
        known_requirements: null,
        metadata: {},
        indexed_at: at,
      };
  }
}

type Result<T extends Collection> = {
  data: Related<T>[];
  error: { message: string } | null;
  count: number;
};
class Query<T extends Collection> implements PromiseLike<Result<T>> {
  private filters: [string, Json | undefined][] = [];
  private insensitiveFilters: [string, string][] = [];
  private sorting: [string, boolean] | null = null;
  private maximum = Infinity;
  private mutation: {
    kind: "insert" | "upsert" | "update" | "delete";
    rows: Document[];
    conflict: string;
  } | null = null;
  private selection = "*";
  private result: Result<T> | null = null;

  constructor(
    private collection: T,
    private operator: Operator,
  ) {}
  select(selection = "*", _options?: { count?: string; head?: boolean }) {
    this.selection = selection;
    return this;
  }
  eq(field: string, value: Json | undefined) {
    this.filters.push([field, value]);
    return this;
  }
  ilike(field: string, value: string) {
    if (/[%_]/.test(value))
      throw new Error("Project lookup requires an exact project code, not a wildcard.");
    this.insensitiveFilters.push([field, value.toLowerCase()]);
    return this;
  }
  order(field: string, options: { ascending?: boolean } = {}) {
    this.sorting = [field, options.ascending !== false];
    return this;
  }
  limit(maximum: number) {
    this.maximum = maximum;
    return this;
  }
  insert(rows: unknown) {
    this.mutation = { kind: "insert", rows: this.parse(rows), conflict: "id" };
    return this;
  }
  upsert(rows: unknown, options: { onConflict?: string } = {}) {
    this.mutation = {
      kind: "upsert",
      rows: this.parse(rows),
      conflict: options.onConflict ?? "id",
    };
    return this;
  }
  update(row: unknown) {
    this.mutation = { kind: "update", rows: this.parse(row), conflict: "id" };
    return this;
  }
  delete() {
    this.mutation = { kind: "delete", rows: [], conflict: "id" };
    return this;
  }
  private parse(rows: unknown) {
    return z.array(documentSchema).parse(Array.isArray(rows) ? rows : [rows]);
  }
  private matches(row: Document) {
    return (
      this.filters.every(([k, v]) => row[k] === v) &&
      this.insensitiveFilters.every(
        ([k, v]) => typeof row[k] === "string" && row[k].toLowerCase() === v,
      )
    );
  }
  private execute() {
    if (this.result) return this.result;
    let rows = records(this.collection);
    if (this.mutation) {
      requireRole(this.operator, "operator");
      const mutation = this.mutation;
      rows = tx(() => {
        const changed: Document[] = [];
        if (mutation.kind === "delete") {
          for (const row of rows.filter((r) => this.matches(r))) {
            run(
              "delete from studio_records where collection = ? and id = ?",
              this.collection,
              row.id,
            );
          }
          return changed;
        }
        const incoming =
          mutation.kind === "update" ? rows.filter((r) => this.matches(r)) : mutation.rows;
        for (const input of incoming) {
          const old =
            mutation.kind === "update"
              ? input
              : mutation.kind === "upsert"
                ? rows.find((r) => r[mutation.conflict] === input[mutation.conflict])
                : undefined;
          const row = {
            ...(old ?? defaults(this.collection, this.operator.id)),
            ...(mutation.kind === "update" ? mutation.rows[0] : input),
          };
          if (this.collection === "agent_builds" && row.owner_id !== this.operator.id)
            throw new Error("This build belongs to another Control Panel operator.");
          if (old)
            run(
              "update studio_records set document = ? where collection = ? and id = ?",
              JSON.stringify(row),
              this.collection,
              row.id,
            );
          else
            run(
              "insert into studio_records(collection,id,document) values(?,?,?)",
              this.collection,
              row.id,
              JSON.stringify(row),
            );
          changed.push(row);
        }
        return changed;
      });
    } else {
      rows = rows.filter(
        (r) =>
          this.matches(r) &&
          (this.collection !== "agent_builds" || r.owner_id === this.operator.id),
      );
    }
    if (this.sorting) {
      const [field, asc] = this.sorting;
      rows.sort((a, b) => {
        const x = a[field],
          y = b[field];
        const comparison =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y));
        return asc ? comparison : -comparison;
      });
    }
    const count = rows.length;
    const related = rows.slice(0, this.maximum).map((r) => {
      const row = { ...r };
      if (this.selection.includes("library_items("))
        row.library_items =
          records("library_items").find((item) => item.id === row.item_id) ?? null;
      if (this.selection.includes("dev_clients("))
        row.dev_clients =
          records("dev_clients").find((client) => client.id === row.client_id) ?? null;
      // Documents originate from the imported typed table contracts, with defaults above.
      return row as Related<T>;
    });
    this.result = { data: related, error: null, count };
    return this.result;
  }
  then<TResult1 = Result<T>, TResult2 = never>(
    fulfilled?: ((value: Result<T>) => TResult1 | PromiseLike<TResult1>) | null,
    rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(fulfilled, rejected);
  }
  async single() {
    const r = await this;
    if (r.data.length !== 1)
      throw new Error(`Expected one ${this.collection} record; found ${r.data.length}.`);
    return { ...r, data: r.data[0]! };
  }
  async maybeSingle() {
    const r = await this;
    if (r.data.length > 1) throw new Error(`Expected at most one ${this.collection} record.`);
    return { ...r, data: r.data[0] ?? null };
  }
}

export function studioStore(operator: Operator) {
  requireRole(operator, "viewer");
  return {
    from<T extends Collection>(collection: T) {
      if (!COLLECTIONS.has(collection)) throw new Error("Unknown Vala studio collection.");
      return new Query(collection, operator);
    },
  };
}
