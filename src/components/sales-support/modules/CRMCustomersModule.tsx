import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Edit, Eye, Ticket, History, Star, DollarSign, Phone, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCustomers, useUpdateRow, useInsertRow, relativeTime, currency, type CrmCustomer } from "@/hooks/useSalesSupportData";

const CRMCustomersModule = () => {
  const { data: customersData, isLoading } = useCustomers();
  const updateCustomer = useUpdateRow("crm_customers");
  const insertTicket = useInsertRow("support_tickets");
  const customers: CrmCustomer[] = customersData ?? [];

  const [searchTerm, setSearchTerm] = useState("");
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);

  const handleEditProfile = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      setEditDrawerOpen(true);
    }
  };

  const handleViewHistory = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      setHistoryDrawerOpen(true);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedCustomer) return;
    try {
      await updateCustomer.mutateAsync({
        id: selectedCustomer.id,
        values: {
          company_name: selectedCustomer.company_name,
          contact_name: selectedCustomer.contact_name,
          email: selectedCustomer.email,
          phone: selectedCustomer.phone,
        },
      });
      toast.success("Profile updated", { description: `${selectedCustomer.company_name} saved successfully` });
      setEditDrawerOpen(false);
    } catch (e) {
      toast.error("Failed to update profile");
    }
  };

  const handleRaiseTicket = async (customer: CrmCustomer) => {
    toast.loading("Creating support ticket...", { id: `ticket-${customer.id}` });
    try {
      await insertTicket.mutateAsync({
        reference: `TKT-${Date.now().toString().slice(-6)}`,
        subject: "New request",
        customer_id: customer.id,
        customer_name: customer.company_name,
        priority: "medium",
        status: "new",
        category: "General",
      });
      toast.success("Support ticket created", { id: `ticket-${customer.id}` });
    } catch (e) {
      toast.error("Failed to create ticket", { id: `ticket-${customer.id}` });
    }
  };

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
    toast.info(`Initiating call to ${phone}`, { description: "Call center connecting..." });
  };

  const handleEmail = (email: string) => {
    window.open(`mailto:${email}`, '_blank');
    toast.info(`Opening email composer for ${email}`, { description: "Email client opened" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-500/20 text-emerald-300";
      case "at_risk": return "bg-amber-500/20 text-amber-300";
      case "churned": return "bg-red-500/20 text-red-300";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const filteredCustomers = customers.filter((c) =>
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = customers.reduce((sum, c) => sum + Number(c.lifetime_value ?? 0), 0);
  const activeCustomers = customers.filter((c) => c.status === "active").length;
  const atRiskCount = customers.filter((c) => c.status === "at_risk").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">CRM / Customer Management</h2>
          <p className="text-muted-foreground">Full customer profiles with history and support scores</p>
        </div>
        <Input
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64 bg-card/60 border-border"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{customers.length}</div>
            <div className="text-xs text-muted-foreground">Total Customers</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <Star className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-100">{activeCustomers}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">${(totalRevenue / 1000).toFixed(0)}K</div>
            <div className="text-xs text-muted-foreground">Total Revenue</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <History className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{atRiskCount}</div>
            <div className="text-xs text-muted-foreground">At Risk</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">Customer Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm py-6 text-center">Loading customers…</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-muted-foreground text-sm py-6 text-center">No customers found.</div>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map((customer, index) => (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-cyan-500/20 text-cyan-300 text-lg">{customer.company_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-cyan-400 text-sm">{customer.id.slice(0, 8)}</span>
                          <span className="font-medium text-foreground">{customer.company_name}</span>
                          <Badge className={getStatusColor(customer.status)}>{customer.status.replace('_', ' ')}</Badge>
                          <Badge variant="outline" className="text-muted-foreground">{customer.industry ?? "—"}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{customer.contact_name} • {customer.email} • {customer.phone ?? "—"}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Purchases: {currency(customer.lifetime_value)}</span>
                          <span>Tickets: {customer.open_tickets}</span>
                          <span className={getScoreColor(customer.health_score)}>Score: {customer.health_score}%</span>
                          <span>Last: {relativeTime(customer.last_contact_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleCall(customer.phone ?? "")} className="text-cyan-400">
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleEmail(customer.email)} className="text-cyan-400">
                        <Mail className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEditProfile(customer.id)} className="border-border text-muted-foreground">
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleViewHistory(customer.id)} className="border-cyan-500/30 text-cyan-300">
                        <Eye className="w-3 h-3 mr-1" />
                        History
                      </Button>
                      <Button size="sm" onClick={() => handleRaiseTicket(customer)} className="bg-amber-500 hover:bg-amber-600">
                        <Ticket className="w-3 h-3 mr-1" />
                        Ticket
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Drawer */}
      <Sheet open={editDrawerOpen} onOpenChange={setEditDrawerOpen}>
        <SheetContent className="bg-card/60 border-border">
          <SheetHeader>
            <SheetTitle className="text-cyan-100">Edit Customer Profile</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Update customer information for {selectedCustomer?.company_name}
            </SheetDescription>
          </SheetHeader>
          {selectedCustomer && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Company Name</Label>
                <Input
                  value={selectedCustomer.company_name}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, company_name: e.target.value })}
                  className="bg-card/60 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Contact Person</Label>
                <Input
                  value={selectedCustomer.contact_name}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, contact_name: e.target.value })}
                  className="bg-card/60 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Email</Label>
                <Input
                  value={selectedCustomer.email}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                  className="bg-card/60 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Phone</Label>
                <Input
                  value={selectedCustomer.phone ?? ""}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })}
                  className="bg-card/60 border-border"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveProfile} className="flex-1 bg-cyan-500 hover:bg-cyan-600">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setEditDrawerOpen(false)} className="border-border">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* History Drawer */}
      <Sheet open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen}>
        <SheetContent className="bg-card/60 border-border">
          <SheetHeader>
            <SheetTitle className="text-cyan-100">Customer History</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Purchase and ticket history for {selectedCustomer?.company_name}
            </SheetDescription>
          </SheetHeader>
          {selectedCustomer && (
            <ScrollArea className="h-[calc(100vh-150px)] mt-6">
              <div className="space-y-4">
                <Card className="bg-card/60 border-border">
                  <CardContent className="p-4">
                    <h4 className="text-cyan-300 font-medium mb-2">Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Total Purchases:</div>
                      <div className="text-foreground">{currency(selectedCustomer.lifetime_value)}</div>
                      <div className="text-muted-foreground">Support Tickets:</div>
                      <div className="text-foreground">{selectedCustomer.open_tickets}</div>
                      <div className="text-muted-foreground">Support Score:</div>
                      <div className="text-foreground">{selectedCustomer.health_score}%</div>
                      <div className="text-muted-foreground">Last Contact:</div>
                      <div className="text-foreground">{relativeTime(selectedCustomer.last_contact_at)}</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-border">
                  <CardContent className="p-4">
                    <h4 className="text-cyan-300 font-medium mb-2">Recent Activity</h4>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>• Plan: {selectedCustomer.plan}</p>
                      <p>• Support ticket opened: {relativeTime(selectedCustomer.last_contact_at)}</p>
                      <p>• Customer since: {relativeTime(selectedCustomer.created_at)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CRMCustomersModule;
