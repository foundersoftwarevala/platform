import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  createManagedDemo,
  deleteManagedDemo,
  listDemoCategories,
  listManagedDemos,
  setManagedDemoStatus,
  updateManagedDemo,
} from "@/lib/demo-manager/demos.functions";
import { recordAuditEvent } from "@/lib/audit.server";
import {
  Plus,
  Edit,
  Trash2,
  Monitor,
  Link,
  Code,
  Shield,
  Clock,
  Users,
  Search,
  MoreVertical,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Demo {
  id: string;
  title: string;
  category: string;
  url: string;
  login_url: string | null;
  demo_type: string;
  status: string;
  description: string | null;
  created_at: string;
}

type DemoType = "web" | "mobile" | "desktop" | "api";
const isDemoType = (value: string): value is DemoType =>
  ["web", "mobile", "desktop", "api"].includes(value);

const DemoAddEdit = () => {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDemo, setEditingDemo] = useState<Demo | null>(null);
  const [demoToDelete, setDemoToDelete] = useState<Demo | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    category: string;
    url: string;
    login_url: string;
    demo_type: DemoType;
    description: string;
  }>({
    title: "",
    category: "",
    url: "",
    login_url: "",
    demo_type: "web",
    description: "",
  });

  /**
   * The categories a demo may be filed under, read from demo_categories.
   *
   * This list used to be eight names written into this file - Business, Retail,
   * HR, Logistics, Finance, Healthcare, Education, Real Estate - while the
   * marketplace carries ninety. Eighty-two of them could not be chosen at all,
   * so a demo could not be filed under the category of the card it belongs to.
   * demo_categories is seeded from marketplace_categories, so the two lists are
   * the same list.
   */
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const demoTypes: DemoType[] = ["web", "mobile", "desktop", "api"];

  const auditDemoAction = (
    action: string,
    demoId: string | null,
    success: boolean,
    error?: string,
  ) => {
    void recordAuditEvent({
      data: {
        action,
        entityType: "demos",
        entityId: demoId,
        severity: success ? "info" : "warning",
        metadata: { success, error: error ?? null, timestamp: new Date().toISOString() },
      },
    }).catch((auditError) => {
      console.error(`[Demo Manager] audit log for ${action} failed:`, auditError);
    });
  };

  useEffect(() => {
    fetchDemos();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Read through the server: the browser client talks to hosted Supabase,
      // where demo_categories is empty, while the ninety categories are on the
      // VPS with the rest of the platform's data.
      try {
        const rows = await listDemoCategories();
        if (cancelled) return;
        setCategoriesError(null);
        setCategories(rows.map((row) => String(row.name)).filter(Boolean));
      } catch (problem) {
        if (cancelled) return;
        // Said out loud rather than silently falling back to a short list: an
        // empty dropdown that looks deliberate is how this went unnoticed.
        setCategoriesError(problem instanceof Error ? problem.message : "unknown error");
        setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchDemos = async () => {
    setLoading(true);
    try {
      const rows = await listManagedDemos({ data: { limit: 1000 } });
      setDemos(rows);
    } catch (err) {
      console.error("Error fetching demos:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load demos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.url || !formData.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    setActionLoading(true);
    try {
      const demo = {
        title: formData.title,
        category: formData.category,
        url: formData.url,
        login_url: formData.login_url,
        demo_type: formData.demo_type,
        description: formData.description,
      };
      if (editingDemo) {
        await updateManagedDemo({ data: { id: editingDemo.id, demo } });
        auditDemoAction("update", editingDemo.id, true);
        toast.success(`${formData.title} has been updated`);
      } else {
        const created = await createManagedDemo({ data: demo });
        auditDemoAction("insert", created.id, true);
        toast.success(`${formData.title} has been added`);
      }

      setIsDialogOpen(false);
      resetForm();
      await fetchDemos();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Demo could not be saved.";
      auditDemoAction(editingDemo ? "update" : "insert", editingDemo?.id ?? null, false, message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!demoToDelete) return;

    setActionLoading(true);
    try {
      await deleteManagedDemo({ data: { id: demoToDelete.id } });
      auditDemoAction("delete", demoToDelete.id, true);
      toast.success(`${demoToDelete.title} has been removed`);
      await fetchDemos();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Demo could not be deleted.";
      auditDemoAction("delete", demoToDelete.id, false, message);
      toast.error(message);
    } finally {
      setActionLoading(false);
      setDeleteDialogOpen(false);
      setDemoToDelete(null);
    }
  };

  const handleEdit = (demo: Demo) => {
    setEditingDemo(demo);
    setFormData({
      title: demo.title || "",
      category: demo.category || "",
      url: demo.url || "",
      login_url: demo.login_url || "",
      demo_type: isDemoType(demo.demo_type) ? demo.demo_type : "web",
      description: demo.description || "",
    });
    setIsDialogOpen(true);
  };

  const confirmDelete = (demo: Demo) => {
    setDemoToDelete(demo);
    setDeleteDialogOpen(true);
  };

  const handleToggleStatus = async (demo: Demo) => {
    const status = demo.status === "active" ? "maintenance" : "active";
    try {
      await setManagedDemoStatus({ data: { id: demo.id, status } });
      auditDemoAction("update status", demo.id, true);
      await fetchDemos();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Demo status could not be changed.";
      auditDemoAction("update status", demo.id, false, message);
      toast.error(message);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      category: "",
      url: "",
      login_url: "",
      demo_type: "web",
      description: "",
    });
    setEditingDemo(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-neon-green/20 text-neon-green border-neon-green/30";
      case "maintenance":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "down":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const filteredDemos = demos.filter(
    (demo) =>
      demo.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      demo.category?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demo Management</h1>
          <p className="text-muted-foreground">Add, edit, and manage demo configurations</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add New Demo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingDemo ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingDemo ? "Edit Demo" : "Add New Demo"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Demo Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter demo title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue
                        placeholder={
                          categoriesError
                            ? "Categories could not be loaded"
                            : categories.length === 0
                              ? "Loading categories…"
                              : `Select category (${categories.length})`
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {categoriesError && (
                    <p role="alert" className="text-xs text-destructive">
                      Categories could not be loaded: {categoriesError}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">Demo URL *</Label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="url"
                    placeholder="https://demo.example.com"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="bg-background border-border pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="login_url">Login URL</Label>
                  <Input
                    id="login_url"
                    placeholder="https://demo.example.com/login"
                    value={formData.login_url}
                    onChange={(e) => setFormData({ ...formData, login_url: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo_type">Demo Type</Label>
                  <Select
                    value={formData.demo_type}
                    onValueChange={(value) => {
                      if (isDemoType(value)) {
                        setFormData({ ...formData, demo_type: value });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {demoTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter demo description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-background border-border min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={actionLoading}
                  className="bg-primary hover:bg-primary/90"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {editingDemo ? "Update Demo" : "Add Demo"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search demos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background/50 border-border"
          />
        </div>
        <Button variant="outline" onClick={fetchDemos} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {/* Demo List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredDemos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No demos found. Add your first demo!
          </div>
        ) : (
          filteredDemos.map((demo, index) => (
            <motion.div
              key={demo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="glass-card border-border/50 hover:border-primary/50 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Monitor className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{demo.title}</h3>
                          <Badge className={getStatusBadge(demo.status)}>{demo.status}</Badge>
                          <Badge variant="outline">{demo.demo_type?.toUpperCase()}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {demo.category} • {demo.description}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Link className="w-3 h-3" />
                            {demo.url?.slice(0, 40)}...
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border"
                        onClick={() => window.open(demo.url, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="border-border">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(demo)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Demo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(demo)}>
                            <Shield className="w-4 h-4 mr-2" />
                            {demo.status === "active" ? "Set Maintenance" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => confirmDelete(demo)}
                            className="text-red-400 focus:text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove Demo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Demo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{demoToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DemoAddEdit;
