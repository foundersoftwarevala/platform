import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Filter,
  Phone,
  MessageCircle,
  Globe,
  Mail,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  useLeads,
  useTeamMembers,
  useInsertRow,
  useUpdateRow,
  useDeleteRow,
  memberName,
  currency,
  relativeTime,
} from "@/hooks/useSalesSupportData";

const statusPipeline = [
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { id: "qualified", label: "Qualified", color: "bg-purple-500" },
  { id: "proposal", label: "Proposal", color: "bg-pink-500" },
  { id: "negotiation", label: "Negotiation", color: "bg-orange-500" },
];

const getSourceIcon = (source: string) => {
  switch (source) {
    case "Call": return Phone;
    case "WhatsApp": return MessageCircle;
    case "Website": return Globe;
    default: return Globe;
  }
};

const LeadManagement = () => {
  const { data: leads, isLoading } = useLeads();
  const { data: members } = useTeamMembers();
  const insertLead = useInsertRow("sales_leads");
  const updateLead = useUpdateRow("sales_leads");
  const deleteLead = useDeleteRow("sales_leads");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    contact_name: "",
    company: "",
    email: "",
    phone: "",
    source: "",
    value: "",
  });

  const allLeads = leads ?? [];

  const filteredLeads = allLeads.filter((lead) => {
    const matchesSearch =
      lead.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.email ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "all" || lead.stage === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleAddLead = async () => {
    if (!form.contact_name || !form.company) {
      toast({ title: "Missing fields", description: "Name and company are required.", variant: "destructive" });
      return;
    }
    try {
      await insertLead.mutateAsync({
        contact_name: form.contact_name,
        company: form.company,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source || "Website",
        value: Number(form.value) || 0,
        stage: "new",
        urgency: "medium",
        qualified: false,
        reference: `LD-${Date.now()}`,
      });
      toast({ title: "Lead added", description: `${form.contact_name} has been added.` });
      setForm({ contact_name: "", company: "", email: "", phone: "", source: "", value: "" });
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Failed to add lead", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lead Management</h1>
          <p className="text-muted-foreground mt-1">Manage and track all your leads</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-blue-500 hover:bg-blue-600" size="lg">
              <Plus className="w-5 h-5" />
              Add New Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  placeholder="Enter lead name"
                  className="mt-1"
                  value={form.contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Company</Label>
                <Input
                  placeholder="Company name"
                  className="mt-1"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  className="mt-1"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  placeholder="+91 "
                  className="mt-1"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Call">Call</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Website">Website</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expected Value</Label>
                <Input
                  placeholder="0"
                  className="mt-1"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                />
              </div>
              <Button
                className="w-full bg-blue-500 hover:bg-blue-600"
                size="lg"
                onClick={handleAddLead}
                disabled={insertLead.isPending}
              >
                {insertLead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Lead"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statusPipeline.map((status, index) => (
          <motion.div
            key={status.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedStatus === status.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedStatus(selectedStatus === status.id ? "all" : status.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${status.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {allLeads.filter((l) => l.stage === status.id).length}
                    </p>
                    <p className="text-sm text-muted-foreground">{status.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search and Filter */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by name or email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusPipeline.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                More Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads List */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">All Leads ({filteredLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-6 text-center">Loading leads...</p>
          ) : filteredLeads.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">No leads found.</p>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead, index) => {
                const SourceIcon = getSourceIcon(lead.source);
                const statusInfo = statusPipeline.find(s => s.id === lead.stage);
                const owner = memberName(members, lead.assigned_to);

                return (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-surface hover:bg-surface-2 transition-colors cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-foreground font-bold text-lg">
                      {lead.contact_name.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{lead.contact_name}</p>
                        <Badge className={`${statusInfo?.color ?? "bg-muted/40"} text-foreground`}>
                          {statusInfo?.label ?? lead.stage}
                        </Badge>
                        {owner && <span className="text-xs text-muted-foreground">• {owner}</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        {lead.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
                      <SourceIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{lead.source}</span>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-foreground">{currency(lead.value)}</p>
                      <p className="text-xs text-muted-foreground">{relativeTime(lead.created_at)}</p>
                    </div>

                    <Select
                      value={lead.stage}
                      onValueChange={async (v) => {
                        try {
                          await updateLead.mutateAsync({ id: lead.id, values: { stage: v } });
                          toast({ title: "Lead updated" });
                        } catch (err) {
                          toast({ title: "Update failed", description: String(err), variant: "destructive" });
                        }
                      }}
                    >
                      <SelectTrigger className="w-32 h-8 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusPipeline.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await deleteLead.mutateAsync(lead.id);
                          toast({ title: "Lead removed" });
                        } catch (err) {
                          toast({ title: "Delete failed", description: String(err), variant: "destructive" });
                        }
                      }}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadManagement;
