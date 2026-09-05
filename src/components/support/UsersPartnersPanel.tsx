import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Building2, Store, User, Search, Filter, Eye, MessageCircle,
  AlertTriangle, CheckCircle, XCircle, History, Star, MapPin, Phone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useEnterpriseAudit } from '@/hooks/useEnterpriseAudit';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  email: string;
  type: 'client' | 'franchise' | 'reseller';
  country: string;
  totalTickets: number;
  openTickets: number;
  avgSatisfaction: number;
  riskScore: 'low' | 'medium' | 'high';
  lastContact: string;
  products: string[];
}

const customers: Customer[] = [
  { id: 'C001', name: 'Tech Solutions Ltd', email: 'contact@techsolutions.com', type: 'client', country: 'USA', totalTickets: 45, openTickets: 3, avgSatisfaction: 4.5, riskScore: 'low', lastContact: '2 hours ago', products: ['POS', 'Dashboard'] },
  { id: 'C002', name: 'Healthcare Plus', email: 'support@healthcareplus.in', type: 'franchise', country: 'India', totalTickets: 128, openTickets: 8, avgSatisfaction: 4.2, riskScore: 'medium', lastContact: '30 min ago', products: ['Hospital CRM', 'ERP'] },
  { id: 'C003', name: 'EduLearn Academy', email: 'admin@edulearn.pk', type: 'client', country: 'Pakistan', totalTickets: 23, openTickets: 1, avgSatisfaction: 4.8, riskScore: 'low', lastContact: '1 day ago', products: ['School ERP'] },
  { id: 'C004', name: 'Retail Mart Network', email: 'ops@retailmart.ae', type: 'reseller', country: 'UAE', totalTickets: 89, openTickets: 5, avgSatisfaction: 3.9, riskScore: 'high', lastContact: '15 min ago', products: ['POS', 'Retail Suite'] },
  { id: 'C005', name: 'Global Logistics Inc', email: 'it@globallogistics.uk', type: 'franchise', country: 'UK', totalTickets: 67, openTickets: 2, avgSatisfaction: 4.6, riskScore: 'low', lastContact: '4 hours ago', products: ['Logistics CRM', 'Dashboard'] },
];

const UsersPartnersPanel = () => {
  const { logAction } = useEnterpriseAudit();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const handleViewCustomer = useCallback(async (customerId: string) => {
    setSelectedCustomer(customerId === selectedCustomer ? null : customerId);
    await logAction({ action: 'view_customer', module: 'lead_manager', severity: 'low', target_id: customerId });
  }, [selectedCustomer, logAction]);

  const handleContactCustomer = useCallback(async (customerId: string) => {
    await logAction({ action: 'contact_customer', module: 'lead_manager', severity: 'low', target_id: customerId });
    toast.success('Opening communication channel...');
  }, [logAction]);

  const handleViewHistory = useCallback(async (customerId: string) => {
    await logAction({ action: 'view_history', module: 'lead_manager', severity: 'low', target_id: customerId });
    toast.success('Loading ticket history...');
  }, [logAction]);

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'client': return { icon: User, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Client' };
      case 'franchise': return { icon: Building2, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'Franchise' };
      case 'reseller': return { icon: Store, color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', label: 'Reseller' };
      default: return { icon: User, color: 'bg-muted/40 text-muted-foreground', label: 'Unknown' };
    }
  };

  const getRiskConfig = (risk: string) => {
    switch (risk) {
      case 'low': return { color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle };
      case 'medium': return { color: 'bg-amber-500/20 text-amber-400', icon: AlertTriangle };
      case 'high': return { color: 'bg-red-500/20 text-red-400', icon: XCircle };
      default: return { color: 'bg-muted/40 text-muted-foreground', icon: CheckCircle };
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (activeTab !== 'all' && c.type !== activeTab) return false;
    if (filterRisk !== 'all' && c.riskScore !== filterRisk) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !c.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: customers.length,
    clients: customers.filter(c => c.type === 'client').length,
    franchises: customers.filter(c => c.type === 'franchise').length,
    resellers: customers.filter(c => c.type === 'reseller').length,
    highRisk: customers.filter(c => c.riskScore === 'high').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-400" />
            Users & Partners
          </h2>
          <p className="text-muted-foreground text-sm">Manage clients, franchises, and resellers</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-card/60 border-teal-500/20">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-teal-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-teal-100">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <User className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-100">{stats.clients}</div>
            <div className="text-xs text-muted-foreground">Clients</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <Building2 className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{stats.franchises}</div>
            <div className="text-xs text-muted-foreground">Franchises</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-teal-500/20">
          <CardContent className="p-4 text-center">
            <Store className="w-6 h-6 text-teal-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-teal-100">{stats.resellers}</div>
            <div className="text-xs text-muted-foreground">Resellers</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{stats.highRisk}</div>
            <div className="text-xs text-muted-foreground">High Risk</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Filters */}
      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/60">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="client">Clients</TabsTrigger>
            <TabsTrigger value="franchise">Franchises</TabsTrigger>
            <TabsTrigger value="reseller">Resellers</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-10 w-64 bg-card/60 border-border"
            />
          </div>
          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-32 bg-card/60 border-border">
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Customer List */}
      <Card className="bg-card/60 border-teal-500/20">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800">
            {filteredCustomers.map((customer, index) => {
              const typeConfig = getTypeConfig(customer.type);
              const riskConfig = getRiskConfig(customer.riskScore);
              const isSelected = selectedCustomer === customer.id;

              return (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 hover:bg-card/60 transition-colors cursor-pointer ${isSelected ? 'bg-card/60' : ''}`}
                  onClick={() => handleViewCustomer(customer.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12 border-2 border-border">
                        <AvatarFallback className="bg-gradient-to-br from-teal-500 to-blue-500 text-foreground">
                          {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{customer.name}</h4>
                          <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                          <Badge className={riskConfig.color}>
                            <riskConfig.icon className="w-3 h-3 mr-1" />
                            {customer.riskScore}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span>{customer.email}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{customer.country}</span>
                          <span>Last: {customer.lastContact}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-bold text-foreground">{customer.totalTickets}</div>
                        <div className="text-xs text-muted-foreground">Total Tickets</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-400">{customer.openTickets}</div>
                        <div className="text-xs text-muted-foreground">Open</div>
                      </div>
                      <div className="text-center flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-400" />
                        <span className="text-lg font-bold text-amber-100">{customer.avgSatisfaction}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={(e) => { e.stopPropagation(); handleContactCustomer(customer.id); }}
                          className="text-teal-400 hover:bg-teal-500/20"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={(e) => { e.stopPropagation(); handleViewHistory(customer.id); }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-4 border-t border-border"
                    >
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground mr-2">Products:</span>
                        {customer.products.map(product => (
                          <Badge key={product} variant="outline" className="text-xs text-teal-400 border-teal-500/30">
                            {product}
                          </Badge>
                        ))}
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

export default UsersPartnersPanel;
