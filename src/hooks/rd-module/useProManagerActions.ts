import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logger, toMessage } from "@/lib/rd-module/logger";
import {
  acknowledgeAlert,
  createTicket,
  decideRequest,
  exportAuditTrail,
  generateReport,
  resolveEscalation,
  saveSatisfactionPrediction,
  sendHelpdeskMessage,
  setProUserStatus,
  startConversation,
  toggleSetting,
  updateAssistSession,
  updateConversation,
  updateIssue,
  updateLicense,
  updatePromise,
  updateQualityAlert,
  updateRenewal,
  updateTicketStatus,
  updateUpgrade,
} from "@/lib/rd-module/pm-data.functions";

export const useProManagerActions = () => {
  const queryClient = useQueryClient();

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["pm"] });

  const fns = {
    setProUserStatus: useServerFn(setProUserStatus),
    createTicket: useServerFn(createTicket),
    updateTicketStatus: useServerFn(updateTicketStatus),
    updateIssue: useServerFn(updateIssue),
    updateLicense: useServerFn(updateLicense),

    updateAssistSession: useServerFn(updateAssistSession),
    updatePromise: useServerFn(updatePromise),
    updateUpgrade: useServerFn(updateUpgrade),
    updateRenewal: useServerFn(updateRenewal),
    acknowledgeAlert: useServerFn(acknowledgeAlert),
    resolveEscalation: useServerFn(resolveEscalation),
    updateQualityAlert: useServerFn(updateQualityAlert),
    decideRequest: useServerFn(decideRequest),
    toggleSetting: useServerFn(toggleSetting),
    generateReport: useServerFn(generateReport),
    exportAuditTrail: useServerFn(exportAuditTrail),
    saveSatisfactionPrediction: useServerFn(saveSatisfactionPrediction),
    startConversation: useServerFn(startConversation),
    updateConversation: useServerFn(updateConversation),
    sendHelpdeskMessage: useServerFn(sendHelpdeskMessage),
  };

  async function run<T>(label: string, promise: Promise<T>): Promise<T | null> {
    try {
      const result = await promise;
      invalidate();
      logger.info({ scope: "pm.actions", event: "action_succeeded", action: label });
      toast.success(label);
      return result;
    } catch (error) {
      logger.error({ scope: "pm.actions", event: "action_failed", action: label }, error);
      toast.error(label + " failed", { description: toMessage(error) });
      return null;
    }
  }

  return { ...fns, run, invalidate };
};

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
