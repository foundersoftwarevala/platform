import { motion } from "framer-motion";
import { CheckCircle2, Clock, Plug, PlugZap, ShieldAlert, Sparkles, XCircle } from "lucide-react";

import {
  DegradedNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { SourceNote } from "@/components/ai-ceo/ops/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAyraCapabilities, useAyraOrders, type AyraOrder } from "@/hooks/useAyra";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * AYRA, and — more usefully — what AYRA cannot do.
 *
 * The capability register is the centrepiece of this screen rather than a
 * footnote, because the failure mode of a secretary is not refusing work: it
 * is accepting work it cannot do and reporting it done. Seeing, in one place,
 * that WhatsApp is not connected and why, is worth more than a list of
 * completed orders.
 *
 * Nothing here is a control that pretends. There is no "send" button for an
 * unconnected channel and no order form yet, because natural-language order
 * intake is not built — and a text box that accepted instructions nothing
 * would act on would be the exact defect this module exists to avoid.
 */

const impactStyle = (impact: string): string => {
  switch (impact) {
    case "IRREVERSIBLE":
    case "LEGAL":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "FINANCIAL":
      return "bg-accent-amber/20 text-accent-amber border-accent-amber/30";
    case "SENSITIVE":
      return "bg-primary/20 text-primary-glow border-primary/30";
    default:
      return "bg-accent-emerald/20 text-accent-emerald border-accent-emerald/30";
  }
};

const orderStateStyle = (state: string): string => {
  switch (state) {
    case "REPORTED":
      return "bg-accent-emerald/20 text-accent-emerald";
    case "BLOCKED":
    case "FAILED":
      return "bg-destructive/20 text-destructive";
    case "AWAITING_AUTHORIZATION":
      return "bg-accent-amber/20 text-accent-amber";
    default:
      return "bg-primary/20 text-primary-glow";
  }
};

const when = (value: string | null): string => {
  if (!value) return "";
  const at = new Date(value);
  return Number.isFinite(at.getTime()) ? at.toISOString().replace("T", " ").slice(0, 16) : value;
};

const AICEOAyra = () => {
  const { t } = useTranslation();
  const {
    capabilities,
    connected,
    notConnected,
    isLoading: capsLoading,
    failed: capsFailed,
    denied,
    refetch,
  } = useAyraCapabilities();
  const { orders, degraded, isLoading: ordersLoading } = useAyraOrders();

  if (capsLoading || ordersLoading) {
    return (
      <PageShell>
        <PageBanner icon={Sparkles} title={t("ceo.ayra_title")} />
        <LoadingState label={t("ceo.ayra_loading")} rows={2} />
      </PageShell>
    );
  }

  if (denied) {
    return (
      <PageShell>
        <PageBanner icon={Sparkles} title={t("ceo.ayra_title")} />
        <EmptyState
          icon={ShieldAlert}
          title={t("ceo.ci_denied_title")}
          description={t("ceo.ci_denied_body")}
        />
      </PageShell>
    );
  }

  if (capsFailed) {
    return (
      <PageShell>
        <PageBanner icon={Sparkles} title={t("ceo.ayra_title")} />
        <ErrorState
          title={t("ceo.ayra_failed")}
          description={t("ceo.ayra_failed_body")}
          onRetry={() => void refetch()}
        />
      </PageShell>
    );
  }

  const connectedCaps = capabilities.filter((c) => c.connected);
  const missingCaps = capabilities.filter((c) => !c.connected);

  return (
    <PageShell>
      <PageBanner
        icon={Sparkles}
        title={t("ceo.ayra_title")}
        subtitle={t("ceo.ayra_subtitle")}
        status={`${connected} ${t("ceo.ayra_connected")} · ${notConnected} ${t("ceo.ayra_not_connected")}`}
      />

      {degraded.length > 0 && <DegradedNotice sources={degraded} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* What she can do. */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Plug className="w-5 h-5 text-accent-emerald" />
              {t("ceo.ayra_can")}
              <Badge className="bg-accent-emerald/20 text-accent-emerald">{connected}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px]">
              <div className="space-y-2">
                {connectedCaps.map((cap) => (
                  <div
                    key={cap.capability}
                    className="p-3 rounded-lg bg-surface border border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-foreground">{cap.label}</p>
                      <div className="flex shrink-0 gap-1">
                        {cap.impact !== "LOW" && (
                          <Badge className={impactStyle(cap.impact)}>
                            {t("ceo.ayra_needs_ok")}
                          </Badge>
                        )}
                        {cap.confirmsDelivery && (
                          <Badge className="bg-accent-emerald/20 text-accent-emerald">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {t("ceo.ayra_confirms")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                      {cap.backing}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* What she cannot, and why. The more important half. */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <PlugZap className="w-5 h-5 text-accent-amber" />
              {t("ceo.ayra_cannot")}
              <Badge className="bg-accent-amber/20 text-accent-amber">{notConnected}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px]">
              {missingCaps.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title={t("ceo.ayra_all_connected")}
                  description={t("ceo.ayra_all_connected_body")}
                />
              ) : (
                <div className="space-y-2">
                  {missingCaps.map((cap) => (
                    <div
                      key={cap.capability}
                      className="p-3 rounded-lg bg-surface border border-border"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground">{cap.label}</p>
                        <Badge className="bg-muted/20 text-muted-foreground">
                          <XCircle className="w-3 h-3 mr-1" />
                          {t("ceo.ayra_absent")}
                        </Badge>
                      </div>
                      {/* The reason, which is the whole point of listing it. */}
                      <p className="mt-1 text-xs text-muted-foreground">{cap.notConnectedReason}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <SourceNote source="ayra_capabilities" count={capabilities.length} />
          </CardContent>
        </Card>
      </div>

      {/* What she has been asked to do. */}
      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-glow" />
            {t("ceo.ayra_orders")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[320px]">
            {orders.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title={t("ceo.ayra_no_orders_title")}
                description={t("ceo.ayra_no_orders_body")}
              />
            ) : (
              <div className="space-y-3">
                {orders.map((order: AyraOrder, i: number) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.03 }}
                    className="p-4 rounded-xl bg-surface border border-border"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* The Founder's own words, kept verbatim. */}
                      <p className="text-sm text-foreground">{order.instruction}</p>
                      <div className="flex shrink-0 gap-2">
                        <Badge className={impactStyle(order.impact)}>{order.impact}</Badge>
                        <Badge className={orderStateStyle(order.state)}>
                          {order.state.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </div>
                    </div>
                    {order.understoodAs && (
                      <p className="mt-1 text-xs text-muted-foreground">{order.understoodAs}</p>
                    )}
                    {order.steps.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {order.steps.map((step) => (
                          <li key={step.id} className="text-[11px] text-muted-foreground">
                            {step.position}. {step.description} — {step.state.toLowerCase()}
                            {step.blockedReason ? ` (${step.blockedReason})` : ""}
                            {step.error ? ` (${step.error})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {order.report && (
                      <p className="mt-2 text-xs text-accent-emerald">
                        {order.report} · {when(order.reportedAt)}
                      </p>
                    )}
                    {order.blockedReason && (
                      <p className="mt-2 text-xs text-accent-amber">{order.blockedReason}</p>
                    )}
                    {order.failureReason && (
                      <p className="mt-2 text-xs text-destructive">{order.failureReason}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
          <SourceNote source="ayra_orders" count={orders.length} />
        </CardContent>
      </Card>
    </PageShell>
  );
};

export default AICEOAyra;
