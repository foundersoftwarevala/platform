import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Image, AlertTriangle, CheckCircle, Eye, Brain } from 'lucide-react';
import { toast } from 'sonner';

import { useLogAction, useMisuseAlerts, useTrademarkAssets } from '@/lib/legal-data';
import { motion } from 'framer-motion';

interface TrademarkAsset {
  id: string;
  name: string;
  type: 'logo' | 'brand_name' | 'slogan' | 'design';
  registrationNumber: string;
  status: 'protected' | 'pending' | 'expired';
  expiryDate: string;
  violations: number;
}

interface MisuseAlert {
  id: string;
  assetId: string;
  assetName: string;
  detectedIn: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  aiConfidence: number;
  detectedAt: string;
}



const LMTrademarkMonitor: React.FC = () => {
  const { data: assetRows = [] } = useTrademarkAssets();
  const { data: misuseRows = [] } = useMisuseAlerts();
  const logAction = useLogAction();

  const assets: TrademarkAsset[] = assetRows.map((row) => ({
    id: row.ref_code,
    name: row.name,
    type: row.asset_type as TrademarkAsset['type'],
    registrationNumber: row.registration_number,
    status: row.status as TrademarkAsset['status'],
    expiryDate: row.expiry_date,
    violations: row.violations,
  }));

  const misuses: MisuseAlert[] = misuseRows.map((row) => ({
    id: row.ref_code,
    assetId: row.asset_ref,
    assetName: row.asset_name,
    detectedIn: row.detected_in,
    severity: row.severity as MisuseAlert['severity'],
    description: row.description,
    aiConfidence: row.ai_confidence,
    detectedAt: row.detected_at,
  }));

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'protected': return 'bg-green-500/20 text-green-400';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-red-500/20 text-red-400';
    }
  };

  const handleInvestigate = (misuse: MisuseAlert) => {
    logAction.mutate(
      {
        action: 'Trademark Misuse Investigation Opened',
        category: 'trademark',
        actor: 'LM-A1B2',
        details: `${misuse.id} for ${misuse.assetName} (${misuse.assetId}) was opened for investigation`,
      },
      {
        onSuccess: () => toast.info('Investigation logged'),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleRecommendAction = (misuse: MisuseAlert) => {
    logAction.mutate(
      {
        action: 'Trademark Takedown Recommended',
        category: 'trademark',
        actor: 'LM-A1B2',
        details: `Takedown notice recommended for ${misuse.id}, detected at ${misuse.detectedIn}`,
      },
      {
        onSuccess: () => toast.success('Action recommended to Admin'),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Registered Assets */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Registered Trademarks & IP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {assets.map((asset, index) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 rounded-lg bg-background/50 border border-border/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{asset.name}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <Badge variant="outline" className="text-xs">{asset.type.replace('_', ' ')}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Reg #:</span>
                    <span className="font-mono text-xs">{asset.registrationNumber}</span>
                  </div>
                  {asset.violations > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Violations:</span>
                      <Badge variant="destructive">{asset.violations}</Badge>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI-Detected Misuse */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-400" />
              AI-Detected Misuse
            </CardTitle>
            <Badge variant="destructive">{misuses.length} Active</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {misuses.map((misuse, index) => (
              <motion.div
                key={misuse.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 rounded-lg bg-background/50 border border-border/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono text-sm text-muted-foreground">{misuse.id}</span>
                      <Badge className={getSeverityColor(misuse.severity)}>{misuse.severity}</Badge>
                      <Badge variant="outline" className="text-xs">
                        {misuse.aiConfidence}% AI confidence
                      </Badge>
                    </div>
                    <p className="font-medium mb-1">Asset: {misuse.assetName}</p>
                    <p className="text-sm text-muted-foreground mb-1">{misuse.description}</p>
                    <p className="text-xs text-muted-foreground">Detected in: {misuse.detectedIn}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleInvestigate(misuse)}
                      disabled={logAction.isPending}
                      className="gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      Investigate
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleRecommendAction(misuse)}
                      disabled={logAction.isPending}
                      className="gap-1"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Recommend
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LMTrademarkMonitor;
