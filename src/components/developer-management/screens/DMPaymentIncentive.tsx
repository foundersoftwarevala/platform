/**
 * PAYMENT & INCENTIVE
 * Work Hours • Approved Tasks • Incentive Eligibility • Payment Hold
 * NO DIRECT PAYOUT WITHOUT APPROVAL
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Clock, CheckCircle, AlertTriangle, Ban } from 'lucide-react';
import { useAllDeveloperTasks, useDeveloperRegistry } from '@/hooks/useDevManagerData';
import { useTranslation } from '@/lib/i18n/use-translation';

/**
 * What each developer has earned, from their developer tasks. Five developers
 * with invented hours, holds and dollar amounts sat here. Per registered
 * developer now: hours are the estimates of their completed tasks, approved is
 * completed over assigned, and the amount is the sum of task amounts on
 * completed tasks, shown without a currency because the task does not record
 * one. No incentive rule or payment hold exists for developers, so neither
 * badge is claimed; payouts themselves are approved in Finance.
 */
export const DMPaymentIncentive: React.FC = () => {
  const { t, formatNumber } = useTranslation();
  const registry = useDeveloperRegistry();
  const tasks = useAllDeveloperTasks();
  const paymentData = (registry.data ?? []).map((d) => {
    const mine = (tasks.data ?? []).filter((t) => t.developerId === d.id);
    const done = mine.filter((t) => t.status === 'completed');
    return {
      id: d.valaId || d.fullName,
      hours: Math.round(done.reduce((sum, t) => sum + t.estimatedHours, 0) * 10) / 10,
      tasks: mine.length,
      approved: done.length,
      incentive: false,
      hold: false,
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
                className={`p-4 rounded-lg border ${dev.hold ? 'bg-red-500/5 border-red-500/30' : 'bg-muted/30'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">{dev.id}</span>
                    {dev.incentive && (
                      <Badge className="bg-green-500/20 text-green-500">{t('devmanager.payment.incentive_eligible')}</Badge>
                    )}
                    {dev.hold && (
                      <Badge variant="destructive">
                        <Ban className="h-3 w-3 mr-1" />
                        {t('devmanager.payment.payment_hold')}
                      </Badge>
                    )}
                  </div>
                  {/* No currency is stored with a task amount, so none is shown. */}
                  <span className="font-bold text-lg">{formatNumber(dev.amount)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{t('devmanager.payment.hours', { hours: formatNumber(dev.hours) })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <span>{t('devmanager.payment.tasks_approved', { approved: formatNumber(dev.approved), total: formatNumber(dev.tasks) })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dev.hold ? (
                      <span className="text-red-500">{t('devmanager.payment.flagged')}</span>
                    ) : (
                      <span className="text-muted-foreground">{t('devmanager.payment.earned')}</span>
                    )}
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
