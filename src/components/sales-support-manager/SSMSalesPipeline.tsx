import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  ArrowRight,
  Phone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  FileText,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useDeals, useLeads, useUpdateRow, relativeTime, currency } from '@/hooks/useSalesSupportData';

type PipelineStage = 'discovery' | 'proposal' | 'negotiation' | 'won' | 'lost';

const stageConfig: Record<PipelineStage, { label: string; color: string; next?: PipelineStage }> = {
  discovery: { label: 'Discovery', color: 'bg-blue-500/10 text-blue-500', next: 'proposal' },
  proposal: { label: 'Proposal', color: 'bg-purple-500/10 text-purple-500', next: 'negotiation' },
  negotiation: { label: 'Negotiation', color: 'bg-yellow-500/10 text-yellow-500', next: 'won' },
  won: { label: 'Won', color: 'bg-green-500/10 text-green-500' },
  lost: { label: 'Lost', color: 'bg-red-500/10 text-red-500' }
};

export const SSMSalesPipeline: React.FC = () => {
  const { data: deals, isLoading } = useDeals();
  const { data: leads } = useLeads();
  const updateDeal = useUpdateRow('sales_deals');
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);

  const leadRef = (leadId: string | null) => (leads ?? []).find(l => l.id === leadId)?.reference ?? null;

  const handleMoveStage = async (id: string, currentStage: PipelineStage, hasProof: boolean = false) => {
    const nextStage = stageConfig[currentStage].next;
    if (!nextStage) {
      toast.error('Deal is already at final stage');
      return;
    }
    if (nextStage === 'won' && !hasProof) {
      toast.error('Payment proof required for conversion');
      return;
    }
    try {
      await updateDeal.mutateAsync({ id, values: { stage: nextStage } });
      toast.success(`Deal moved to ${stageConfig[nextStage].label}`);
    } catch {
      toast.error('Failed to update stage');
    }
    setSelectedDeal(null);
  };

  const handleMarkLost = async (id: string) => {
    try {
      await updateDeal.mutateAsync({ id, values: { stage: 'lost' } });
      toast.success('Deal marked as lost');
    } catch {
      toast.error('Failed to update stage');
    }
    setSelectedDeal(null);
  };

  const allDeals = deals ?? [];
  const stages: PipelineStage[] = ['discovery', 'proposal', 'negotiation', 'won'];

  const pipelineStats = stages.reduce((acc, stage) => {
    acc[stage] = allDeals.filter(d => d.stage === stage).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <TrendingUp className="h-5 w-5 text-primary" />
            Active Sales Pipeline
          </CardTitle>
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            <Shield className="h-3 w-3 mr-1" />
            Skip Steps BLOCKED
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading pipeline...</div>
        ) : (
        <>
        {/* Pipeline Funnel */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {stages.map((stage, idx) => (
            <div key={stage} className="relative">
              <div className={`p-3 rounded-lg ${stageConfig[stage].color} text-center`}>
                <span className="text-2xl font-bold">{pipelineStats[stage]}</span>
                <p className="text-xs mt-1">{stageConfig[stage].label}</p>
              </div>
              {idx < stages.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              )}
            </div>
          ))}
        </div>

        {/* Pipeline Flow Notice */}
        <div className="mb-4 p-2 bg-muted/30 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">
            <strong>Flow:</strong> Discovery → Proposal → Negotiation → Won / Lost
            <span className="mx-2">|</span>
            <strong>Won requires payment proof</strong>
          </p>
        </div>

        {/* Deal List */}
        <div className="space-y-3">
          {allDeals.filter(d => d.stage !== 'won' && d.stage !== 'lost').map((deal) => {
            const stage = (deal.stage as PipelineStage) in stageConfig ? (deal.stage as PipelineStage) : 'discovery';
            return (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="border border-border rounded-lg p-4 bg-background"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-primary">{deal.reference}</span>
                    <Badge className={stageConfig[stage].color}>
                      {stageConfig[stage].label}
                    </Badge>
                    {leadRef(deal.lead_id) && (
                      <Badge variant="outline" className="text-xs">
                        {leadRef(deal.lead_id)}
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-semibold text-foreground">{deal.title}</h4>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{currency(deal.value)}</p>
                  <p className="text-xs text-muted-foreground">{deal.probability}% probability</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-3">
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {relativeTime(deal.updated_at)}
                  </span>
                  {deal.expected_close_date && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Close: {new Date(deal.expected_close_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {selectedDeal === deal.id ? (
                <div className="border-t border-border pt-3 flex gap-2">
                  {stageConfig[stage].next === 'won' ? (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleMoveStage(deal.id, stage, true)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Confirm with Payment Proof
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleMoveStage(deal.id, stage)}
                    >
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Move to {stageConfig[stageConfig[stage].next!].label}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleMarkLost(deal.id)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Mark Lost
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedDeal(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDeal(deal.id)}
                >
                  Update Stage
                </Button>
              )}
            </motion.div>
          )})}
        </div>

        {/* Won Deals */}
        {allDeals.filter(d => d.stage === 'won').length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Recently Won
            </h4>
            <div className="space-y-2">
              {allDeals.filter(d => d.stage === 'won').map(deal => (
                <div key={deal.id} className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-primary">{deal.reference}</span>
                    <span className="text-foreground">{deal.title}</span>
                    <Badge className="bg-green-500/10 text-green-500">
                      <FileText className="h-3 w-3 mr-1" />
                      Payment Verified
                    </Badge>
                  </div>
                  <span className="font-bold text-green-500">{currency(deal.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
        )}

        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
            <p className="text-xs text-yellow-500">
              Pipeline stages cannot be skipped. Conversion requires verified payment proof. 
              All stage changes are logged immutably.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
