import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Play,
  Pause,
  Eye,
  EyeOff,
  Users,
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoManagerAccess } from '@/hooks/useDemoManagerAccess';
import { DemoAccessGate } from './DemoAccessGate';
import { format } from 'date-fns';

interface Demo {
  id: string;
  title: string;
  url: string;
  login_url: string | null;
  demo_type: string | null;
  lifecycle_status: string | null;
  total_login_roles: number | null;
  created_at: string;
  is_bulk_created: boolean | null;
}

interface LoginRole {
  id: string;
  role_name: string;
  username: string;
  password_encrypted: string;
  is_active: boolean;
}

function DemoLoginManagerContent() {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDemo, setSelectedDemo] = useState<Demo | null>(null);
  const [loginRoles, setLoginRoles] = useState<LoginRole[]>([]);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const { isDemoManager, createReportCard } = useDemoManagerAccess();

  const fetchDemos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('demos')
        .select('id, title, url, login_url, demo_type, lifecycle_status, total_login_roles, created_at, is_bulk_created')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDemos(data || []);
    } catch (error) {
      console.error('Error fetching demos:', error);
      toast.error('Failed to load demos');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLoginRoles = useCallback(async (demoId: string) => {
    try {
      const { data, error } = await supabase
        .from('demo_login_roles')
        .select('*')
        .eq('demo_id', demoId)
        .order('display_order');

      if (error) throw error;
      setLoginRoles((data ?? []) as unknown as LoginRole[]);
    } catch (error) {
      console.error('Error fetching login roles:', error);
    }
  }, []);

  useEffect(() => {
    fetchDemos();
  }, [fetchDemos]);

  useEffect(() => {
    if (selectedDemo) {
      fetchLoginRoles(selectedDemo.id);
    }
  }, [selectedDemo, fetchLoginRoles]);

  const toggleDemoStatus = async (demo: Demo) => {
    if (!isDemoManager) {
      toast.error('Only Demo Manager can change demo status');
      return;
    }

    const newStatus = demo.lifecycle_status === 'active' ? 'disabled' : 'active';
    
    try {
      const { error } = await supabase
        .from('demos')
        .update({ 
          lifecycle_status: newStatus,
          activated_at: newStatus === 'active' ? new Date().toISOString() : null
        })
        .eq('id', demo.id);

      if (error) throw error;

      await createReportCard({
        demoId: demo.id,
        demoName: demo.title,
        actionType: 'status_update',
        demoStatus: newStatus,
        oldValues: { lifecycle_status: demo.lifecycle_status },
        newValues: { lifecycle_status: newStatus }
      });

      toast.success(`Demo ${newStatus === 'active' ? 'activated' : 'disabled'}`);
      fetchDemos();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 gap-1"><CheckCircle className="w-3 h-3" />Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
      case 'disabled':
        return <Badge className="bg-red-500/20 text-red-400 gap-1"><XCircle className="w-3 h-3" />Disabled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredDemos = demos.filter(demo =>
    demo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (demo.demo_type || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
      {/* Demos List */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Demos ({filteredDemos.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchDemos}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search demos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2 pr-2">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              ) : filteredDemos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No demos found</p>
              ) : (
                filteredDemos.map(demo => (
                  <Card 
                    key={demo.id}
                    className={`cursor-pointer transition-colors ${
                      selectedDemo?.id === demo.id 
                        ? 'bg-primary/10 border-primary' 
                        : 'bg-background/50 hover:bg-background/80'
                    }`}
                    onClick={() => setSelectedDemo(demo)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{demo.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{demo.demo_type || 'General'}</Badge>
                            {getStatusBadge(demo.lifecycle_status)}
                            {demo.is_bulk_created && (
                              <Badge variant="outline" className="text-xs">Bulk</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge className="bg-primary/20 text-primary">
                            {demo.total_login_roles || 0} roles
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDemoStatus(demo);
                            }}
                          >
                            {demo.lifecycle_status === 'active' ? (
                              <Pause className="w-4 h-4 text-yellow-400" />
                            ) : (
                              <Play className="w-4 h-4 text-green-400" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Login Roles Panel */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Login Credentials
            {selectedDemo && (
              <span className="text-sm font-normal text-muted-foreground">
                - {selectedDemo.title}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedDemo ? (
            <div className="flex items-center justify-center h-[500px] text-muted-foreground">
              Select a demo to view login credentials
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-2">
                {/* Demo Info */}
                <Card className="bg-primary/5">
                  <CardContent className="py-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <span className="ml-2 font-medium">{selectedDemo.demo_type || 'General'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <span className="ml-2">{getStatusBadge(selectedDemo.lifecycle_status)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Login URL:</span>
                        <a 
                          href={selectedDemo.login_url || selectedDemo.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {selectedDemo.login_url || selectedDemo.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Login Roles */}
                {loginRoles.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No login roles configured
                  </p>
                ) : (
                  loginRoles.map((role, idx) => (
                    <Card key={role.id} className="bg-background/50">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className="bg-primary/20 text-primary">
                            {role.role_name}
                          </Badge>
                          <Badge variant={role.is_active ? "default" : "secondary"}>
                            {role.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground block text-xs">Username</span>
                            <code className="text-foreground bg-muted/50 px-2 py-1 rounded block mt-1">
                              {role.username}
                            </code>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-xs">Password</span>
                            <div className="flex items-center gap-1 mt-1">
                              <code className="text-foreground bg-muted/50 px-2 py-1 rounded flex-1">
                                {showPasswords[role.id] ? role.password_encrypted : '••••••••'}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setShowPasswords(prev => ({ ...prev, [role.id]: !prev[role.id] }))}
                              >
                                {showPasswords[role.id] ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DemoLoginManager() {
  return (
    <DemoAccessGate requireEdit>
      <DemoLoginManagerContent />
    </DemoAccessGate>
  );
}
