import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageSquare,
  MoreVertical,
  Star,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  useCustomers,
  useTeamMembers,
  useDeals,
  useInsertRow,
  memberName,
  currency,
  relativeTime,
  type CrmCustomer,
} from "@/hooks/useSalesSupportData";

const CustomerManagement = () => {
  const { data: customers, isLoading } = useCustomers();
  const { data: members } = useTeamMembers();
  const { data: deals } = useDeals();
  const insertCustomer = useInsertRow("crm_customers");

  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", phone: "", country: "" });

  const allCustomers = customers ?? [];

  useEffect(() => {
    if (!selectedCustomer && allCustomers.length > 0) {
      setSelectedCustomer(allCustomers[0]);
    }
  }, [allCustomers, selectedCustomer]);

  const filteredCustomers = allCustomers.filter(c =>
    c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const customerDeals = (customerId: string) => (deals ?? []).filter(d => d.customer_id === customerId);
  const ratingFor = (c: CrmCustomer) => Math.max(1, Math.min(5, Math.round((c.health_score ?? 0) / 20)));

  const handleAddCustomer = async () => {
    if (!form.company_name || !form.contact_name || !form.email) {
      toast({ title: "Missing fields", description: "Company, contact and email are required.", variant: "destructive" });
      return;
    }
    try {
      const created = await insertCustomer.mutateAsync({
        company_name: form.company_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone || null,
        country: form.country || null,
        status: "active",
        plan: "standard",
        health_score: 70,
        lifetime_value: 0,
        open_tickets: 0,
      });
      toast({ title: "Customer added", description: `${form.company_name} has been added.` });
      setForm({ company_name: "", contact_name: "", email: "", phone: "", country: "" });
      setDialogOpen(false);
      setSelectedCustomer(created as CrmCustomer);
    } catch (err) {
      toast({ title: "Failed to add customer", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Management</h1>
          <p className="text-muted-foreground mt-1">Manage your customer relationships</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-blue-500 hover:bg-blue-600" size="lg">
              <Plus className="w-5 h-5" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Company Name</Label>
                <Input className="mt-1" value={form.company_name} onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))} />
              </div>
              <div>
                <Label>Contact Name</Label>
                <Input className="mt-1" value={form.contact_name} onChange={(e) => setForm(f => ({ ...f, contact_name: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" className="mt-1" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input className="mt-1" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Country</Label>
                <Input className="mt-1" value={form.country} onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))} />
              </div>
              <Button className="w-full bg-blue-500 hover:bg-blue-600" size="lg" onClick={handleAddCustomer} disabled={insertCustomer.isPending}>
                {insertCustomer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Customer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-muted-foreground text-sm py-6 text-center">Loading customers...</p>
            ) : filteredCustomers.length === 0 ? (
              <p className="text-muted-foreground text-sm py-6 text-center">No customers found.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredCustomers.map((customer, index) => (
                  <motion.div
                    key={customer.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedCustomer(customer)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedCustomer?.id === customer.id
                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                        : 'hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500">
                        <AvatarFallback className="text-foreground font-medium">
                          {customer.company_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{customer.company_name}</p>
                        <p className="text-sm text-muted-foreground truncate">{customer.contact_name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: ratingFor(customer) }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Details */}
        <Card className="lg:col-span-2 border-border">
          {!selectedCustomer ? (
            <CardContent className="p-10 text-center text-muted-foreground">Select a customer to view details</CardContent>
          ) : (
            <>
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500">
                      <AvatarFallback className="text-foreground text-xl font-bold">
                        {selectedCustomer.company_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{selectedCustomer.company_name}</h2>
                      <p className="text-muted-foreground">{selectedCustomer.contact_name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {Array.from({ length: ratingFor(selectedCustomer) }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" asChild>
                      <a href={selectedCustomer.phone ? `tel:${selectedCustomer.phone}` : undefined}>
                        <Phone className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href={`mailto:${selectedCustomer.email}`}>
                        <Mail className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button variant="outline" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs defaultValue="details">
                  <TabsList className="mb-6">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="history">Activity History</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-6">
                    {/* Contact Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-surface">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100">
                            <Mail className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="font-medium text-foreground">{selectedCustomer.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-surface">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-100">
                            <Phone className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Phone</p>
                            <p className="font-medium text-foreground">{selectedCustomer.phone ?? "—"}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-surface">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-100">
                            <MapPin className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Location</p>
                            <p className="font-medium text-foreground">{selectedCustomer.country ?? "—"}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-surface">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-orange-100">
                            <Calendar className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Last Contact</p>
                            <p className="font-medium text-foreground">{relativeTime(selectedCustomer.last_contact_at)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="border-border">
                        <CardContent className="p-6 text-center">
                          <p className="text-3xl font-bold text-blue-600">{customerDeals(selectedCustomer.id).length}</p>
                          <p className="text-sm text-muted-foreground mt-1">Total Deals</p>
                        </CardContent>
                      </Card>
                      <Card className="border-border">
                        <CardContent className="p-6 text-center">
                          <p className="text-3xl font-bold text-green-600">{currency(selectedCustomer.lifetime_value)}</p>
                          <p className="text-sm text-muted-foreground mt-1">Total Value</p>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="history">
                    <div className="space-y-4">
                      {customerDeals(selectedCustomer.id).length === 0 ? (
                        <p className="text-muted-foreground text-sm py-6 text-center">No activity recorded yet.</p>
                      ) : (
                        customerDeals(selectedCustomer.id).map((deal, index) => (
                          <motion.div
                            key={deal.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex gap-4 p-4 rounded-xl bg-surface"
                          >
                            <div className="p-2 rounded-lg bg-purple-100">
                              <MessageSquare className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{deal.title} — {deal.stage}</p>
                              <p className="text-sm text-muted-foreground">{relativeTime(deal.updated_at)}</p>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="notes">
                    <div className="space-y-4">
                      <textarea
                        placeholder="Add a note about this customer..."
                        className="w-full h-32 p-4 rounded-xl border border-border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button
                        className="bg-blue-500 hover:bg-blue-600"
                        onClick={() => toast({ title: "Notes coming soon", description: "Persistent customer notes are not yet available." })}
                      >
                        Save Note
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CustomerManagement;
