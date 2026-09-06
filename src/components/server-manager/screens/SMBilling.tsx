import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt, Server, TrendingUp, Download, Calendar,
  CreditCard, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { smQuery, smErrorMessage } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type Instance = Tables<'server_instances'>;
type Invoice = Tables<'server_invoices'>;

const SMBilling = () => {
  const [servers, setServers] = useState<Instance[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [serverRows, invoiceRows] = await Promise.all([
        smQuery('servers', () =>
          supabase.from('server_instances').select('*').neq('status', 'decommissioned'),
        ),
        smQuery('invoices', () =>
          supabase.from('server_invoices').select('*').order('issued_at', { ascending: false }),
        ),
      ]);
      if (serverRows === null || invoiceRows === null) {
        setLoadError('Could not load billing data. Please try again.');
      } else {
        setLoadError(null);
      }
      setServers(serverRows ?? []);
      setInvoices(invoiceRows ?? []);
    } catch (err) {
      setLoadError(smErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const totalCost = servers.reduce((a, s) => a + Number(s.monthly_cost || 0), 0);
  const forecast = totalCost * 1.05;
  const maxUtil = (s: Instance) => Math.max(Number(s.cpu_usage || 0), Number(s.ram_usage || 0));

  const regionBreakdown = servers.reduce<Record<string, number>>((acc, s) => {
    const key = s.region_name || s.region_code || 'Unknown';
    acc[key] = (acc[key] || 0) + Number(s.monthly_cost || 0);
    return acc;
  }, {});

  const handleDownload = (invoiceCode: string) => {
    toast.success(`Preparing ${invoiceCode} for download...`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Usage" subtitle="Track costs and download invoices" />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      {/* Billing Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Current Month</span>
          </div>
          <p className="mt-1 text-xl font-bold">₹{totalCost.toLocaleString()}</p>
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-accent-emerald" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Monthly Forecast</span>
          </div>
          <p className="mt-1 text-xl font-bold">₹{Math.round(forecast).toLocaleString()}</p>
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-accent-pink" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Active Servers</span>
          </div>
          <p className="mt-1 text-xl font-bold">{servers.length}</p>
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-accent-amber" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Regions Billed</span>
          </div>
          <p className="mt-1 text-xl font-bold text-accent-emerald">{Object.keys(regionBreakdown).length}</p>
        </div>
      </div>

      {/* Server-wise Cost Breakdown */}
      <Card className="bento-card !p-0">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Server-wise Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : servers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No active servers found.</p>
          ) : (
            <div className="space-y-4">
              {servers.map((server, i) => (
                <motion.div
                  key={server.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-xl bg-surface/60 border border-border"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Server className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-foreground font-medium">{server.server_name}</p>
                        <p className="text-muted-foreground text-sm">{server.plan_name ?? server.server_type} · {server.region_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground font-bold">₹{Number(server.monthly_cost).toLocaleString()}/mo</p>
                      <p className="text-muted-foreground text-sm">{Math.round(maxUtil(server))}% utilization</p>
                    </div>
                  </div>
                  <Progress value={maxUtil(server)} className="h-2" />
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Region Cost Breakdown */}
      <Card className="bento-card !p-0">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent-pink" />
            Region-wise Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(regionBreakdown).length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No data available.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(regionBreakdown).sort((a, b) => b[1] - a[1]).map(([region, cost]) => (
                <div key={region} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{region}</span>
                  <div className="flex items-center gap-3 flex-1 mx-4">
                    <Progress value={totalCost ? (cost / totalCost) * 100 : 0} className="h-2" />
                  </div>
                  <span className="text-foreground font-medium">₹{Math.round(cost).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card className="bento-card !p-0">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No invoices yet.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice, i) => (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-surface/60 border border-border"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Receipt className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium">{invoice.invoice_code}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {invoice.period_label}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-foreground font-bold">{invoice.currency} {Number(invoice.amount).toLocaleString()}</p>
                      <p className="text-muted-foreground text-xs">{new Date(invoice.issued_at).toLocaleDateString()}</p>
                    </div>
                    <Badge className={invoice.status === 'paid' ? 'bg-accent-emerald/20 text-accent-emerald' : 'bg-accent-amber/20 text-accent-amber'}>
                      {invoice.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary"
                      onClick={() => handleDownload(invoice.invoice_code)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SMBilling;
