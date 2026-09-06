/**
 * COMPLIANCE & NDA
 * NDA Status • Policy Acceptance • Violation History
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, FileCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const complianceData = [
  { id: 'DEV-001', nda: 'signed', policy: true, violations: 0 },
  { id: 'DEV-002', nda: 'signed', policy: true, violations: 1 },
  { id: 'DEV-003', nda: 'signed', policy: true, violations: 0 },
  { id: 'DEV-004', nda: 'pending', policy: false, violations: 0 },
  { id: 'DEV-005', nda: 'signed', policy: true, violations: 2 },
];

const violationHistory = [
  { id: 'VIO-001', dev: 'DEV-002', type: 'Late submission', date: '2024-01-10', resolved: true },
  { id: 'VIO-002', dev: 'DEV-005', type: 'Policy breach', date: '2024-01-08', resolved: true },
  { id: 'VIO-003', dev: 'DEV-005', type: 'Unauthorized access', date: '2024-01-05', resolved: false },
];

export const DMComplianceNDA: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance & NDA</h1>
        <p className="text-muted-foreground">NDA status and policy compliance</p>
      </div>

      {/* Compliance Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {complianceData.map((dev) => (
              <div 
                key={dev.id}
                className={`p-4 rounded-lg border ${
                  dev.nda === 'pending' || !dev.policy || dev.violations > 0 
                    ? 'bg-amber-500/5 border-amber-500/30' 
                    : 'bg-green-500/5 border-green-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-medium">{dev.id}</span>
                    <Badge className={dev.nda === 'signed' ? 'bg-green-500/20 text-green-500' : 'bg-amber-500/20 text-amber-500'}>
                      <FileCheck className="h-3 w-3 mr-1" />
                      NDA {dev.nda}
                    </Badge>
                    <Badge className={dev.policy ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>
                      {dev.policy ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      Policy
                    </Badge>
                  </div>
                  {dev.violations > 0 ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {dev.violations} violation{dev.violations > 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <Badge className="bg-green-500/20 text-green-500">Clean</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Violation History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Violation History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {violationHistory.map((vio) => (
              <div 
                key={vio.id}
                className={`p-4 rounded-lg border ${vio.resolved ? 'bg-muted/30' : 'bg-red-500/5 border-red-500/30'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm">{vio.id}</span>
                      <span className="font-mono text-sm">{vio.dev}</span>
                    </div>
                    <p className="text-sm">{vio.type}</p>
                    <p className="text-xs text-muted-foreground">{vio.date}</p>
                  </div>
                  <Badge className={vio.resolved ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>
                    {vio.resolved ? 'Resolved' : 'Pending'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMComplianceNDA;
