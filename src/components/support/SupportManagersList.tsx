import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Mail, Phone, MapPin, Star, Clock, CheckCircle2, XCircle,
  MoreVertical, Search, Filter, UserPlus, Shield, TrendingUp, Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useEnterpriseAudit } from '@/hooks/useEnterpriseAudit';

interface SupportManager {
  id: string;
  name: string;
  email: string;
  phone: string;
  region: string;
  country: string;
  status: 'active' | 'inactive' | 'on_leave';
  role: 'Agent' | 'Support Manager' | 'Country Head' | 'Global Admin';
  ticketsHandled: number;
  avgResolutionTime: string;
  csat: number;
  activeTickets: number;
  joinedAt: string;
  lastActive: string;
  skills: string[];
}

// PII MASKED: Names, emails, phones replaced with masked identifiers
const managers: SupportManager[] = [
  { id: 'SM001', name: 'Support-A', email: '******@masked', phone: '***-***-****', region: 'North America', country: 'USA', status: 'active', role: 'Support Manager', ticketsHandled: 1247, avgResolutionTime: '2.4h', csat: 98, activeTickets: 8, joinedAt: '2023-01-15', lastActive: '2 min ago', skills: ['POS', 'ERP', 'CRM'] },
  { id: 'SM002', name: 'Agent-01', email: '******@masked', phone: '***-***-****', region: 'North America', country: 'Canada', status: 'active', role: 'Agent', ticketsHandled: 856, avgResolutionTime: '3.1h', csat: 94, activeTickets: 5, joinedAt: '2023-03-20', lastActive: '5 min ago', skills: ['Billing', 'Dashboard'] },
  { id: 'SM003', name: 'Support-B', email: '******@masked', phone: '***-***-****', region: 'Asia Pacific', country: 'South Korea', status: 'active', role: 'Country Head', ticketsHandled: 2103, avgResolutionTime: '1.8h', csat: 99, activeTickets: 3, joinedAt: '2022-08-10', lastActive: '1 min ago', skills: ['Hospital CRM', 'School ERP'] },
  { id: 'SM004', name: 'Support-C', email: '******@masked', phone: '***-***-****', region: 'Middle East', country: 'UAE', status: 'on_leave', role: 'Support Manager', ticketsHandled: 945, avgResolutionTime: '2.9h', csat: 92, activeTickets: 0, joinedAt: '2023-02-28', lastActive: '2 days ago', skills: ['POS', 'Retail'] },
  { id: 'SM005', name: 'Agent-02', email: '******@masked', phone: '***-***-****', region: 'Europe', country: 'UK', status: 'active', role: 'Agent', ticketsHandled: 678, avgResolutionTime: '2.7h', csat: 96, activeTickets: 6, joinedAt: '2023-05-12', lastActive: '8 min ago', skills: ['Dashboard', 'Integration'] },
  { id: 'SM006', name: 'Agent-03', email: '******@masked', phone: '***-***-****', region: 'Asia Pacific', country: 'Australia', status: 'inactive', role: 'Agent', ticketsHandled: 423, avgResolutionTime: '3.5h', csat: 91, activeTickets: 0, joinedAt: '2023-06-01', lastActive: '1 week ago', skills: ['CRM', 'Logistics'] },
];

const SupportManagersList = () => {
  const { logAction } = useEnterpriseAudit();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [selectedManager, setSelectedManager] = useState<string | null>(null);

  const handleViewManager = useCallback(async (managerId: string) => {
    setSelectedManager(managerId === selectedManager ? null : managerId);
    await logAction({ action: 'view_manager', module: 'lead_manager', severity: 'low', target_id: managerId });
  }, [selectedManager, logAction]);

  const handleAssignTickets = useCallback(async (managerId: string) => {
    await logAction({ action: 'assign_tickets', module: 'lead_manager', severity: 'low', target_id: managerId });
    toast.success('Tickets auto-assigned');
  }, [logAction]);

  const handleToggleStatus = useCallback(async (managerId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await logAction({ action: 'toggle_status', module: 'lead_manager', severity: 'medium', target_id: managerId, new_values: { status: newStatus } });
    toast.success(`Status changed to ${newStatus}`);
  }, [logAction]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active': return { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' };
      case 'inactive': return { color: 'bg-muted/40 text-muted-foreground border-border', dot: 'bg-muted/40' };
      case 'on_leave': return { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' };
      default: return { color: 'bg-muted/40 text-muted-foreground', dot: 'bg-muted/40' };
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Global Admin': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Country Head': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
      case 'Support Manager': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-muted/40 text-muted-foreground border-border';
    }
  };

  // SECURITY: Search only matches masked labels (ID, role), not PII
  const filteredManagers = managers.filter(m => {
    if (filterRegion !== 'all' && m.region !== filterRegion) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (filterRole !== 'all' && m.role !== filterRole) return false;
    // Only search on masked name and ID - never real PII
    if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !m.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: managers.length,
    active: managers.filter(m => m.status === 'active').length,
    avgCsat: Math.round(managers.reduce((acc, m) => acc + m.csat, 0) / managers.length),
    totalTickets: managers.reduce((acc, m) => acc + m.activeTickets, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <User className="w-6 h-6 text-teal-400" />
            All Support Managers
          </h2>
          <p className="text-muted-foreground text-sm">Manage support team members and performance</p>
        </div>
        <Button className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Manager
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card/60 border-teal-500/20">
          <CardContent className="p-4 text-center">
            <User className="w-6 h-6 text-teal-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-teal-100">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Managers</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-100">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Active Now</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Star className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">{stats.avgCsat}%</div>
            <div className="text-xs text-muted-foreground">Avg CSAT</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <Activity className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{stats.totalTickets}</div>
            <div className="text-xs text-muted-foreground">Active Tickets</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search managers..."
            className="pl-10 bg-card/60 border-border"
          />
        </div>
        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-40 bg-card/60 border-border">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            <SelectItem value="North America">North America</SelectItem>
            <SelectItem value="Europe">Europe</SelectItem>
            <SelectItem value="Asia Pacific">Asia Pacific</SelectItem>
            <SelectItem value="Middle East">Middle East</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 bg-card/60 border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-40 bg-card/60 border-border">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="Agent">Agent</SelectItem>
            <SelectItem value="Support Manager">Support Manager</SelectItem>
            <SelectItem value="Country Head">Country Head</SelectItem>
            <SelectItem value="Global Admin">Global Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Managers List */}
      <Card className="bg-card/60 border-teal-500/20">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800">
            {filteredManagers.map((manager, index) => {
              const statusConfig = getStatusConfig(manager.status);
              const isSelected = selectedManager === manager.id;

              return (
                <motion.div
                  key={manager.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 hover:bg-card/60 transition-colors cursor-pointer ${isSelected ? 'bg-card/60' : ''}`}
                  onClick={() => handleViewManager(manager.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {/* PII MASKED: No avatar/DP - using generic icon */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 border-2 border-border flex items-center justify-center">
                          <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-border ${statusConfig.dot}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {/* PII MASKED: Show masked alias + ID */}
                          <h4 className="font-medium text-foreground">{manager.name}</h4>
                          <span className="text-xs font-mono text-muted-foreground">{manager.id}</span>
                          <Badge className={getRoleColor(manager.role)}>{manager.role}</Badge>
                          <Badge className={statusConfig.color}>{manager.status.replace('_', ' ')}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          {/* PII MASKED: Email removed, only region/timing shown */}
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{manager.country}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{manager.lastActive}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-bold text-foreground">{manager.ticketsHandled}</div>
                        <div className="text-xs text-muted-foreground">Tickets</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-teal-400">{manager.avgResolutionTime}</div>
                        <div className="text-xs text-muted-foreground">Avg Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-400">{manager.csat}%</div>
                        <div className="text-xs text-muted-foreground">CSAT</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-400">{manager.activeTickets}</div>
                        <div className="text-xs text-muted-foreground">Active</div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={(e) => { e.stopPropagation(); handleAssignTickets(manager.id); }}
                          className="text-teal-400 hover:bg-teal-500/20"
                        >
                          Assign
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(manager.id, manager.status); }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-4 border-t border-border"
                    >
                      {/* PII MASKED: Phone hidden, only non-PII data shown */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 rounded-lg bg-card/60">
                          <p className="text-xs text-muted-foreground mb-1">Region</p>
                          <p className="text-sm text-foreground">{manager.region}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-card/60">
                          <p className="text-xs text-muted-foreground mb-1">Joined</p>
                          <p className="text-sm text-foreground">{manager.joinedAt}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-card/60">
                          <p className="text-xs text-muted-foreground mb-1">Skills</p>
                          <div className="flex flex-wrap gap-1">
                            {manager.skills.map(skill => (
                              <Badge key={skill} variant="outline" className="text-xs text-teal-400 border-teal-500/30">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportManagersList;
