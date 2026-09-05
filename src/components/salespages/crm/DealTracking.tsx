import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  MoreVertical,
  Building,
  User,
  Clock,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  useDeals,
  useCustomers,
  useTeamMembers,
  useInsertRow,
  useUpdateRow,
  memberName,
  currency,
} from "@/hooks/useSalesSupportData";

const stages = [
  { id: "discovery", label: "Discovery", color: "bg-blue-500" },
  { id: "proposal", label: "Proposal", color: "bg-purple-500" },
  { id: "negotiation", label: "Negotiation", color: "bg-orange-500" },
  { id: "closed", label: "Closed Won", color: "bg-green-500" },
];

const daysLeftFor = (dateStr: string | null) => {
  if (!dateStr) return 0;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const DealTracking = () => {
  const { data: deals, isLoading } = useDeals();
  const { data: customers } = useCustomers();
  const { data: members } = useTeamMembers();
  const insertDeal = useInsertRow("sales_deals");
  const updateDeal = useUpdateRow("sales_deals");

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", customer_id: "", value: "", expected_close_date: "", stage: "discovery" });

  const allDeals = deals ?? [];

  const customerFor = (id: string | null) => (customers ?? []).find(c => c.id === id);

  const searchedDeals = allDeals.filter(d => {
    const c = customerFor(d.customer_id);
    return (
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c?.company_name ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getStageDeals = (stageId: string) => searchedDeals.filter(d => d.stage === stageId);
  const getStageTotal = (stageId: string) => getStageDeals(stageId).reduce((sum, d) => sum + Number(d.value ?? 0), 0);

  const handleCreateDeal = async () => {
    if (!form.title) {
      toast({ title: "Missing fields", description: "Deal name is required.", variant: "destructive" });
      return;
    }
    try {
      await insertDeal.mutateAsync({
        title: form.title,
        customer_id: form.customer_id || null,
        value: Number(form.value) || 0,
        expected_close_date: form.expected_close_date || null,
        stage: form.stage,
        probability: 20,
        reference: `DL-${Date.now()}`,
      });
      toast({ title: "Deal created", description: `${form.title} was added to the pipeline.` });
      setForm({ title: "", customer_id: "", value: "", expected_close_date: "", stage: "discovery" });
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Failed to create deal", description: String(err), variant: "destructive" });
    }
  };

  const moveStage = async (id: string, stage: string) => {
    try {
      await updateDeal.mutateAsync({ id, values: { stage } });
      toast({ title: "Deal stage updated" });
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deal Tracking</h1>
          <p className="text-muted-foreground mt-1">Track and manage your sales deals</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-surface-2 rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-card shadow-sm' : ''}
            >
              List
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className={viewMode === 'kanban' ? 'bg-card shadow-sm' : ''}
            >
              Kanban
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-blue-500 hover:bg-blue-600" size="lg">
                <Plus className="w-5 h-5" />
                New Deal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Deal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Deal Name</Label>
                  <Input placeholder="Enter deal name" className="mt-1" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <Label>Company</Label>
                  <Select value={form.customer_id} onValueChange={(v) => setForm(f => ({ ...f, customer_id: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(customers ?? []).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Deal Value</Label>
                  <Input placeholder="0" className="mt-1" value={form.value} onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))} />
                </div>
                <div>
                  <Label>Expected Close Date</Label>
                  <Input type="date" className="mt-1" value={form.expected_close_date} onChange={(e) => setForm(f => ({ ...f, expected_close_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Stage</Label>
                  <Select value={form.stage} onValueChange={(v) => setForm(f => ({ ...f, stage: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full bg-blue-500 hover:bg-blue-600" size="lg" onClick={handleCreateDeal} disabled={insertDeal.isPending}>
                  {insertDeal.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Deal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stages.map((stage, index) => (
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                  <span className="text-sm font-medium text-muted-foreground">{stage.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{getStageDeals(stage.id).length}</p>
                <p className="text-sm text-muted-foreground">{currency(getStageTotal(stage.id))}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm py-6 text-center">Loading deals...</p>
      ) : viewMode === 'list' ? (
        /* List View */
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">All Deals</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search deals..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {searchedDeals.length === 0 ? (
              <p className="text-muted-foreground text-sm py-6 text-center">No deals found.</p>
            ) : (
              <div className="space-y-3">
                {searchedDeals.map((deal, index) => {
                  const stageInfo = stages.find(s => s.id === deal.stage);
                  const customer = customerFor(deal.customer_id);
                  const owner = memberName(members, deal.owner_id);
                  const daysLeft = daysLeftFor(deal.expected_close_date);
                  return (
                    <motion.div
                      key={deal.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 p-4 rounded-xl bg-surface hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      <div className={`w-1 h-16 rounded-full ${stageInfo?.color ?? "bg-muted/40"}`} />

                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{deal.title}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {customer?.company_name ?? "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {owner ?? customer?.contact_name ?? "—"}
                          </span>
                        </div>
                      </div>

                      <div className="w-32">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Probability</span>
                          <span className="font-medium text-foreground">{deal.probability}%</span>
                        </div>
                        <Progress value={deal.probability} className="h-2" />
                      </div>

                      <Select value={deal.stage} onValueChange={(v) => moveStage(deal.id, v)}>
                        <SelectTrigger className="w-36 h-8" onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="text-right">
                        <p className="font-bold text-foreground">{currency(deal.value)}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {deal.stage !== 'closed' ? (daysLeft > 0 ? `${daysLeft} days left` : 'Due') : 'Closed'}
                        </p>
                      </div>

                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Kanban View */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stages.map((stage) => (
            <Card key={stage.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                    <span className="font-medium text-foreground">{stage.label}</span>
                  </div>
                  <Badge variant="outline">{getStageDeals(stage.id).length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {getStageDeals(stage.id).map((deal) => {
                  const customer = customerFor(deal.customer_id);
                  return (
                    <motion.div
                      key={deal.id}
                      whileHover={{ scale: 1.02 }}
                      className="p-4 rounded-xl bg-card border border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <p className="font-medium text-foreground text-sm">{deal.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{customer?.company_name ?? "—"}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-bold text-blue-600">{currency(deal.value)}</span>
                        <span className="text-xs text-muted-foreground">{deal.probability}%</span>
                      </div>
                      <Progress value={deal.probability} className="h-1.5 mt-2" />
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DealTracking;
