// The record shape the role dashboards' workspaces render, and the helpers they
// export records with.
//
// This used to be a store as well: every workspace kept its records in the
// browser's memory, so anything created on a dashboard was gone on reload and
// never reached the platform. The records now come from the platform - see
// lib/dashboard-records, lib/useResellerCustomers, lib/useResellerLeads,
// lib/ams/use-my-tickets and lib/ams/use-ams-center - and only the shape is
// kept here.

export type RecordStatus = "active" | "pending" | "archived" | "draft" | "approved" | "rejected";

export type CrudComment = { id: string; author: string; text: string; date: string };
export type CrudAudit = { id: string; action: string; by: string; date: string; detail?: string };
export type CrudAttachment = { id: string; name: string; size: number; date: string };

export type CrudRecord = {
  id: string;
  name: string;
  status: RecordStatus;
  owner: string;
  category: string;
  amount: number;
  date: string;            // ISO
  notes: string;
  tags: string[];
  comments: CrudComment[];
  audit: CrudAudit[];
  attachments: CrudAttachment[];
  // module-specific extras land in `extra`
  extra: Record<string, string | number>;
};

export function exportJson(records: CrudRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function downloadFile(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}
