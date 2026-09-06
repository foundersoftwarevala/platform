import { useCallback, useState } from "react";
import { toast } from "sonner";

import { askLegalAI } from "@/lib/legal-ai.functions";
import type { LegalAIType } from "@/lib/legal-ai.server";

/**
 * The browser's only way to reach the legal AI.
 *
 * Section 25 draws the line and it matters here more than anywhere: the browser
 * never talks to a model. It calls a server function, which resolves the
 * provider and credential through AI API Manager, records the run, and returns
 * the text. No key is ever in the client bundle and none can be.
 *
 * Every result comes back marked advisory, and the notice travels with it, so a
 * screen cannot present a draft as a finding. The request id comes back too,
 * which is what lets a person's later decision be attached to the run that
 * produced the text they were looking at.
 */
export type LegalAIResult = {
  text: string;
  requestId?: string;
  notice: string;
  model: string | null;
  service: string;
};

export function useLegalAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<LegalAIResult | null>(null);

  const callLegalAI = useCallback(
    async (
      type: LegalAIType,
      prompt: string,
      options?: { jurisdiction?: string; contractType?: string; context?: string },
    ): Promise<string | null> => {
      setIsLoading(true);
      try {
        const res = await askLegalAI({
          data: {
            type,
            prompt,
            jurisdiction: options?.jurisdiction,
            contractType: options?.contractType,
            context: options?.context,
          },
        });
        const result: LegalAIResult = {
          text: res.text,
          requestId: res.requestId,
          notice: res.notice,
          model: res.model,
          service: res.service,
        };
        setLastResult(result);
        // Said every time, not once at the top of the screen. A draft that
        // scrolls past its own disclaimer is a draft somebody will quote.
        return `${res.text}\n\n---\n${res.notice}`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The legal AI request failed.";
        toast.error("Legal AI unavailable", { description: message });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { callLegalAI, isLoading, lastResult };
}

export default useLegalAI;
