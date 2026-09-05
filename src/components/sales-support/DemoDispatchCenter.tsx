import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Send, Link, Eye, Clock, Copy, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  useLeads,
  useTasks,
  useUpdateRow,
  useInsertRow,
  relativeTime,
} from "@/hooks/useSalesSupportData";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
    case "viewed":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "pending":
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "cancelled":
    case "expired":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    default:
      return "bg-muted/40 text-muted-foreground";
  }
};

const DemoDispatchCenter = () => {
  const { data: leads = [] } = useLeads();
  const { data: tasks = [] } = useTasks();
  const updateTask = useUpdateRow("crm_tasks");
  const insertTask = useInsertRow("crm_tasks");

  const [product, setProduct] = useState("");
  const [leadName, setLeadName] = useState("");

  const demoLeads = useMemo(() => leads.filter((l) => l.source === "demo_request"), [leads]);
  const demoTasks = useMemo(() => tasks.filter((t) => t.task_type === "meeting"), [tasks]);

  const recentDemos = useMemo(() => {
    return demoTasks.slice(0, 10).map((t) => {
      const lead = leads.find((l) => l.id === t.lead_id);
      return {
        id: t.id,
        reference: t.id.slice(0, 8).toUpperCase(),
        lead: lead?.company ?? t.title,
        product: t.description || "Product Demo",
        status: t.status,
        sent: relativeTime(t.created_at),
      };
    });
  }, [demoTasks, leads]);

  const totalDemos = demoTasks.length;
  const completed = demoTasks.filter((t) => t.status === "completed").length;
  const pending = demoTasks.filter((t) => t.status === "pending" || t.status === "scheduled").length;
  const viewRate = totalDemos > 0 ? Math.round((completed / totalDemos) * 100) : 0;
  const conversionRate = demoLeads.length > 0
    ? Math.round((demoLeads.filter((l) => l.stage?.toLowerCase().includes("closed") && l.stage?.toLowerCase().includes("won")).length / demoLeads.length) * 100)
    : 0;
  const staleDemos = demoTasks.filter((t) => {
    if (t.status === "completed" || !t.due_at) return false;
    const hours = (Date.now() - new Date(t.due_at).getTime()) / (1000 * 60 * 60);
    return hours > 48;
  });

  const handleGenerate = async () => {
    if (!product || !leadName) {
      toast.error("Select a product and enter a lead name first.");
      return;
    }
    const lead = leads.find((l) => l.company.toLowerCase() === leadName.toLowerCase());
    try {
      await insertTask.mutateAsync({
        title: `Demo: ${product}`,
        description: product,
        task_type: "meeting",
        status: "pending",
        priority: "medium",
        lead_id: lead?.id ?? null,
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      toast.success("Demo link generated and dispatch scheduled");
      setProduct("");
      setLeadName("");
    } catch {
      toast.error("Failed to generate demo link");
    }
  };

  const handleRemind = async (id: string) => {
    try {
      await updateTask.mutateAsync({ id, values: { status: "pending", due_at: new Date().toISOString() } });
      toast.success("Reminder sent");
    } catch {
      toast.error("Failed to send reminder");
    }
  };

  const handleBulkRemind = async () => {
    try {
      await Promise.all(
        staleDemos.map((t) => updateTask.mutateAsync({ id: t.id, values: { due_at: new Date().toISOString() } })),
      );
      toast.success(`Reminder sent for ${staleDemos.length} demo${staleDemos.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Failed to send bulk reminders");
    }
  };

  const generatedLink = product && leadName
    ? `https://demo.softwarevala.com/${product}?lead=${leadName.toLowerCase().replace(/\s+/g, "-")}`
    : "https://demo.softwarevala.com/select-product-and-lead";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Demo Dispatch Center</h2>
          <p className="text-muted-foreground">One-click demo sharing with tracking</p>
        </div>
        <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 text-foreground" onClick={handleGenerate}>
          <Send className="w-4 h-4 mr-2" />
          Send New Demo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Send className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{totalDemos}</div>
            <div className="text-xs text-muted-foreground">Demos Sent</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <Eye className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-100">{viewRate}%</div>
            <div className="text-xs text-muted-foreground">View Rate</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">{pending}</div>
            <div className="text-xs text-muted-foreground">Pending Demos</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{conversionRate}%</div>
            <div className="text-xs text-muted-foreground">Conversion Rate</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-card/60 border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-cyan-100 flex items-center gap-2">
                <Link className="w-5 h-5 text-cyan-400" />
                Quick Demo Link Generator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Select Product</label>
                  <Select value={product} onValueChange={setProduct}>
                    <SelectTrigger className="bg-card/60 border-border">
                      <SelectValue placeholder="Choose product..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pos-system">POS System</SelectItem>
                      <SelectItem value="hospital-management">Hospital Management</SelectItem>
                      <SelectItem value="school-erp">School ERP</SelectItem>
                      <SelectItem value="inventory-pro">Inventory Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Lead Name</label>
                  <Input
                    placeholder="Enter lead name..."
                    className="bg-card/60 border-border"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    list="demo-lead-companies"
                  />
                  <datalist id="demo-lead-companies">
                    {demoLeads.map((l) => (
                      <option key={l.id} value={l.company} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="p-4 bg-card/60 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Generated Link</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-cyan-400"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink);
                        toast.success("Link copied to clipboard");
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-cyan-400" onClick={() => window.open(generatedLink, "_blank")}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <code className="text-cyan-300 text-sm break-all">{generatedLink}</code>
              </div>

              <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-foreground" onClick={handleGenerate}>
                <Send className="w-4 h-4 mr-2" />
                Generate & Send Demo Link
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-cyan-500/20 mt-6">
            <CardHeader>
              <CardTitle className="text-cyan-100">Recent Demo Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentDemos.length === 0 && (
                  <p className="text-sm text-muted-foreground">No demo activity yet.</p>
                )}
                {recentDemos.map((demo, index) => (
                  <motion.div
                    key={demo.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 bg-card/60 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-cyan-400 text-sm">{demo.reference}</span>
                      <div>
                        <p className="text-cyan-100 font-medium">{demo.lead}</p>
                        <p className="text-xs text-muted-foreground">{demo.product}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge className={getStatusBadge(demo.status)}>{demo.status}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{demo.sent}</p>
                      </div>
                      {(demo.status === "pending" || demo.status === "scheduled") && (
                        <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-300" onClick={() => handleRemind(demo.id)}>
                          Remind
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card/60 border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-cyan-100 text-lg">Open Demo Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {demoLeads.length === 0 && (
                <p className="text-sm text-muted-foreground">No demo requests yet.</p>
              )}
              {demoLeads.slice(0, 5).map((lead, index) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-3 bg-card/60 rounded-lg hover:bg-card/60 transition-colors cursor-pointer"
                  onClick={() => setLeadName(lead.company)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-cyan-100">{lead.company}</span>
                    <Badge className="bg-emerald-500/20 text-emerald-300">{Math.round(lead.ai_win_probability * 100)}% match</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{lead.category ?? lead.stage}</span>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-900/30 to-red-900/30 border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <span className="font-medium text-amber-100">Follow-Up Required</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{staleDemos.length} demos haven't been viewed in 48+ hours</p>
              <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-foreground" onClick={handleBulkRemind} disabled={staleDemos.length === 0}>
                Send Bulk Reminder
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DemoDispatchCenter;
