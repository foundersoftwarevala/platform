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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payment & Incentive</h1>
        <p className="text-muted-foreground">Work hours and payment management</p>
      </div>

      {/* Warning */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="flex items-center gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="text-sm text-amber-500 font-medium">
            NO DIRECT PAYOUT WITHOUT APPROVAL
          </span>
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(registry.isLoading || tasks.isLoading || failure || paymentData.length === 0) && (
              <p className="text-sm text-muted-foreground">
                {registry.isLoading || tasks.isLoading ? 'Loading…' : failure ? `Figures could not be read: ${failure.message}` : 'No developer is registered.'}
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
                      <Badge className="bg-green-500/20 text-green-500">Incentive Eligible</Badge>
                    )}
                    {dev.hold && (
                      <Badge variant="destructive">
                        <Ban className="h-3 w-3 mr-1" />
                        Payment Hold
                      </Badge>
                    )}
                  </div>
                  <span className="font-bold text-lg">{dev.amount.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{dev.hours} hours (estimated)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <span>{dev.approved}/{dev.tasks} tasks approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dev.hold ? (
                      <span className="text-red-500">Flagged for review</span>
                    ) : (
                      <span className="text-muted-foreground">Earned on completed tasks</span>
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
