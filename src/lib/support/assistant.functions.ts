import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { aiComplete } from "@/lib/ai-gateway.server";

/**
 * The support desk's AI troubleshooter.
 *
 * The panel answered every question, after a pause, with the same sentence
 * about "a cache synchronization issue". It now asks the model the AI API
 * Manager has configured, as the support team, with the agent's own question
 * and the tone they chose. The model is told not to invent account details or
 * ticket history it has not been given.
 *
 * Only the support team and platform operators may use it: a model call costs
 * money, and this is a browser-reachable function.
 */

const ROLES = new Set([
  "support", "sales_support_manager",
  "admin", "boss", "boss_owner", "super_admin", "founder",
]);

async function requireSupportCaller() {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Please sign in");
  const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error("Please sign in");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id);
  if (!(data ?? []).some((r) => ROLES.has(String(r.role)))) {
    throw new Error("The troubleshooter is for the support team.");
  }
}

const TONE = {
  calm: "calm and reassuring",
  professional: "professional and precise",
  friendly: "warm and friendly",
} as const;

export const askSupportAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(30),
      tone: z.enum(["calm", "professional", "friendly"]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireSupportCaller();
    const result = await aiComplete({
      module: "support",
      temperature: 0.4,
      maxTokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You help a customer-support agent of Software Vala, a software marketplace, resolve a customer's issue. " +
            "Suggest concrete troubleshooting steps and, when asked, draft a reply to the customer in a " +
            `${TONE[data.tone]} tone. You have not been given the customer's account, logs or ticket history: ` +
            "do not invent them, and say what the agent should check instead. Be brief.",
        },
        ...data.messages.slice(-20),
      ],
    });
    return { reply: result.text.trim(), model: result.model };
  });
