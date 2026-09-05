import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { 
  Package, 
  Search, 
  Filter, 
  ExternalLink,
  Download,
  Smartphone,
  Monitor,
  Apple,
  Globe,
  Code,
  FileText,
  Image,
  Eye,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  stack: string;
  platforms: string[];
  rating: number;
  demos: number;
  downloads: number;
  hasAPK: boolean;
  hasWeb: boolean;
  hasIOS: boolean;
  thumbnail: string;
  featured: boolean;
}

const products: Product[] = [
  { id: "1", name: "E-Commerce Pro", category: "Retail", description: "Complete online store solution with inventory, payments, and analytics", stack: "React + Node.js + MongoDB", platforms: ["web", "mobile"], rating: 4.8, demos: 3, downloads: 1234, hasAPK: true, hasWeb: true, hasIOS: true, thumbnail: "🛒", featured: true },
  { id: "2", name: "Hospital Management", category: "Healthcare", description: "End-to-end hospital operations with patient records and billing", stack: "Java + Angular + MySQL", platforms: ["web"], rating: 4.7, demos: 2, downloads: 856, hasAPK: false, hasWeb: true, hasIOS: false, thumbnail: "🏥", featured: true },
  { id: "3", name: "School ERP", category: "Education", description: "Complete school management with attendance, grades, and communication", stack: "PHP + Vue.js + PostgreSQL", platforms: ["web", "mobile"], rating: 4.6, demos: 4, downloads: 2341, hasAPK: true, hasWeb: true, hasIOS: true, thumbnail: "🎓", featured: false },
  { id: "4", name: "Restaurant POS", category: "Food & Beverage", description: "Point of sale with table management and kitchen display", stack: "Flutter + Firebase", platforms: ["mobile", "tablet"], rating: 4.9, demos: 2, downloads: 567, hasAPK: true, hasWeb: false, hasIOS: true, thumbnail: "🍽️", featured: true },
  { id: "5", name: "Real Estate Portal", category: "Property", description: "Property listings with virtual tours and agent management", stack: "Next.js + MongoDB", platforms: ["web"], rating: 4.5, demos: 2, downloads: 432, hasAPK: false, hasWeb: true, hasIOS: false, thumbnail: "🏠", featured: false },
  { id: "6", name: "Banking Portal", category: "Finance", description: "Secure banking operations with transactions and account management", stack: ".NET + Angular + SQL Server", platforms: ["web", "mobile"], rating: 4.9, demos: 3, downloads: 789, hasAPK: true, hasWeb: true, hasIOS: true, thumbnail: "🏦", featured: true },
  { id: "7", name: "Travel Booking", category: "Tourism", description: "Complete travel booking with flights, hotels, and packages", stack: "Python + React + PostgreSQL", platforms: ["web", "mobile"], rating: 4.7, demos: 2, downloads: 1567, hasAPK: true, hasWeb: true, hasIOS: true, thumbnail: "✈️", featured: false },
  { id: "8", name: "Food Delivery", category: "Food & Beverage", description: "Food delivery platform with real-time tracking and payments", stack: "Flutter + Node.js", platforms: ["mobile"], rating: 4.8, demos: 2, downloads: 3456, hasAPK: true, hasWeb: false, hasIOS: true, thumbnail: "🍔", featured: true },
];

const DemoCatalog = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">Product Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1">Browse and manage all software products with demos</p>
        </div>
        <Badge className="bg-primary/20 text-primary border-primary/50 px-4 py-1">
          <Package className="w-4 h-4 mr-2" />
          40+ Products
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48 bg-secondary/50 border-border/50">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Retail">Retail</SelectItem>
            <SelectItem value="Healthcare">Healthcare</SelectItem>
            <SelectItem value="Education">Education</SelectItem>
            <SelectItem value="Finance">Finance</SelectItem>
            <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
            <SelectItem value="Property">Property</SelectItem>
            <SelectItem value="Tourism">Tourism</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-6">
        {filteredProducts.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass-panel p-5 hover:border-neon-teal/50 transition-all duration-300 group"
          >
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-secondary to-card flex items-center justify-center text-4xl flex-shrink-0">
                {product.thumbnail}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono font-semibold text-foreground">{product.name}</h3>
                      {product.featured && (
                        <Badge className="bg-neon-orange/20 text-neon-orange border-neon-orange/50 text-[10px]">
                          Featured
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{product.category}</div>
                  </div>
                  <div className="flex items-center gap-1 text-neon-orange">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="font-mono text-sm">{product.rating}</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{product.description}</p>

                {/* Tech Stack */}
                <div className="flex items-center gap-2 mb-3">
                  <Code className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-mono text-primary">{product.stack}</span>
                </div>

                {/* Platform Availability */}
                <div className="flex items-center gap-3 mb-3">
                  {product.hasWeb && (
                    <div className="flex items-center gap-1 text-xs text-neon-cyan">
                      <Monitor className="w-3 h-3" />
                      Web
                    </div>
                  )}
                  {product.hasAPK && (
                    <div className="flex items-center gap-1 text-xs text-neon-green">
                      <Smartphone className="w-3 h-3" />
                      Android
                    </div>
                  )}
                  {product.hasIOS && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Apple className="w-3 h-3" />
                      iOS
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {product.demos} demos
                  </span>
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {product.downloads.toLocaleString()} downloads
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/30">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info(`Viewing ${product.name} demo`)}>
                <Eye className="w-3 h-3 mr-2" />
                View Demo
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info(`Opening ${product.name} documentation`)}>
                <FileText className="w-3 h-3 mr-2" />
                Docs
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info(`Loading ${product.name} screenshots`)}>
                <Image className="w-3 h-3 mr-2" />
                Screenshots
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.open('#', '_blank')}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DemoCatalog;
