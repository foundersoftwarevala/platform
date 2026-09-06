import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Server, Globe, Cpu, HardDrive, MemoryStick, Shield,
  CheckCircle, ArrowRight, Database, Zap, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database as DB } from '@/integrations/supabase/types';
import { smQuery, smMutate } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type PlanRow = DB['public']['Tables']['server_plans']['Row'];
type RegionRow = DB['public']['Tables']['server_regions']['Row'];

const serverTypes = [
  { id: 'web', name: 'Web Server', icon: Globe, desc: 'Nginx/Apache for hosting' },
  { id: 'application', name: 'Application', icon: Zap, desc: 'Node.js, Python, Java' },
  { id: 'database', name: 'Database', icon: Database, desc: 'PostgreSQL, MySQL, MongoDB' },
  { id: 'storage', name: 'Storage', icon: HardDrive, desc: 'File & Object Storage' },
];

const osOptions = ['Ubuntu 22.04 LTS', 'Ubuntu 20.04 LTS', 'Debian 12', 'Rocky Linux 9', 'Windows Server 2022'];

const SMAddServer = () => {
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [config, setConfig] = useState({
    name: '',
    type: '',
    regionCode: '',
    planId: '',
    osType: osOptions[0]!,
    autoBackup: true,
    monitoring: true,
    firewall: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [planData, regionData] = await Promise.all([
        smQuery('server plans', () => supabase.from('server_plans').select('*').eq('is_active', true).order('price_monthly')),
        smQuery('server regions', () => supabase.from('server_regions').select('*').eq('is_active', true).order('region_name')),
      ]);
      if (planData === null || regionData === null) {
        setLoadError('Could not load plans or regions. Please try again.');
      }
      setPlans((planData ?? []) as PlanRow[]);
      setRegions((regionData ?? []) as RegionRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === config.planId) ?? null,
    [plans, config.planId],
  );
  const selectedRegion = useMemo(
    () => regions.find((r) => r.region_code === config.regionCode) ?? null,
    [regions, config.regionCode],
  );

  const reset = () => {
    setStep(1);
    setConfig({
      name: '',
      type: '',
      regionCode: '',
      planId: '',
      osType: osOptions[0]!,
      autoBackup: true,
      monitoring: true,
      firewall: true,
    });
  };

  const handleCreate = async () => {
    if (!selectedPlan || !selectedRegion) return;
    setCreating(true);
    try {
      const suffix = Date.now().toString(36).slice(-5).toUpperCase();
      const serverCode = `SRV-${config.regionCode.toUpperCase()}-${suffix}`;
      let createdId: string | null = null;

      const ok = await smMutate(
        'Provision server',
        async () => {
          const { data: created, error: serverError } = await supabase
            .from('server_instances')
            .insert({
              server_code: serverCode,
              server_name: config.name,
              hostname: `${config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.softwarevala.net`,
              server_type: config.type,
              workload: config.type,
              provider: 'Software Vala Cloud',
              region_code: selectedRegion.region_code,
              region_name: selectedRegion.region_name,
              os_type: config.osType,
              status: 'provisioning',
              health_status: 'unknown',
              cpu_cores: selectedPlan.cpu_cores,
              ram_gb: selectedPlan.ram_gb,
              storage_gb: selectedPlan.storage_gb,
              plan_name: selectedPlan.plan_name,
              monthly_cost: selectedPlan.price_monthly,
              backup_status: config.autoBackup ? 'scheduled' : 'disabled',
              tags: [
                config.type,
                ...(config.monitoring ? ['monitored'] : []),
                ...(config.firewall ? ['firewalled'] : []),
              ],
            })
            .select('id, server_name')
            .maybeSingle();

          if (serverError) return { data: null, error: serverError };
          createdId = created?.id ?? null;

          const { error: purchaseError } = await supabase.from('server_purchases').insert({
            purchase_code: `PUR-${suffix}`,
            plan_id: selectedPlan.id,
            server_id: createdId,
            region_code: selectedRegion.region_code,
            os_type: config.osType,
            server_name: config.name,
            auto_backup: config.autoBackup,
            firewall_preset: config.firewall ? 'standard' : 'none',
            payment_method: 'invoice',
            amount: selectedPlan.price_monthly,
            status: 'completed',
            completed_at: new Date().toISOString(),
          });
          if (purchaseError) return { data: null, error: purchaseError };

          const { error: auditError } = await supabase.from('server_audit_logs').insert({
            action: `Provisioned server "${config.name}"`,
            actor: 'admin',
            result: 'success',
            risk_level: 'medium',
            server_id: createdId,
            details: `${selectedPlan.plan_name} in ${selectedRegion.region_name} running ${config.osType}`,
          });
          return { data: null, error: auditError };
        },
        `Server ${config.name} provisioning started`,
      );

      if (ok) reset();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Server"
        subtitle="Provision a new server from your live plan catalogue"
        action={
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : step > s
                      ? 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/50'
                      : 'bg-surface text-muted-foreground'
                }`}
              >
                {step > s ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
            ))}
          </div>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="bento-card premium-halo enter-soft !p-0">
            <CardHeader className="p-6">
              <CardTitle className="text-lg text-foreground">Step 1: Select Server Type</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {serverTypes.map((type) => (
                  <motion.button
                    key={type.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setConfig((prev) => ({ ...prev, type: type.id }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      config.type === type.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-surface/50 hover:border-primary/40'
                    }`}
                  >
                    <type.icon className={`w-8 h-8 mb-3 ${config.type === type.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <h3 className="font-semibold text-foreground">{type.name}</h3>
                    <p className="text-sm text-muted-foreground">{type.desc}</p>
                  </motion.button>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!config.type}>
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </div>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="bento-card premium-halo enter-soft !p-0">
            <CardHeader className="p-6">
              <CardTitle className="text-lg text-foreground">Step 2: Choose Region & Plan</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-6">
              <div>
                <Label className="text-muted-foreground mb-2 block">Select Region</Label>
                <Select
                  value={config.regionCode}
                  onValueChange={(v) => setConfig((prev) => ({ ...prev, regionCode: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loading ? 'Loading regions…' : 'Choose a region'} />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.region_code}>
                        <span className="flex items-center gap-2">
                          <span>{region.country_flag ?? '🌐'}</span>
                          <span>{region.region_name}</span>
                          <span className="text-xs text-muted-foreground">{region.latency_ms}ms</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block">Select Plan</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {plans.map((plan) => (
                    <motion.button
                      key={plan.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setConfig((prev) => ({ ...prev, planId: plan.id }))}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        config.planId === plan.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-surface/50 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-foreground">{plan.plan_name}</h3>
                        <Badge className="bg-primary/20 text-primary">
                          ${Number(plan.price_monthly).toFixed(0)}/mo
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><Cpu className="w-3 h-3" />{plan.cpu_cores} vCPU</div>
                        <div className="flex items-center gap-2"><MemoryStick className="w-3 h-3" />{plan.ram_gb} GB RAM</div>
                        <div className="flex items-center gap-2"><HardDrive className="w-3 h-3" />{plan.storage_gb} GB SSD</div>
                      </div>
                      {plan.is_recommended && (
                        <Badge className="mt-2 bg-accent-emerald/20 text-accent-emerald">Recommended</Badge>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!config.regionCode || !config.planId}
                >
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </div>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="bento-card premium-halo enter-soft !p-0">
            <CardHeader className="p-6">
              <CardTitle className="text-lg text-foreground">Step 3: Server Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground mb-2 block">Server Name</Label>
                  <Input
                    value={config.name}
                    onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="sv-production-web-01"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground mb-2 block">Operating System</Label>
                  <Select
                    value={config.osType}
                    onValueChange={(v) => setConfig((prev) => ({ ...prev, osType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {osOptions.map((os) => (
                        <SelectItem key={os} value={os}>{os}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-muted-foreground block">Features</Label>
                {[
                  { key: 'autoBackup' as const, icon: Database, color: 'text-primary', title: 'Auto Backup', desc: 'Daily automated backups' },
                  { key: 'monitoring' as const, icon: Zap, color: 'text-accent-amber', title: '24/7 Monitoring', desc: 'Real-time health monitoring' },
                  { key: 'firewall' as const, icon: Shield, color: 'text-accent-emerald', title: 'Firewall Protection', desc: 'Advanced DDoS protection' },
                ].map((f) => (
                  <div key={f.key} className="flex items-center justify-between p-3 rounded-lg bg-surface/50">
                    <div className="flex items-center gap-3">
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                      <div>
                        <p className="text-foreground font-medium">{f.title}</p>
                        <p className="text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={config[f.key]}
                      onCheckedChange={(v) => setConfig((prev) => ({ ...prev, [f.key]: v }))}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setStep(4)} disabled={!config.name.trim()}>
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </div>
        </motion.div>
      )}

      {step === 4 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="bento-card premium-halo enter-soft !p-0">
            <CardHeader className="p-6">
              <CardTitle className="text-lg text-foreground">Step 4: Review & Confirm</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-6">
              <div className="p-4 rounded-xl bg-surface/50 space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Server Name</span>
                  <span className="text-foreground font-medium">{config.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-foreground font-medium capitalize">{config.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Region</span>
                  <span className="text-foreground font-medium">{selectedRegion?.region_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Operating System</span>
                  <span className="text-foreground font-medium">{config.osType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="text-foreground font-medium">
                    {selectedPlan?.plan_name} — ${Number(selectedPlan?.price_monthly ?? 0).toFixed(2)}/mo
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resources</span>
                  <span className="text-foreground font-medium">
                    {selectedPlan?.cpu_cores} vCPU • {selectedPlan?.ram_gb} GB • {selectedPlan?.storage_gb} GB SSD
                  </span>
                </div>
                <div className="border-t border-border pt-4 flex justify-between">
                  <span className="text-muted-foreground">Features</span>
                  <div className="flex gap-2">
                    {config.autoBackup && <Badge className="bg-primary/20 text-primary">Backup</Badge>}
                    {config.monitoring && <Badge className="bg-accent-amber/20 text-accent-amber">Monitor</Badge>}
                    {config.firewall && <Badge className="bg-accent-emerald/20 text-accent-emerald">Firewall</Badge>}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex justify-between items-center">
                <div>
                  <p className="text-primary font-semibold">Monthly Total</p>
                  <p className="text-xs text-muted-foreground">Billed monthly</p>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  ${Number(selectedPlan?.price_monthly ?? 0).toFixed(0)}
                  <span className="text-sm text-muted-foreground">/mo</span>
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button
                  onClick={() => void handleCreate()}
                  disabled={creating}
                  className="bg-accent-emerald hover:bg-accent-emerald/90"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Server className="w-4 h-4 mr-2" />
                  )}
                  Create Server
                </Button>
              </div>
            </CardContent>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SMAddServer;
