import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, CreditCard, Package, Ticket, AlertTriangle, 
  MessageCircle, FileText, Clock, Star, MapPin, Phone,
  Mail, Building, Shield, X, ChevronRight, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Customer360PanelProps {
  customerId?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Mock customer data
const customerData = {
  id: 'C001',
  name: 'Tech Solutions Ltd',
  email: 'contact@techsolutions.com',
  phone: '+1 (555) 123-4567',
  company: 'Tech Solutions Ltd',
  location: 'San Francisco, CA',
  segment: 'Enterprise',
  riskScore: 15,
  lifetimeValue: 125000,
  accountStatus: 'Active',
  joinedDate: 'Jan 2022',
  lastActivity: '5 min ago',
};

const pastTickets = [
  { id: 'TKT-1240', subject: 'API integration help', status: 'resolved', date: '2 days ago', csat: 5 },
  { id: 'TKT-1235', subject: 'Billing question', status: 'resolved', date: '1 week ago', csat: 4 },
  { id: 'TKT-1228', subject: 'Feature request', status: 'closed', date: '2 weeks ago', csat: 5 },
  { id: 'TKT-1220', subject: 'Login issues', status: 'resolved', date: '3 weeks ago', csat: 5 },
];

const products = [
  { name: 'Enterprise Suite', status: 'active', since: 'Jan 2022', usage: 95 },
  { name: 'API Pro', status: 'active', since: 'Mar 2022', usage: 78 },
  { name: 'Analytics Dashboard', status: 'trial', since: 'Dec 2024', usage: 45 },
];

const paymentHistory = [
  { id: 'PAY-001', amount: 2500, date: 'Jan 1, 2025', status: 'paid' },
  { id: 'PAY-002', amount: 2500, date: 'Dec 1, 2024', status: 'paid' },
  { id: 'PAY-003', amount: 2500, date: 'Nov 1, 2024', status: 'paid' },
];

const internalNotes = [
  { author: 'Sarah Chen', note: 'VIP customer - prioritize all tickets', date: '1 week ago' },
  { author: 'Mike Johnson', note: 'Interested in enterprise expansion', date: '2 weeks ago' },
  { author: 'Lisa Park', note: 'Prefers email communication', date: '1 month ago' },
];

const Customer360Panel = ({ customerId, isOpen, onClose }: Customer360PanelProps) => {
  const [activeTab, setActiveTab] = useState('overview');

  const getRiskColor = (score: number) => {
    if (score <= 20) return 'text-emerald-400 bg-emerald-500/20';
    if (score <= 50) return 'text-amber-400 bg-amber-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getRiskLabel = (score: number) => {
    if (score <= 20) return 'Low Risk';
    if (score <= 50) return 'Medium Risk';
    return 'High Risk';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 bottom-0 w-[480px] bg-card/60 backdrop-blur-xl border-l border-teal-500/20 z-50 shadow-2xl"
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <User className="w-5 h-5 text-teal-400" />
                  Customer 360°
                </h2>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-foreground text-2xl font-bold">
                  {customerData.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">{customerData.name}</h3>
                  <p className="text-sm text-muted-foreground">{customerData.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-teal-500/20 text-teal-300">{customerData.segment}</Badge>
                    <Badge className={getRiskColor(customerData.riskScore)}>
                      <Shield className="w-3 h-3 mr-1" />
                      {getRiskLabel(customerData.riskScore)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 p-4 border-b border-border">
              <div className="text-center p-3 rounded-lg bg-card/60">
                <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-foreground">${(customerData.lifetimeValue / 1000).toFixed(0)}K</div>
                <div className="text-xs text-muted-foreground">LTV</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-card/60">
                <Ticket className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-foreground">{pastTickets.length}</div>
                <div className="text-xs text-muted-foreground">Total Tickets</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-card/60">
                <Star className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-foreground">4.8</div>
                <div className="text-xs text-muted-foreground">Avg CSAT</div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid grid-cols-5 mx-4 mt-4 bg-card/60">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="tickets" className="text-xs">Tickets</TabsTrigger>
                <TabsTrigger value="products" className="text-xs">Products</TabsTrigger>
                <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 p-4">
                <TabsContent value="overview" className="mt-0 space-y-4">
                  {/* Contact Info */}
                  <Card className="bg-card/60 border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{customerData.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{customerData.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{customerData.company}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{customerData.location}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Account Status */}
                  <Card className="bg-card/60 border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Account Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <Badge className="bg-emerald-500/20 text-emerald-300">{customerData.accountStatus}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Customer Since</span>
                        <span className="text-muted-foreground">{customerData.joinedDate}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Last Activity</span>
                        <span className="text-muted-foreground">{customerData.lastActivity}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Franchise/Reseller Link */}
                  <Card className="bg-card/60 border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Linked Accounts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full justify-between border-border text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          West Coast Franchise
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tickets" className="mt-0 space-y-3">
                  {pastTickets.map((ticket) => (
                    <Card key={ticket.id} className="bg-card/60 border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-teal-400 text-sm">{ticket.id}</span>
                          <Badge className={ticket.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-muted/40 text-muted-foreground'}>
                            {ticket.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{ticket.subject}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{ticket.date}</span>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400" />
                            <span>{ticket.csat}/5</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="products" className="mt-0 space-y-3">
                  {products.map((product) => (
                    <Card key={product.name} className="bg-card/60 border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground">{product.name}</span>
                          <Badge className={product.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}>
                            {product.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                          <span>Since: {product.since}</span>
                          <span>Usage: {product.usage}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                            style={{ width: `${product.usage}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="payments" className="mt-0 space-y-3">
                  {paymentHistory.map((payment) => (
                    <Card key={payment.id} className="bg-card/60 border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-muted-foreground text-sm">{payment.id}</span>
                            <p className="text-lg font-semibold text-foreground">${payment.amount.toLocaleString()}</p>
                            <span className="text-xs text-muted-foreground">{payment.date}</span>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-300">{payment.status}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="notes" className="mt-0 space-y-3">
                  {internalNotes.map((note, idx) => (
                    <Card key={idx} className="bg-card/60 border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-teal-400">{note.author}</span>
                          <span className="text-xs text-muted-foreground">{note.date}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{note.note}</p>
                      </CardContent>
                    </Card>
                  ))}
                  <Button variant="outline" className="w-full border-dashed border-border text-muted-foreground">
                    + Add Internal Note
                  </Button>
                </TabsContent>
              </ScrollArea>
            </Tabs>

            {/* Footer Actions */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Button className="flex-1 bg-teal-500 hover:bg-teal-600">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact Customer
                </Button>
                <Button variant="outline" className="flex-1 border-border">
                  <FileText className="w-4 h-4 mr-2" />
                  View Full Profile
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Customer360Panel;
