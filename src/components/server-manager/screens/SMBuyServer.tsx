import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingCart, Globe, Settings, CreditCard, CheckCircle2,
  Shield, Database, Clock, ArrowRight, ArrowLeft, AlertTriangle, Copy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { smQuery, smMutate } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type Plan = Tables<'server_plans'>;
type Region = Tables<'server_regions'>;
type Purchase = Tables<'server_purchases'>;

const steps = ['Select Plan', 'Select Region', 'Configuration', 'Billing'];
const OS_OPTIONS = ['ubuntu-22', 'debian-12', 'centos-9'];
const FIREWALL_OPTIONS = ['minimal', 'standard', 'strict'];

const genPurchaseCode = () => `PO-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

const SMBuyServer = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [serverName, setServerName] = useState('');
  const [config, setConfig] = useState<{ os: string; autoBackup: boolean; firewall: string }>({
    os: OS_OPTIONS[0] ?? 'ubuntu-22.04',
    autoBackup: true,
    firewall: 'standard',
  });
  const [paymentMethod] = useState('wallet');
  const [createdOrder, setCreatedOrder] = useState<Purchase | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [planRows, regionRows] = await Promise.all([
        smQuery('server plans', () => supabase.from('server_plans').select('*').eq('is_active', true).order('price_monthly', { ascending: true })),
        smQuery('server regions', () => supabase.from('server_regions').select('*').eq('is_active', true)),
      ]);
      if (planRows === null || regionRows === null) {
        setLoadError('Could not load plans or regions. Please try again.');
      }
      setPlans(planRows ?? []);
      setRegions(regionRows ?? []);
      if (planRows?.[0]) setSelectedPlanId(planRows[0].id);
      if (regionRows?.[0]) setSelectedRegion(regionRows[0].region_code);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const selectedRegionRow = regions.find(r => r.region_code === selectedRegion);

  const backupCost = 299;
  const totalCost = selectedPlan ? Number(selectedPlan.price_monthly) + (config.autoBackup ? backupCost : 0) : 0;

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };
  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handlePurchase = async () => {
    if (!selectedPlan || !selectedRegionRow) {
      toast.error('Please select a plan and region');
      return;
    }
    setSubmitting(true);
    try {
      const purchase_code = genPurchaseCode();
      let inserted: Purchase | null = null;
      const ok = await smMutate('Create order', async () => {
        const { data, error } = await supabase
          .from('server_purchases')
          .insert({
            purchase_code,
            plan_id: selectedPlan.id,
            region_code: selectedRegionRow.region_code,
            os_type: config.os,
            server_name: serverName || `${selectedPlan.plan_code}-${selectedRegionRow.region_code.toLowerCase()}`,
            auto_backup: config.autoBackup,
            firewall_preset: config.firewall,
            payment_method: paymentMethod,
            amount: totalCost,
            status: 'pending',
          })
          .select()
          .single();
        inserted = data;
        return { data, error };
      });
      if (!ok || !inserted) return;
      setCreatedOrder(inserted);
      toast.success('Order created. Payment provider is not connected yet — order is pending.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setCreatedOrder(null);
    setCurrentStep(0);
    setServerName('');
  };

  if (createdOrder) {
    return (
      <div className="space-y-6">
        <PageHeader title="Buy New Server" subtitle="Order created successfully" />
        <div className="bento-card premium-halo enter-soft border-accent-emerald/30">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent-emerald" />
              Order {createdOrder.purchase_code}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="p-4 rounded-lg bg-accent-amber/10 border border-accent-amber/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-accent-amber mt-0.5" />
              <div>
                <p className="text-accent-amber font-medium">Payment provider not connected</p>
                <p className="text-muted-foreground text-sm">Your order has been recorded with status "pending". Once a payment provider is integrated, this order will be charged and provisioning will begin automatically.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Server Name: </span><span className="text-foreground">{createdOrder.server_name}</span></div>
              <div><span className="text-muted-foreground">Region: </span><span className="text-foreground">{createdOrder.region_code}</span></div>
              <div><span className="text-muted-foreground">OS: </span><span className="text-foreground capitalize">{createdOrder.os_type.replace('-', ' ')}</span></div>
              <div><span className="text-muted-foreground">Firewall: </span><span className="text-foreground capitalize">{createdOrder.firewall_preset}</span></div>
              <div><span className="text-muted-foreground">Auto Backup: </span><span className="text-foreground">{createdOrder.auto_backup ? 'Enabled' : 'Disabled'}</span></div>
              <div><span className="text-muted-foreground">Amount: </span><span className="text-primary font-semibold">₹{Number(createdOrder.amount).toLocaleString()}/mo</span></div>
              <div><span className="text-muted-foreground">Status: </span><Badge className="bg-accent-amber/20 text-accent-amber">{createdOrder.status}</Badge></div>
            </div>
            <Button variant="outline" onClick={resetFlow}>
              <Copy className="w-4 h-4 mr-2" />
              Start New Order
            </Button>
          </CardContent>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Buy New Server" subtitle="Configure and purchase a new server instance" />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              i <= currentStep ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground'
            }`}>
              {i < currentStep ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
            </div>
            <span className={`ml-2 ${i <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>{step}</span>
            {i < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-4 ${i < currentStep ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bento-card premium-halo enter-soft !p-0">
        <CardContent className="p-6">
          {loading ? (
            <p className="text-muted-foreground text-center py-12">Loading plans and regions...</p>
          ) : (
            <>
              {currentStep === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Select a Plan</h3>
                  {plans.length === 0 ? (
                    <p className="text-muted-foreground">No active plans available.</p>
                  ) : (
                    <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId}>
                      <div className="grid grid-cols-2 gap-4">
                        {plans.map((plan) => (
                          <div key={plan.id} className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedPlanId === plan.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                          }`} onClick={() => setSelectedPlanId(plan.id)}>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value={plan.id} />
                              <div>
                                <p className="text-foreground font-medium">{plan.plan_name}</p>
                                <p className="text-muted-foreground text-sm">{plan.cpu_cores} vCPU, {plan.ram_gb} GB RAM</p>
                                <p className="text-primary font-semibold mt-1">₹{Number(plan.price_monthly).toLocaleString()}/mo</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                </motion.div>
              )}

              {currentStep === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Select Region</h3>
                  {regions.length === 0 ? (
                    <p className="text-muted-foreground">No active regions available.</p>
                  ) : (
                    <RadioGroup value={selectedRegion} onValueChange={setSelectedRegion}>
                      <div className="space-y-3">
                        {regions.map((region) => (
                          <div key={region.region_code} className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedRegion === region.region_code ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                          }`} onClick={() => setSelectedRegion(region.region_code)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value={region.region_code} />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-primary" />
                                    <p className="text-foreground font-medium">{region.country_flag} {region.region_name}</p>
                                    <Badge variant="outline" className="border-border text-muted-foreground">
                                      {region.region_code}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    {(region.compliance ?? []).map(c => (
                                      <Badge key={c} className="bg-accent-emerald/20 text-accent-emerald text-xs">
                                        {c}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className={`font-mono ${region.latency_ms < 50 ? 'text-accent-emerald' : 'text-accent-amber'}`}>
                                  {region.latency_ms}ms
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Configuration</h3>
                  <div className="space-y-6">
                    <div>
                      <Label className="text-muted-foreground">Server Name</Label>
                      <Input
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        placeholder="e.g. prod-api-03"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Operating System</Label>
                      <RadioGroup value={config.os} onValueChange={(v) => setConfig({ ...config, os: v })} className="mt-2">
                        <div className="grid grid-cols-3 gap-3">
                          {OS_OPTIONS.map((os) => (
                            <div key={os} className={`p-3 rounded-lg border text-center cursor-pointer ${
                              config.os === os ? 'border-primary bg-primary/10' : 'border-border'
                            }`} onClick={() => setConfig({ ...config, os })}>
                              <RadioGroupItem value={os} className="sr-only" />
                              <p className="text-foreground capitalize">{os.replace('-', ' ')}</p>
                            </div>
                          ))}
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-4 rounded-lg border cursor-pointer ${
                        config.autoBackup ? 'border-primary bg-primary/10' : 'border-border'
                      }`} onClick={() => setConfig({ ...config, autoBackup: !config.autoBackup })}>
                        <div className="flex items-center gap-3">
                          <Database className={config.autoBackup ? 'text-primary' : 'text-muted-foreground'} />
                          <div>
                            <p className="text-foreground font-medium">Auto Backup</p>
                            <p className="text-muted-foreground text-sm">Daily automated backups (+₹{backupCost}/mo)</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border border-border opacity-60">
                        <div className="flex items-center gap-3">
                          <Settings className="text-muted-foreground" />
                          <div>
                            <p className="text-foreground font-medium">Auto Scaling</p>
                            <p className="text-muted-foreground text-sm">Configurable after provisioning</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-muted-foreground">Firewall Preset</Label>
                      <RadioGroup value={config.firewall} onValueChange={(v) => setConfig({ ...config, firewall: v })} className="mt-2">
                        <div className="grid grid-cols-3 gap-3">
                          {FIREWALL_OPTIONS.map((fw) => (
                            <div key={fw} className={`p-3 rounded-lg border text-center cursor-pointer ${
                              config.firewall === fw ? 'border-primary bg-primary/10' : 'border-border'
                            }`} onClick={() => setConfig({ ...config, firewall: fw })}>
                              <Shield className={`w-5 h-5 mx-auto mb-1 ${config.firewall === fw ? 'text-primary' : 'text-muted-foreground'}`} />
                              <p className="text-foreground capitalize">{fw}</p>
                            </div>
                          ))}
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Billing</h3>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-surface/50 border border-border">
                      <h4 className="text-foreground font-medium mb-3">Order Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plan</span>
                          <span className="text-foreground">{selectedPlan?.plan_name ?? '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Region</span>
                          <span className="text-foreground">{selectedRegionRow?.region_name ?? '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Auto Backup</span>
                          <span className="text-foreground">{config.autoBackup ? `Enabled (+₹${backupCost}/mo)` : 'Disabled'}</span>
                        </div>
                        <div className="border-t border-border pt-2 mt-2">
                          <div className="flex justify-between font-semibold">
                            <span className="text-foreground">Total</span>
                            <span className="text-primary">₹{totalCost.toLocaleString()}/mo</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-surface/50 border border-border">
                      <h4 className="text-foreground font-medium mb-3">Payment Method</h4>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-accent-amber/30 bg-accent-amber/10">
                        <CreditCard className="w-5 h-5 text-accent-amber" />
                        <div>
                          <p className="text-foreground">Wallet Balance</p>
                          <p className="text-accent-amber text-sm">Payment provider not connected yet — order will be recorded as pending.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </CardContent>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button onClick={handleNext} disabled={loading || !selectedPlanId}>
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handlePurchase} disabled={submitting} className="bg-accent-emerald hover:bg-accent-emerald/90">
            <ShoppingCart className="w-4 h-4 mr-2" />
            {submitting ? 'Placing Order...' : 'Confirm Purchase'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default SMBuyServer;
