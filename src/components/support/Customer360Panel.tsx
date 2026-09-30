import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Ticket, MessageCircle, FileText, Star, MapPin, Phone, Mail, Building, Shield, X, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { memberName, relativeTime, useCustomers, useTeamMembers, useTickets } from '@/hooks/useSalesSupportData';

interface Customer360PanelProps {
  customerId?: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * One customer, from the CRM, with their support tickets.
 *
 * This showed a single invented company ("Tech Solutions Ltd", $125K lifetime
 * value, four past tickets, three products, three payments and three notes)
 * whoever opened it. The agent now picks a real crm_customers record and sees
 * it with its support tickets. Products, payments and internal notes are not
 * linked to a CRM customer anywhere yet, so those tabs say so.
 */
const Customer360Panel = ({ customerId, isOpen, onClose }: Customer360PanelProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const { data: customerRows } = useCustomers();
  const { data: ticketRows } = useTickets();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customers = (customerRows ?? []) as any[];
  const [selectedId, setSelectedId] = useState<string | null>(customerId ?? null);
  const row = customers.find((c) => c.id === selectedId) ?? customers[0] ?? null;
  const customerData = {
    id: row?.id ?? '',
    name: row ? String(row.company_name || row.contact_name || 'Customer') : 'No customer',
    email: row?.email ?? '—',
    phone: row?.phone ?? '—',
    company: row?.company_name ?? '—',
    location: row?.country ?? '—',
    segment: row?.plan ?? '—',
    // The CRM records a health score; risk is its complement.
    riskScore: row?.health_score == null ? 0 : Math.max(0, 100 - Number(row.health_score)),
    lifetimeValue: Number(row?.lifetime_value ?? 0),
    accountStatus: row?.status ?? '—',
    joinedDate: row?.created_at ? new Date(row.created_at).toLocaleDateString() : '—',
    lastActivity: relativeTime(row?.last_contact_at),
  };
  const names = new Set([row?.company_name, row?.contact_name].filter(Boolean).map((n) => String(n).toLowerCase()));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pastTickets = ((ticketRows ?? []) as any[])
    .filter((t) => row && (t.customer_id === row.id || names.has(String(t.customer_name ?? '').toLowerCase())))
    .map((t) => ({ id: t.reference ?? t.id.slice(0, 8), subject: t.subject, status: t.status, date: relativeTime(t.created_at), csat: t.csat }));
  const rated = pastTickets.filter((t) => t.csat != null);
  const avgCsat = rated.length ? (rated.reduce((sum, t) => sum + Number(t.csat), 0) / rated.length).toFixed(1) : '—';
  const { data: allMembers } = useTeamMembers();
  const ownerName = memberName(allMembers, row?.owner_id ?? null);
  const products: { name: string; status: string; since: string; usage: number }[] = [];
  const paymentHistory: { id: string; amount: number; date: string; status: string }[] = [];
  const internalNotes: { author: string; note: string; date: string }[] = [];

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
                <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close customer panel">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <select
                aria-label="Customer"
                value={row?.id ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mb-4 w-full rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-foreground"
              >
                {customers.length === 0 && <option value="">No customer in the CRM yet</option>}
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name || c.contact_name}</option>
                ))}
              </select>

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
                <div className="text-lg font-bold text-foreground">{customerData.lifetimeValue.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">LTV</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-card/60">
                <Ticket className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-foreground">{pastTickets.length}</div>
                <div className="text-xs text-muted-foreground">Total Tickets</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-card/60">
                <Star className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-foreground">{avgCsat}</div>
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
                      {/* Who owns this customer in the CRM - a reseller or a team member. */}
                      <div className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          {ownerName ?? "No owner recorded"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tickets" className="mt-0 space-y-3">
                  {pastTickets.length === 0 && <p className="text-sm text-muted-foreground">No support ticket from this customer.</p>}
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
                            <span>{ticket.csat == null ? '—' : `${ticket.csat}/5`}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="products" className="mt-0 space-y-3">
                  {products.length === 0 && <p className="text-sm text-muted-foreground">Products are not linked to a CRM customer yet.</p>}
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
                  {paymentHistory.length === 0 && <p className="text-sm text-muted-foreground">Payments are not linked to a CRM customer yet.</p>}
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
                  {internalNotes.length === 0 && <p className="text-sm text-muted-foreground">No internal note is kept for CRM customers yet.</p>}
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
