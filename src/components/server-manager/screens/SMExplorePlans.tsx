import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, HardDrive, Globe, Sparkles, Scale, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { smQuery } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type Plan = Tables<'server_plans'>;

const SMExplorePlans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const planRows = await smQuery('server plans', () =>
        supabase.from('server_plans').select('*').eq('is_active', true).order('plan_name'),
      );
      if (planRows === null) {
        setLoadError('Could not load plan references. Please try again.');
      }
      setPlans(planRows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const togglePlanSelection = (planId: string) => {
    setSelectedPlans(prev =>
      prev.includes(planId) ? prev.filter(id => id !== planId) : [...prev, planId]
    );
  };

  const recommended = plans.filter(p => p.is_recommended);
  const comparePlans = plans.filter(p => selectedPlans.includes(p.id));

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      <PageHeader
        title="Explore Plans"
        subtitle="Reference server configurations only — subscription pricing and provisioning are not configured."
      />

      {/* AI Suggestions */}
      <div className="bento-card premium-halo enter-soft">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Recommended Configurations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recommended.length === 0 ? (
            <p className="text-muted-foreground text-sm">No plans have a recommendation configured.</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {recommended.map((plan) => (
                <div key={plan.id} className="p-4 rounded-lg bg-surface/50 border border-border">
                  <p className="text-primary text-sm font-medium mb-1">Recommended</p>
                  <p className="text-foreground font-semibold mb-2">{plan.plan_name}</p>
                  <p className="text-muted-foreground text-sm">{plan.recommendation_reason ?? 'No recommendation details provided.'}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <p className="text-muted-foreground text-center py-12">Loading plans...</p>
      ) : plans.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No plans available.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={`bento-card hover-lift relative overflow-hidden h-full !p-0 ${
                  plan.is_recommended ? 'ring-2 ring-primary/50' : ''
                } ${selectedPlans.includes(plan.id) ? 'border-accent-pink/60' : ''}`}>
                  {plan.is_recommended && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg">
                      Recommended
                    </div>
                  )}
                  {!plan.is_recommended && (
                    <Badge className="absolute top-3 right-3 bg-accent-pink/20 text-accent-pink border-accent-pink/30">
                      {plan.plan_type}
                    </Badge>
                  )}
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-primary/20">
                        {plan.plan_type === 'GPU' ? <Sparkles className="w-5 h-5 text-primary" /> :
                         plan.plan_type === 'Memory' ? <HardDrive className="w-5 h-5 text-accent-pink" /> :
                         plan.plan_type === 'Storage' ? <HardDrive className="w-5 h-5 text-accent-amber" /> :
                         <Cpu className="w-5 h-5 text-primary" />}
                      </div>
                      <div>
                        <p className="text-foreground font-semibold">{plan.plan_name}</p>
                        <p className="text-muted-foreground text-sm">{plan.plan_type} Optimized</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CPU Cores</span>
                        <span className="text-foreground">{plan.cpu_cores} vCPU</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">RAM</span>
                        <span className="text-foreground">{plan.ram_gb} GB</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Storage</span>
                        <span className="text-foreground">{plan.storage_gb} GB SSD</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Bandwidth</span>
                        <span className="text-foreground">{plan.bandwidth_tb} TB</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mb-4 flex-wrap">
                      <Globe className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground text-xs">Available in: </span>
                      {(plan.regions ?? []).map(r => (
                        <Badge key={r} variant="outline" className="text-xs border-border text-muted-foreground">
                          {r}
                        </Badge>
                      ))}
                    </div>

                    {(plan.features ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {plan.features.map(f => (
                          <Badge key={f} className="bg-surface text-muted-foreground border-border text-xs">{f}</Badge>
                        ))}
                      </div>
                    )}

                    <p className="border-t border-border pt-4 mb-4 text-sm text-muted-foreground">
                      Subscription price not configured
                    </p>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={selectedPlans.includes(plan.id) ? 'text-accent-pink border-accent-pink/50' : ''}
                        onClick={() => togglePlanSelection(plan.id)}
                      >
                        <Scale className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {selectedPlans.length >= 2 && !showCompare && (
        <div className="fixed bottom-6 right-6">
          <Button className="bg-accent-pink hover:bg-accent-pink/90 shadow-lg" onClick={() => setShowCompare(true)}>
            Compare {selectedPlans.length} Plans
          </Button>
        </div>
      )}

      {showCompare && comparePlans.length >= 2 && (
        <Card className="bento-card !p-0 border-accent-pink/30 fixed inset-x-6 bottom-6 z-20 max-h-[70vh] overflow-auto">
          <CardHeader className="flex flex-row items-center justify-between p-6">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Scale className="w-5 h-5 text-accent-pink" />
              Plan Comparison
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowCompare(false)}>
              <X className="w-4 h-4 text-muted-foreground" />
            </Button>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground text-left">
                    <th className="py-2 pr-4">Attribute</th>
                    {comparePlans.map(p => <th key={p.id} className="py-2 pr-4 text-foreground">{p.plan_name}</th>)}
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {[
                    ['Type', (p: Plan) => p.plan_type],
                    ['CPU', (p: Plan) => `${p.cpu_cores} vCPU`],
                    ['RAM', (p: Plan) => `${p.ram_gb} GB`],
                    ['Storage', (p: Plan) => `${p.storage_gb} GB`],
                    ['Bandwidth', (p: Plan) => `${p.bandwidth_tb} TB`],
                    ['Regions', (p: Plan) => (p.regions ?? []).join(', ')],
                    ['Subscription price', () => 'Not configured'],
                  ].map(([label, fn]) => (
                    <tr key={label as string} className="border-b border-border/60 hover:bg-white/[0.03] transition-colors">
                      <td className="py-2 pr-4 text-muted-foreground">{label as string}</td>
                      {comparePlans.map(p => <td key={p.id} className="py-2 pr-4">{(fn as (p: Plan) => string)(p)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default SMExplorePlans;
