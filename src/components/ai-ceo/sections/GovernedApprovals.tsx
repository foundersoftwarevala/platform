import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, FileSearch, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useApprovalSuggestions } from "@/hooks/useFounderGovernance";

/**
 * Decisions the governance engine has put to a human.
 *
 * This sits beside the CEO suggestion queue rather than replacing it: that
 * queue is advisory suggestions, and these are governed decisions with
 * evidence, a policy and a deadline behind them. Both are real, and they are
 * different things, so both are shown.
 *
 * Section 28 asks that the surface show what happened, why it matters, the
 * evidence, the risk, the impact, the recommendation, who must approve, by
 * when and what state it is in — and section 33 asks that it never reduce to
 * "AI recommends this". So the evidence count separates sourced evidence from
 * the total, a decision with an evidence gap says which gap, and a decision
 * that is only inference cannot be hidden behind a confidence number.
 */

const TONE: Record<string, string> = {
  CRITICAL: "bg-destructive/20 text-destructive border-destructive/30",
  HIGH: "bg-destructive/20 text-destructive border-destructive/30",
  MEDIUM: "bg-accent-amber/20 text-accent-amber border-accent-amber/30",
  LOW: "bg-accent-emerald/20 text-accent-emerald border-accent-emerald/30",
  INFO: "bg-primary/20 text-primary border-primary/30",
};

function when(value: string | null): string {
  if (!value) return "no deadline";
  const at = new Date(value);
  if (!Number.isFinite(at.getTime())) return value;
  const hours = Math.round((at.getTime() - Date.now()) / 3_600_000);
  if (hours < 0) return "expired";
  if (hours < 24) return `${hours}h left`;
  return `${Math.round(hours / 24)}d left`;
}

export function GovernedApprovals() {
  const { t } = useTranslation();
  const { suggestions, isLoading, failed, decide, isDeciding } = useApprovalSuggestions();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // Nothing is rendered when there is nothing governed to decide, so this adds
  // no empty furniture to a screen that already has a queue on it.
  if (isLoading || failed || suggestions.length === 0) return null;

  async function answer(approvalId: string, verdict: "APPROVED" | "REJECTED") {
    if (!reason.trim()) return;
    await decide({ approvalId, verdict, reason: reason.trim() });
    setOpenId(null);
    setReason("");
  }

  return (
    <Card className="card3d premium-halo enter-soft rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("ceo.governed_decisions")}
          <Badge variant="outline">{suggestions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((item, i) => (
          <motion.div
            key={item.decisionId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.whatHappened}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <Badge variant="outline" className={TONE[item.risk]}>
                  {t("ceo.risk_badge", { level: item.risk.toLowerCase() })}
                </Badge>
                <Badge variant="outline" className={TONE[item.impact]}>
                  {t("ceo.impact_badge", { level: item.impact.toLowerCase() })}
                </Badge>
              </div>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">{item.whyItMatters}</p>

            {/* What the recommendation actually rests on. */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                {t("ceo.evidence_ratio", {
                  sourced: item.sourcedEvidenceCount,
                  total: item.evidenceCount,
                })}
              </span>
              {item.confidenceScore !== null && (
                <span>{t("ceo.confidence_value", { score: item.confidenceScore })}</span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {when(item.expiresAt)}
              </span>
              {item.awaitingRole && (
                <span>{t("ceo.awaiting_role_value", { role: item.awaitingRole })}</span>
              )}
              <Badge variant="outline">{item.state.replace(/_/g, " ").toLowerCase()}</Badge>
            </div>

            {item.evidenceGap !== "NONE" && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-accent-amber/30 bg-accent-amber/10 px-2 py-1 text-xs text-accent-amber">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {t("ceo.gap_blocks", {
                  gap: item.evidenceGap.replace(/_/g, " ").toLowerCase(),
                })}
              </p>
            )}

            {item.recommendation && (
              <p className="mt-2 text-sm text-foreground">
                <span className="text-muted-foreground">{t("ceo.recommended_prefix")}</span>
                {item.recommendation}
              </p>
            )}

            {item.approvalId && item.approvalState === "REQUESTED" && !item.isExpired && (
              <div className="mt-3">
                {openId === item.approvalId ? (
                  <div className="space-y-2">
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={t("ceo.reason_placeholder")}
                      rows={2}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={isDeciding || !reason.trim()}
                        onClick={() => void answer(item.approvalId!, "APPROVED")}
                      >
                        {t("ceo.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isDeciding || !reason.trim()}
                        onClick={() => void answer(item.approvalId!, "REJECTED")}
                      >
                        {t("ceo.reject")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
                        {t("ceo.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setOpenId(item.approvalId)}>
                    {t("ceo.decide")}
                  </Button>
                )}
              </div>
            )}

            {item.isExpired && (
              <p className="mt-2 text-xs text-muted-foreground">{t("ceo.request_expired")}</p>
            )}
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
