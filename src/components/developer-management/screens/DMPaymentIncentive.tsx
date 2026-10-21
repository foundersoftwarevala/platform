/**
 * COMPLETED TASK AMOUNTS • PAYMENT NOT RECORDED
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAllDeveloperTasks, useDeveloperRegistry } from '@/hooks/useDevManagerData';
import { useTranslation } from '@/lib/i18n/use-translation';

/**
 * Completed-task amounts from developer task records. Five developers
 * with invented hours, holds and dollar amounts sat here. Per registered
 * developer now: hours are the estimates of their completed tasks, completed is
 * completed over assigned, and the amount is the sum of task amounts on
 * completed tasks, shown without a currency because the task does not record
 * one. No incentive rule or payment-hold record exists for developers.
 */
export const DMPaymentIncentive: React.FC = () => {
  const { t, formatNumber } = useTranslation();
  const registry = useDeveloperRegistry();
  const tasks = useAllDeveloperTasks();
  const paymentData = (registry.data ?? []).map((d) => {
    const mine = (tasks.data ?? []).filter((t) => t.developerId === d.id);
    const done = mine.filter((t) => t.status === 'completed');
    // AUDIT-FIX: Do not infer incentive eligibility or payment holds without records.
    return {
      id: d.valaId || d.fullName,
      hours: Math.round(done.reduce((sum, t) => sum + t.estimatedHours, 0) * 10) / 10,
      tasks: mine.length,
      completed: done.length,
      amount: done.reduce((sum, t) => sum + t.amount, 0),
    };
  });
  const failure = (registry.error ?? tasks.error) as Error | null;
  const loading = registry.isLoading || tasks.isLoading;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.payment.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.payment.subtitle')}</p>
      </div>

      {/* Warning */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="flex items-center gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="text-sm text-amber-500 font-medium">
            {t('devmanager.payment.no_direct_payout')}
          </span>
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t('devmanager.payment.summary')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(loading || failure || paymentData.length === 0) && (
              <p
                className="text-sm text-muted-foreground"
                role={!loading && failure ? 'alert' : 'status'}
                aria-live={!loading && failure ? undefined : 'polite'}
                aria-busy={loading || undefined}
              >
                {loading
                  ? t('devmanager.common.loading')
                  : failure
                    ? t('devmanager.common.figures_error', { error: failure.message })
                    : t('devmanager.common.no_developer')}
              </p>
            )}
            {paymentData.map((dev) => (
              <div
                key={dev.id}
                className="p-4 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">{dev.id}</span>
                  </div>
                  {/* AUDIT-FIX: Completed task amounts are not payment records. */}
                  <span className="font-bold text-lg">
                    {t('devmanager.payment.amount_due')}: {formatNumber(dev.amount)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{t('devmanager.payment.hours', { hours: formatNumber(dev.hours) })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <span>{t('devmanager.payment.tasks_completed', { completed: formatNumber(dev.completed), total: formatNumber(dev.tasks) })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMPaymentIncentive;
