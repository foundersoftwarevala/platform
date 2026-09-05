import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
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
  Loader2
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
import { supabase } from "@/integrations/supabase/client";
import { apiService } from "@/lib/api/apiService";

interface Demo {
  id: string;
  title: string;
  category: string;
  url: string;
  login_url: string;
  demo_type: string;
  status: string;
  description: string;
  created_at: string;
}

const DemoAddEdit = () => {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDemo, setEditingDemo] = useState<Demo | null>(null);
  const [demoToDelete, setDemoToDelete] = useState<Demo | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    url: "",
    login_url: "",
    demo_type: "web",
    description: "",
  });

  const categories = ["Business", "Retail", "HR", "Logistics", "Finance", "Healthcare", "Education", "Real Estate"];
  const demoTypes = ["web", "mobile", "desktop", "api"];

  useEffect(() => {
    fetchDemos();
  }, []);

  const fetchDemos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('demos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDemos((data ?? []) as unknown as Demo[]);
    } catch (err: any) {
      console.error('Error fetching demos:', err);
      toast.error('Failed to load demos');
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
      if (editingDemo) {
        // Update existing demo
        const result = await apiService.updateDemo(editingDemo.id, {
          title: formData.title,
          category: formData.category,
          url: formData.url,
          login_url: formData.login_url,
          demo_type: formData.demo_type,
          description: formData.description,
        });
        
        if (result.success) {
          toast.success(`${formData.title} has been updated`);
        }
      } else {
        // Create new demo
        const result = await apiService.createDemo({
          title: formData.title,
          category: formData.category,
          url: formData.url,
          login_url: formData.login_url,
          demo_type: formData.demo_type,
          description: formData.description,
        });
        
        if (result.success) {
          toast.success(`${formData.title} has been added`);
        }
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchDemos();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!demoToDelete) return;

    setActionLoading(true);
    try {
      const result = await apiService.deleteDemo(demoToDelete.id);
      if (result.success) {
        toast.success(`${demoToDelete.title} has been removed`);
        fetchDemos();
      }
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
      demo_type: demo.demo_type || "web",
      description: demo.description || "",
    });
    setIsDialogOpen(true);
  };

  const confirmDelete = (demo: Demo) => {
    setDemoToDelete(demo);
    setDeleteDialogOpen(true);
  };

  const handleToggleStatus = async (demo: Demo) => {
    const isActive = demo.status === 'active';
    const result = await apiService.toggleDemoStatus(demo.id, !isActive);
    if (result.success) {
      fetchDemos();
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
      case "active": return "bg-neon-green/20 text-neon-green border-neon-green/30";
      case "maintenance": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "down": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const filteredDemos = demos.filter(demo =>
    demo.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    demo.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demo Management</h1>
          <p className="text-muted-foreground">Add, edit, and manage demo configurations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
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
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select value={formData.demo_type} onValueChange={(v) => setFormData({ ...formData, demo_type: v })}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {demoTypes.map(type => (
                        <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>
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
                <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={actionLoading} className="bg-primary hover:bg-primary/90">
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
                        <p className="text-sm text-muted-foreground">{demo.category} • {demo.description}</p>
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
                        onClick={() => window.open(demo.url, '_blank')}
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
                            {demo.status === 'active' ? 'Set Maintenance' : 'Activate'}
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
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
