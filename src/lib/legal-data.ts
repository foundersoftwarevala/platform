import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type LegalRecord = {
  id: string;
  ref_code: string | null;
  name: string;
  type: string;
  status: string;
  position: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

/** Generic catalogue rows (policies, trademarks, approvals, audit, settings, ...) */
export function useLegalRecords(category: string) {
  return useQuery({
    queryKey: ["legal_records", category],
    queryFn: async (): Promise<LegalRecord[]> => {
      const { data, error } = await supabase
        .from("legal_records")
        .select("*")
        .eq("category", category)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...(row.details as Record<string, unknown>),
        id: row.id,
        ref_code: row.ref_code,
        name: row.name,
        type: row.record_type ?? "",
        status: row.status,
        position: row.position,
      }));
    },
  });
}

export function useLegalPolicies() {
  return useQuery({
    queryKey: ["legal_policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_policies")
        .select("*")
        .order("ref_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLegalDocuments() {
  return useQuery({
    queryKey: ["legal_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLegalAlerts() {
  return useQuery({
    queryKey: ["legal_alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_alerts")
        .select("*")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLegalViolations() {
  return useQuery({
    queryKey: ["legal_violations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_violations")
        .select("*")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTrademarkAssets() {
  return useQuery({
    queryKey: ["legal_trademark_assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_trademark_assets")
        .select("*")
        .order("ref_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMisuseAlerts() {
  return useQuery({
    queryKey: ["legal_misuse_alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_misuse_alerts")
        .select("*")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLegalLogs() {
  return useQuery({
    queryKey: ["legal_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_logs")
        .select("*")
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function appendLog(entry: {
  action: string;
  category: string;
  actor: string;
  details: string;
}) {
  const { error } = await supabase.from("legal_logs").insert({
    ref_code: `LOG-${Date.now().toString(36).toUpperCase()}`,
    immutable: true,
    ...entry,
  });
  if (error) throw error;
}

export function useLogAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: appendLog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_logs"] });
    },
  });
}

export function useUpdateAlertStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("legal_alerts").update({ status }).eq("id", id);
      if (error) throw error;
      await appendLog({
        action: status === "escalated" ? "Alert Escalated" : "AI Flag Reviewed",
        category: "ai_flag",
        actor: "LM-A1B2",
        details: `Alert ${id} marked ${status}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_alerts"] });
      qc.invalidateQueries({ queryKey: ["legal_logs"] });
    },
  });
}

export function useUpdateViolation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      action_notes,
    }: {
      id: string;
      status: string;
      action_notes?: string;
    }) => {
      const { error } = await supabase
        .from("legal_violations")
        .update({ status, ...(action_notes ? { action_notes } : {}) })
        .eq("id", id);
      if (error) throw error;
      await appendLog({
        action: status === "escalated" ? "Violation Escalated" : "Violation Updated",
        category: status === "escalated" ? "escalation" : "violation",
        actor: "LM-A1B2",
        details: `Violation ${id} set to ${status}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_violations"] });
      qc.invalidateQueries({ queryKey: ["legal_logs"] });
    },
  });
}

export function useUpsertDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: {
      name: string;
      doc_type: string;
      access_level: string;
      size_label: string;
      storage_path?: string;
    }) => {
      const { error } = await supabase.from("legal_documents").insert({
        ref_code: `DOC-${Date.now().toString(36).toUpperCase()}`,
        uploaded_by: "LM-A1B2",
        encrypted: true,
        ...doc,
      });
      if (error) throw error;
      await appendLog({
        action: "Document Uploaded",
        category: "document",
        actor: "LM-A1B2",
        details: `Uploaded ${doc.name}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_documents"] });
      qc.invalidateQueries({ queryKey: ["legal_logs"] });
    },
  });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      content,
    }: {
      id: string;
      status?: string;
      content?: string;
    }) => {
      const { error } = await supabase
        .from("legal_policies")
        .update({
          ...(status ? { status } : {}),
          ...(content !== undefined ? { content } : {}),
          last_updated: new Date().toISOString().slice(0, 10),
        })
        .eq("id", id);
      if (error) throw error;
      await appendLog({
        action: status ? "Policy Status Changed" : "Policy Draft Saved",
        category: "policy",
        actor: "LM-A1B2",
        details: `Policy ${id} updated`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_policies"] });
      qc.invalidateQueries({ queryKey: ["legal_logs"] });
    },
  });
}

/** Update a catalogue record's status (contracts, requests, incidents, approvals, compliance items). */
export function useUpdateRecordStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      category,
      status,
      action,
      details,
    }: {
      id: string;
      category: string;
      status: string;
      action: string;
      details: string;
    }) => {
      const { error } = await supabase.from("legal_records").update({ status }).eq("id", id);
      if (error) throw error;
      await appendLog({ action, category, actor: "LM-A1B2", details });
      return { id, status };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["legal_records", vars.category] });
      qc.invalidateQueries({ queryKey: ["legal_logs"] });
    },
  });
}
