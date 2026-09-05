import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Eye, Lock, Calendar } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

const ProductList = () => {
  const [viewingProduct, setViewingProduct] = useState<any>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_products")
        .select("id, name, industry_label, visible, price_label, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: demoCounts } = useQuery({
    queryKey: ["demo-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("product_demo_urls").select("id, product_id");
      return data || [];
    }
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-violet-400" />
            Product List
          </h1>
          <p className="text-slate-400 text-sm">Read-only view of all products</p>
        </div>
        <Badge variant="outline" className="border-amber-500/50 text-amber-400">
          <Lock className="w-3 h-3 mr-1" />
          No Edit / No Delete
        </Badge>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardContent className="p-0">
          <ScrollArea className="h-150">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50">
                  <TableHead className="text-slate-400">Product Name</TableHead>
                  <TableHead className="text-slate-400">Category</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Price</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-slate-400 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                      Loading products...
                    </TableCell>
                  </TableRow>
                ) : products?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  products?.map((product) => (
                    <TableRow key={product.id} className="border-slate-700/50">
                      <TableCell className="text-white font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-slate-300">{product.industry_label || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={product.visible ? "default" : "secondary"}
                          className={product.visible ? "bg-emerald-600" : "bg-slate-600"}
                        >
                          {product.visible ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {product.price_label || "-"}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {product.created_at ? format(new Date(product.created_at), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingProduct(product)}
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* View Product Dialog */}
      <Dialog open={!!viewingProduct} onOpenChange={() => setViewingProduct(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-violet-400" />
              Product Details (Read Only)
            </DialogTitle>
          </DialogHeader>
              {viewingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Product Name</p>
                  <p className="text-white font-medium">{viewingProduct.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Category</p>
                  <p className="text-white">{viewingProduct.industry_label || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <Badge className={viewingProduct.visible ? "bg-emerald-600" : "bg-slate-600"}>
                    {viewingProduct.visible ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Pricing Model</p>
                  <p className="text-white">Marketplace product</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Lifetime Price</p>
                  <p className="text-white">{viewingProduct.price_label || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Monthly Price</p>
                  <p className="text-white">-</p>
                </div>
              </div>
              {viewingProduct.description && (
                <div>
                  <p className="text-xs text-slate-400">Description</p>
                  <p className="text-slate-300 text-sm">{viewingProduct.description}</p>
                </div>
              )}
              <div className="p-3 bg-slate-800/50 rounded-lg flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <p className="text-xs text-amber-400">This record is immutable and cannot be modified</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductList;
