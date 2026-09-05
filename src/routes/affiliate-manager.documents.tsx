import { createFileRoute } from "@tanstack/react-router";
import { FileText, FileSignature, FileCheck2 } from "lucide-react";
import { EntityWall, Row, Cell, fmtDate } from "@/components/affiliate/EntityWall";

type Doc = { id: string; doc_type: string; title: string; version: number; signed: boolean; expires_at: string | null; created_at: string };

export const Route = createFileRoute("/affiliate-manager/documents")({
  head: () => ({ meta: [{ title: "Documents — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Doc>
      title="Documents"
      description="Agreements, NDAs, invoices, certificates, tax and KYC documents with digital signature."
      crumbLabel="Documents"
      table="affiliate_documents"
      searchColumns={["title"]}
      searchPlaceholder="Search documents…"
      filters={["Type", "Signed", "Expiring", "Affiliate"]}
      tabs={["All", "Agreements", "NDA", "Invoices", "Certificates", "Tax", "KYC"]}
      kpis={[
        { label: "Documents", icon: <FileText className="size-4" />, tone: "primary" },
        { label: "Signed", icon: <FileSignature className="size-4" />, tone: "success", filter: [{ column: "signed", value: true }] },
        { label: "Agreements", icon: <FileCheck2 className="size-4" />, filter: [{ column: "doc_type", value: "agreement" }] },
      ]}
      columns={[
        { key: "type", label: "Type" },
        { key: "title", label: "Title" },
        { key: "ver", label: "Version", align: "right" },
        { key: "signed", label: "Signed" },
        { key: "exp", label: "Expires" },
        { key: "created", label: "Created" },
      ]}
      renderRow={(d) => (
        <Row id={d.id}>
          <Cell className="uppercase text-[11px]">{d.doc_type}</Cell>
          <Cell className="font-medium">{d.title}</Cell>
          <Cell align="right" className="tabular-nums">v{d.version}</Cell>
          <Cell>{d.signed ? "Yes" : "—"}</Cell>
          <Cell>{fmtDate(d.expires_at)}</Cell>
          <Cell>{fmtDate(d.created_at)}</Cell>
        </Row>
      )}
      emptyIcon={FileText}
      emptyTitle="No documents"
      emptyDescription="Agreements, invoices, certificates and KYC documents appear here with version history."
      primaryActionLabel="Upload Document"
    />
  ),
});
