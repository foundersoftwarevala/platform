import { useState, useEffect, useCallback } from 'react';
import { useTranslation as useI18nSource } from "@/lib/i18n/use-translation";
import { motion } from 'framer-motion';
import {
  Receipt, Server, TrendingUp, Calendar,
  CreditCard, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { smQuery, smErrorMessage } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type Instance = Tables<'server_instances'>;
type Invoice = Tables<'server_invoices'>;

const SMBilling = () => {
    const { t: translateText } = useI18nSource();
  const [servers, setServers] = useState<Instance[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
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
        setServers(null);
        setInvoices(null);
        return;
      }
      setLoadError(null);
      setServers(serverRows);
      setInvoices(invoiceRows);
    } catch (err) {
      setLoadError(smErrorMessage(err));
      setServers(null);
      setInvoices(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      <PageHeader title={translateText("server_manager.billing_usage_d58e61")} subtitle="Recorded invoice entries; subscription charges and PDF downloads are not configured" />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            {translateText("server_manager.retry_9f5cd8")}</Button>
        </div>
      )}

      {/* Billing Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{translateText("server_manager.current_month_3d16cb")}</span>
          </div>
          <p className="mt-1 text-xl font-bold text-muted-foreground">—</p>
          <p className="text-xs text-muted-foreground">{translateText("server_manager.subscription_data_unavailable_09cbcd")}</p>
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-accent-emerald" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Monthly Forecast</span>
          </div>
          <p className="mt-1 text-xl font-bold text-muted-foreground">—</p>
          <p className="text-xs text-muted-foreground">Subscription data unavailable</p>
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-accent-pink" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Registered Servers</span>
          </div>
          <p className="mt-1 text-xl font-bold">{servers?.length ?? '—'}</p>
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-accent-amber" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Billing Regions</span>
          </div>
          <p className="mt-1 text-xl font-bold text-muted-foreground">—</p>
          <p className="text-xs text-muted-foreground">Subscription data unavailable</p>
        </div>
      </div>

      {/* Server-wise Cost Breakdown */}
      <Card className="bento-card !p-0">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Server Subscription Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Subscription records are not configured. Server profile estimates are not billing data.
          </p>
        </CardContent>
      </Card>

      {/* Region Cost Breakdown */}
      <Card className="bento-card !p-0">
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent-pink" />
            Region-wise Subscription Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Subscription records are not configured.
          </p>
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
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading recorded invoices...</p>
          ) : invoices === null ? (
            <p className="text-muted-foreground text-center py-8">Invoice data unavailable.</p>
          ) : invoices.length === 0 ? (
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
                    <span className="text-xs text-muted-foreground" aria-label="Invoice PDF unavailable">
                      PDF unavailable
                    </span>
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
