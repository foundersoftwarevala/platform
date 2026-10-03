/**
 * COMPLIANCE & NDA
 * NDA Status • Policy Acceptance • Violation History
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, FileCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/use-translation';

/**
 * NDA and policy compliance. Five developers' NDA states and three violations
 * were typed in here. The platform does not record an NDA, a policy
 * acceptance or a violation for developers, so both lists say so rather than
 * show anyone as signed, clean or in breach.
 */
const complianceData: { id: string; nda: string; policy: boolean; violations: number }[] = [];
const violationHistory: { id: string; dev: string; type: string; date: string; resolved: boolean }[] = [];

export const DMComplianceNDA: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.compliance.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.compliance.subtitle')}</p>
      </div>

      {/* Compliance Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('devmanager.compliance.status')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {complianceData.length === 0 && (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {t('devmanager.compliance.status_empty')}
              </p>
            )}
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
                      {t('devmanager.compliance.nda_state', { state: dev.nda })}
                    </Badge>
                    <Badge className={dev.policy ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>
                      {dev.policy ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      {t('devmanager.compliance.policy')}
                    </Badge>
                  </div>
                  {dev.violations > 0 ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {t('devmanager.compliance.violations', { count: dev.violations })}
                    </Badge>
                  ) : (
                    <Badge className="bg-green-500/20 text-green-500">{t('devmanager.compliance.clean')}</Badge>
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
            {t('devmanager.compliance.violation_history')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {violationHistory.length === 0 && (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {t('devmanager.compliance.violations_empty')}
              </p>
            )}
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
                    {vio.resolved ? t('devmanager.compliance.resolved') : t('devmanager.status.pending')}
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
