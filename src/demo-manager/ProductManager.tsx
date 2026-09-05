import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, Edit, Trash2, Eye, Power, PowerOff, Package, Search, 
  Filter, RefreshCw, Link2, History, Loader2, CheckCircle, XCircle
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string;
  subcategories: { id: string; name: string }[];
}

interface Product {
  product_id: string;
  product_name: string;
  product_type: string;
  description: string;
  status: string;
  business_category_id: string;
  subcategory_id: string;
  created_at: string;
  category?: { id: string; name: string; icon: string };
  subcategory?: { id: string; name: string };
  demo_mappings?: { demo_id: string; demos: { id: string; title: string; url: string; status: string } }[];
}

interface Demo {
  id: string;
  title: string;
  url: string;
  status: string;
}

interface ProductManagerProps {
  viewOnly?: boolean;
}

export const ProductManager: React.FC<ProductManagerProps> = ({ viewOnly = false }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionLogs, setActionLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("products");

  const [formData, setFormData] = useState({
    name: "",
    product_type: "software",
    category_id: "",
    subcategory_id: "",
    description: "",
    demo_ids: [] as string[],
  });

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("business_categories")
      .select(`*, subcategories:business_subcategories(id, name)`)
      .eq("is_active", true)
      .order("display_order");
    if (data) setCategories(data as unknown as Category[]);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // First fetch products with categories (no demo join to avoid RLS issues)
      let query = supabase
        .from("products")
        .select(`
          *,
          category:business_categories(id, name, icon),
          subcategory:business_subcategories(id, name)
        `)
        .order("created_at", { ascending: false });

      if (filterCategory && filterCategory !== "all") query = query.eq("business_category_id", filterCategory);
      if (filterStatus && filterStatus !== "all") query = query.eq("status", filterStatus);
      if (search) query = query.ilike("product_name", `%${search}%`);

      const { data: productsData, error: productsError } = await query;
      if (productsError) throw productsError;

      // Fetch demo mappings separately to handle RLS gracefully
      const productIds = productsData?.map(p => p.product_id) || [];
      let demoMappings: Record<string, any[]> = {};
      
      if (productIds.length > 0) {
        const { data: mappingsData } = await supabase
          .from("product_demo_mappings")
          .select("product_id, demo_id")
          .in("product_id", productIds);
        
        if (mappingsData) {
          // Group mappings by product_id
          mappingsData.forEach((m: any) => {
            if (!demoMappings[m.product_id]) demoMappings[m.product_id] = [];
            demoMappings[m.product_id].push({ demo_id: m.demo_id, demos: null });
          });
        }
      }

      // Merge demo mappings into products
      const productsWithMappings = (productsData || []).map(p => ({
        ...p,
        demo_mappings: demoMappings[p.product_id] || []
      }));

      setProducts(productsWithMappings as unknown as Product[]);
    } catch (error: any) {
      toast.error("Failed to fetch products: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDemos = async () => {
    const { data } = await supabase
      .from("demos")
      .select("id, title, url, status")
      .eq("status", "active")
      .order("title");
    if (data) setDemos(data as Demo[]);
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("product_action_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setActionLogs(data);
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchDemos();
  }, [filterCategory, filterStatus, search]);

  useEffect(() => {
    if (activeTab === "logs") fetchLogs();
  }, [activeTab]);

  const handleCreate = async () => {
    if (!formData.name || !formData.category_id || !formData.subcategory_id) {
      toast.error("Name, category, and subcategory are required");
      return;
    }

    try {
      const { data: product, error } = await supabase
        .from("products")
        .insert({
          product_name: formData.name,
          product_type: formData.product_type,
          business_category_id: formData.category_id,
          subcategory_id: formData.subcategory_id,
          description: formData.description,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      // Link demos
      if (formData.demo_ids.length > 0) {
        await supabase.from("product_demo_mappings").insert(
          formData.demo_ids.map(demo_id => ({ product_id: product.product_id, demo_id }))
        );
      }

      // Log action
      await supabase.from("product_action_logs").insert({
        product_id: product.product_id,
        product_name: formData.name,
        action: "product_created",
        action_details: formData,
      });

      toast.success("Product created successfully");
      setShowAddDialog(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast.error("Failed to create product: " + error.message);
    }
  };

  const handleUpdate = async () => {
    if (!selectedProduct) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({
          product_name: formData.name,
          product_type: formData.product_type,
          business_category_id: formData.category_id,
          subcategory_id: formData.subcategory_id,
          description: formData.description,
        })
        .eq("product_id", selectedProduct.product_id);

      if (error) throw error;

      // Update demo mappings
      await supabase.from("product_demo_mappings").delete().eq("product_id", selectedProduct.product_id);
      if (formData.demo_ids.length > 0) {
        await supabase.from("product_demo_mappings").insert(
          formData.demo_ids.map(demo_id => ({ product_id: selectedProduct.product_id, demo_id }))
        );
      }

      await supabase.from("product_action_logs").insert({
        product_id: selectedProduct.product_id,
        product_name: formData.name,
        action: "product_updated",
        action_details: formData,
      });

      toast.success("Product updated successfully");
      setShowEditDialog(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast.error("Failed to update product: " + error.message);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.product_name}"?`)) return;

    try {
      await supabase.from("product_demo_mappings").delete().eq("product_id", product.product_id);
      const { error } = await supabase.from("products").delete().eq("product_id", product.product_id);
      if (error) throw error;

      await supabase.from("product_action_logs").insert({
        product_id: product.product_id,
        product_name: product.product_name,
        action: "product_deleted",
      });

      toast.success("Product deleted");
      fetchProducts();
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    const newStatus = product.status === "active" ? "inactive" : "active";
    try {
      await supabase.from("products").update({ status: newStatus }).eq("product_id", product.product_id);
      await supabase.from("product_action_logs").insert({
        product_id: product.product_id,
        product_name: product.product_name,
        action: `product_${newStatus === "active" ? "activated" : "deactivated"}`,
      });
      toast.success(`Product ${newStatus === "active" ? "activated" : "deactivated"}`);
      fetchProducts();
    } catch (error: any) {
      toast.error("Failed to update status");
    }
  };

  const resetForm = () => {
    setFormData({ name: "", product_type: "software", category_id: "", subcategory_id: "", description: "", demo_ids: [] });
    setSelectedProduct(null);
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.product_name,
      product_type: product.product_type || "software",
      category_id: product.business_category_id || "",
      subcategory_id: product.subcategory_id || "",
      description: product.description || "",
      demo_ids: product.demo_mappings?.map(m => m.demo_id) || [],
    });
    setShowEditDialog(true);
  };

  const selectedCategory = categories.find(c => c.id === formData.category_id);
  const subcategories = selectedCategory?.subcategories || [];

  const stats = {
    total: products.length,
    active: products.filter(p => p.status === "active").length,
    inactive: products.filter(p => p.status === "inactive").length,
    withDemos: products.filter(p => (p.demo_mappings?.length || 0) > 0).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Products", value: stats.total, icon: Package, color: "text-blue-500" },
          { label: "Active", value: stats.active, icon: CheckCircle, color: "text-green-500" },
          { label: "Inactive", value: stats.inactive, icon: XCircle, color: "text-red-500" },
          { label: "With Demos", value: stats.withDemos, icon: Link2, color: "text-purple-500" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
          <TabsTrigger value="logs">Action Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          {/* Toolbar */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchProducts}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {!viewOnly && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Input placeholder="Product Name *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                      <Select value={formData.product_type} onValueChange={v => setFormData({ ...formData, product_type: v })}>
                        <SelectTrigger><SelectValue placeholder="Product Type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="software">Software</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={formData.category_id} onValueChange={v => setFormData({ ...formData, category_id: v, subcategory_id: "" })}>
                        <SelectTrigger><SelectValue placeholder="Category *" /></SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Select value={formData.subcategory_id} onValueChange={v => setFormData({ ...formData, subcategory_id: v })} disabled={!formData.category_id}>
                      <SelectTrigger><SelectValue placeholder="Sub-category *" /></SelectTrigger>
                      <SelectContent>
                        {subcategories.map(sub => (
                          <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea placeholder="Description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    <div>
                      <p className="text-sm font-medium mb-2">Link Demos (Active only)</p>
                      <ScrollArea className="h-32 border rounded p-2">
                        {demos.map(demo => (
                          <label key={demo.id} className="flex items-center gap-2 py-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.demo_ids.includes(demo.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, demo_ids: [...formData.demo_ids, demo.id] });
                                } else {
                                  setFormData({ ...formData, demo_ids: formData.demo_ids.filter(id => id !== demo.id) });
                                }
                              }}
                            />
                            <span className="text-sm">{demo.title}</span>
                          </label>
                        ))}
                      </ScrollArea>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreate}>Create Product</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Products Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    {search || filterCategory || filterStatus
                      ? "No products match your search criteria. Try adjusting your filters."
                      : "Get started by adding your first product using the 'Add Product' button above."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Demos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(product => (
                      <TableRow key={product.product_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.product_name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.product_type || "software"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{product.category?.name || "-"}</p>
                            <p className="text-xs text-muted-foreground">{product.subcategory?.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{product.demo_mappings?.length || 0} linked</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.status === "active" ? "default" : "destructive"}>
                            {product.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)} title="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!viewOnly && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)} title="Edit">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(product)}>
                                  {product.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(product)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map(cat => (
              <Card key={cat.id} className="bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{cat.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">{cat.subcategories?.length || 0} subcategories</p>
                  <div className="flex flex-wrap gap-1">
                    {cat.subcategories?.slice(0, 3).map(sub => (
                      <Badge key={sub.id} variant="outline" className="text-xs">{sub.name}</Badge>
                    ))}
                    {(cat.subcategories?.length || 0) > 3 && (
                      <Badge variant="secondary" className="text-xs">+{cat.subcategories.length - 3}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell>{log.product_name}</TableCell>
                      <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{log.performer_role || "-"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input placeholder="Product Name *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Select value={formData.product_type} onValueChange={v => setFormData({ ...formData, product_type: v })}>
                <SelectTrigger><SelectValue placeholder="Product Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
              <Select value={formData.category_id} onValueChange={v => setFormData({ ...formData, category_id: v, subcategory_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Category *" /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={formData.subcategory_id} onValueChange={v => setFormData({ ...formData, subcategory_id: v })} disabled={!formData.category_id}>
              <SelectTrigger><SelectValue placeholder="Sub-category *" /></SelectTrigger>
              <SelectContent>
                {subcategories.map(sub => (
                  <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea placeholder="Description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            <div>
              <p className="text-sm font-medium mb-2">Link Demos</p>
              <ScrollArea className="h-32 border rounded p-2">
                {demos.map(demo => (
                  <label key={demo.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.demo_ids.includes(demo.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setFormData({ ...formData, demo_ids: [...formData.demo_ids, demo.id] });
                        } else {
                          setFormData({ ...formData, demo_ids: formData.demo_ids.filter(id => id !== demo.id) });
                        }
                      }}
                    />
                    <span className="text-sm">{demo.title}</span>
                  </label>
                ))}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Update Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductManager;
