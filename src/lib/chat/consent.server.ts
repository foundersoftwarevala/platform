import type { ChatManagerTransaction } from "@/lib/chat/manager-db.server";

export const CHAT_POLICY_VERSION = "chat-policy-2026-10-21-v1";

export type ChatConsentType = "message_storage" | "ai_review";

export type ChatConsentState = {
  messageStorage: boolean;
  aiReview: boolean;
  policyVersion: string | null;
};

type ConsentRow = {
  consent_type: ChatConsentType;
  granted: boolean;
  policy_version: string;
};

export async function readChatConsent(
  tx: ChatManagerTransaction,
  userId: string,
): Promise<ChatConsentState> {
  const rows = await tx<ConsentRow[]>`
    select distinct on (consent_type) consent_type, granted, policy_version
      from public.user_consents
     where user_id = ${userId}::uuid
    order by consent_type, event_id desc
  `;
  const current = rows.filter((row) => row.policy_version === CHAT_POLICY_VERSION && row.granted);
  return {
    messageStorage: current.some((row) => row.consent_type === "message_storage"),
    aiReview: current.some((row) => row.consent_type === "ai_review"),
    policyVersion:
      rows.length === 0 ? null : rows.every((row) => row.policy_version === CHAT_POLICY_VERSION)
        ? CHAT_POLICY_VERSION
        : rows[0]!.policy_version,
  };
}

export async function requireChatConsent(
  tx: ChatManagerTransaction,
  userId: string,
): Promise<void> {
  const consent = await readChatConsent(tx, userId);
  if (!consent.messageStorage || !consent.aiReview) {
    throw new Error("Accept the current chat storage and AI review consent before using chat.");
  }
}

export async function recordChatConsent(
  tx: ChatManagerTransaction,
  userId: string,
  granted: boolean,
): Promise<ChatConsentState> {
  await tx`select pg_advisory_xact_lock(hashtext('chat-consent:' || ${userId}))`;
  await tx`
    insert into public.user_consents
      (user_id, consent_type, granted, policy_version, granted_at)
    values
      (${userId}::uuid, 'message_storage', ${granted}, ${CHAT_POLICY_VERSION}, clock_timestamp()),
      (${userId}::uuid, 'ai_review', ${granted}, ${CHAT_POLICY_VERSION}, clock_timestamp())
  `;
  return readChatConsent(tx, userId);
}
