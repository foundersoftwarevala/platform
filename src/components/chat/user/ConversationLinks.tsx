import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, MessageSquare, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createLeadFromConversation,
  createTaskFromConversation,
  findConversationFor,
  listConversationLinks,
} from "@/lib/chat/links.functions";
import { useTranslation } from "@/lib/i18n/use-translation";

export function OpenLinkedConversation({
  entityType,
  entityId,
}: {
  entityType: "task" | "lead";
  entityId: string;
}) {
  const { t } = useTranslation();
  const find = useServerFn(findConversationFor);
  const link = useQuery({
    queryKey: ["chat-conversation-link", entityType, entityId],
    queryFn: () => find({ data: { entityType, entityId } }),
  });
  const result = link.data;
  if (link.isError) {
    return (
      <p role="alert" className="text-xs text-destructive">
        {t("chat.links.lookup_failed", { error: link.error.message })}
      </p>
    );
  }
  if (link.isLoading || !result?.ok) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="gap-1.5"
      onClick={() => {
        const route = result.manager_access ? "/chat-manager" : "/chat";
        const params = new URLSearchParams({ conversationId: result.conversation_id });
        window.location.assign(`${route}?${params.toString()}`);
      }}
    >
      <MessageSquare className="size-4" />
      {t("chat.links.open_conversation")}
    </Button>
  );
}

/**
 * Tasks and leads raised from this conversation, for the people who handle it.
 * Task Manager and Lead Manager keep a reference to the conversation; nothing
 * is copied out of it.
 */
export function ConversationLinks({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const list = useServerFn(listConversationLinks);
  const raiseTask = useServerFn(createTaskFromConversation);
  const raiseLead = useServerFn(createLeadFromConversation);
  const key = ["conversation-links", conversationId];

  const links = useQuery({ queryKey: key, queryFn: () => list({ data: { conversationId } }) });
  const done = (result: { ok: boolean; error?: string }) => {
    if (!result.ok) {
      toast.error(result.error ?? t("chat.links.failed"));
      return;
    }
    toast.success(t("chat.links.created"));
    void queryClient.invalidateQueries({ queryKey: key });
  };
  const task = useMutation({
    mutationFn: () => raiseTask({ data: { conversationId, priority: "medium" } }),
    onSuccess: done,
    onError: (error: Error) => toast.error(error.message),
  });
  const lead = useMutation({
    mutationFn: () => raiseLead({ data: { conversationId } }),
    onSuccess: done,
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = links.data && links.data.ok ? links.data.links : [];
  const tasks = rows.filter((row) => row.entity_type === "task").length;
  const leads = rows.filter((row) => row.entity_type === "lead").length;

  return (
    <div className="space-y-2 border-b border-border/60 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("chat.links.title")}
      </p>
      <p className="text-xs text-muted-foreground">{t("chat.links.summary", { tasks, leads })}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={task.isPending}
          onClick={() => task.mutate()}
        >
          <ClipboardList className="size-3.5" /> {t("chat.links.create_task")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={lead.isPending || leads > 0}
          onClick={() => lead.mutate()}
        >
          <UserPlus className="size-3.5" /> {t("chat.links.create_lead")}
        </Button>
      </div>
    </div>
  );
}
