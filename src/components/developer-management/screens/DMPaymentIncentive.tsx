/**
 * PAYMENT & INCENTIVE
 * Work Hours • Approved Tasks • Incentive Eligibility • Payment Hold
 * NO DIRECT PAYOUT WITHOUT APPROVAL
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Clock, CheckCircle, AlertTriangle, Ban } from 'lucide-react';

const paymentData = [
  { id: 'DEV-001', hours: 160, tasks: 12, approved: 10, incentive: true, hold: false, amount: 4500 },
  { id: 'DEV-002', hours: 145, tasks: 8, approved: 6, incentive: false, hold: true, amount: 3200 },
  { id: 'DEV-003', hours: 168, tasks: 15, approved: 15, incentive: true, hold: false, amount: 5200 },
  { id: 'DEV-004', hours: 120, tasks: 5, approved: 3, incentive: false, hold: true, amount: 2000 },
  { id: 'DEV-005', hours: 155, tasks: 10, approved: 9, incentive: true, hold: false, amount: 4100 },
];

export const DMPaymentIncentive: React.FC = () => {
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
                  <span className="font-bold text-lg">${dev.amount.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{dev.hours} hours (Auto)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <span>{dev.approved}/{dev.tasks} tasks approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dev.hold ? (
                      <span className="text-red-500">Flagged for review</span>
                    ) : (
                      <span className="text-green-500">Ready for approval</span>
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
