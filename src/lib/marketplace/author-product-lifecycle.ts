export const AUTHOR_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["submitted"],
  submitted: ["draft"],
  changes_requested: ["submitted", "draft"],
  rejected: ["draft"],
};

const editableStatuses = new Set(["draft", "changes_requested", "rejected"]);

export function getAuthorProductActions(status: string) {
  const transitions = AUTHOR_TRANSITIONS[status] ?? [];
  const canEdit = editableStatuses.has(status);
  const canSubmit = transitions.includes("submitted");
  const canWithdraw = status === "submitted" && transitions.includes("draft");
  const canReturnToDraft = status === "rejected" && transitions.includes("draft");

  return {
    canEdit,
    canSubmit,
    canWithdraw,
    canReturnToDraft,
    readOnly: !canEdit && !canSubmit && !canWithdraw && !canReturnToDraft,
  };
}
