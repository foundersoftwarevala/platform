/**
 * SECURITY & ACCESS
 * Access Level • Session Control • IP/Device Binding
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Monitor, Wifi, Smartphone, Ban, Clock } from 'lucide-react';
import { toast } from 'sonner';

const securityData = [
  { id: 'DEV-001', level: 'full', sessions: 2, ip: '192.168.x.x', device: 'MacBook Pro', status: 'active' },
  { id: 'DEV-002', level: 'limited', sessions: 1, ip: '10.0.x.x', device: 'Windows PC', status: 'active' },
  { id: 'DEV-003', level: 'full', sessions: 3, ip: '172.16.x.x', device: 'MacBook Air', status: 'active' },
  { id: 'DEV-004', level: 'restricted', sessions: 0, ip: 'N/A', device: 'N/A', status: 'locked' },
  { id: 'DEV-005', level: 'limited', sessions: 1, ip: '192.168.x.x', device: 'Linux PC', status: 'active' },
];

const getAccessBadge = (level: string) => {
  switch (level) {
    case 'full': return <Badge className="bg-green-500/20 text-green-500">Full Access</Badge>;
    case 'limited': return <Badge className="bg-amber-500/20 text-amber-500">Limited</Badge>;
    case 'restricted': return <Badge variant="destructive">Restricted</Badge>;
    default: return <Badge>{level}</Badge>;
  }
};

export const DMSecurityAccess: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security & Access</h1>
        <p className="text-muted-foreground">Developer access control and session management</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Access Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {securityData.map((dev) => (
              <div 
                key={dev.id}
                className={`p-4 rounded-lg border ${dev.status === 'locked' ? 'bg-red-500/5 border-red-500/30' : 'bg-muted/30'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">{dev.id}</span>
                    {getAccessBadge(dev.level)}
                    <Badge variant={dev.status === 'active' ? 'default' : 'destructive'}>
                      {dev.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{dev.sessions} active session(s)</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                    <span>IP: {dev.ip}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span>Device: {dev.device}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => toast.warning(`Access locked for ${dev.id}`)}
                    disabled={dev.status === 'locked'}
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Lock Access
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.info(`Temporary access granted to ${dev.id}`)}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Temporary Grant
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMSecurityAccess;
