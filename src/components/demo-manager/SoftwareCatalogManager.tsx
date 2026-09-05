import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, 
  Search, 
  Upload, 
  Trash2, 
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  Filter,
  Link2,
  ExternalLink,
  ArrowRight,
  FileSpreadsheet,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SoftwareItem {
  id: string;
  name: string;
  base_price: number;
  type: string;
  vendor: string;
  category: string;
  demo_url: string;
  is_demo_registered: boolean;
  created_at: string;
}

interface ImportStats {
  total: number;
  imported: number;
  failed: number;
}

const TYPES = ["All", "SaaS", "Desktop", "Mobile", "Offline", "Hybrid"];
const CATEGORIES = [
  "All", "Finance", "Healthcare", "Education", "Hotel/Travel", "Restaurant",
  "E-Commerce", "POS", "CRM", "HRM", "ERP", "Real Estate", "Logistics",
  "Inventory", "Project Management", "Fitness", "Events", "Lending",
  "Insurance", "Manufacturing", "Automotive", "Beauty/Salon", "Library",
  "Subscription", "General"
];

interface TypeStats {
  saas: number;
  desktop: number;
  mobile: number;
  hybrid: number;
  offline: number;
}

const SoftwareCatalogManager = () => {
  const [catalogItems, setCatalogItems] = useState<SoftwareItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [totalCount, setTotalCount] = useState(0);
  const [typeStats, setTypeStats] = useState<TypeStats>({ saas: 0, desktop: 0, mobile: 0, hybrid: 0, offline: 0 });
  const [registeredCount, setRegisteredCount] = useState(0);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    fetchCatalog();
    fetchTotalCount();
    fetchTypeStats();
  }, [page, typeFilter, categoryFilter]);

  const fetchTypeStats = async () => {
    try {
      // Fetch counts for each type
      const { count: saas } = await supabase.from('software_catalog').select('id', { count: 'exact', head: true }).eq('type', 'SaaS');
      const { count: desktop } = await supabase.from('software_catalog').select('id', { count: 'exact', head: true }).eq('type', 'Desktop');
      const { count: mobile } = await supabase.from('software_catalog').select('id', { count: 'exact', head: true }).eq('type', 'Mobile');
      const { count: hybrid } = await supabase.from('software_catalog').select('id', { count: 'exact', head: true }).eq('type', 'Hybrid');
      const { count: offline } = await supabase.from('software_catalog').select('id', { count: 'exact', head: true }).eq('type', 'Offline');
      const { count: registered } = await supabase.from('software_catalog').select('id', { count: 'exact', head: true }).eq('is_demo_registered', true);
      
      setTypeStats({
        saas: saas || 0,
        desktop: desktop || 0,
        mobile: mobile || 0,
        hybrid: hybrid || 0,
        offline: offline || 0
      });
      setRegisteredCount(registered || 0);
    } catch (error) {
      console.error('Error fetching type stats:', error);
    }
  };

  const fetchTotalCount = async () => {
    let query = supabase
      .from('software_catalog')
      .select('id', { count: 'exact', head: true });

    if (typeFilter !== "All") {
      query = query.eq('type', typeFilter);
    }
    if (categoryFilter !== "All") {
      query = query.eq('category', categoryFilter);
    }

    const { count } = await query;
    setTotalCount(count || 0);
  };

  const fetchCatalog = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('software_catalog')
        .select('*')
        .order('name', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (typeFilter !== "All") {
        query = query.eq('type', typeFilter);
      }
      if (categoryFilter !== "All") {
        query = query.eq('category', categoryFilter);
      }
      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCatalogItems((data ?? []) as unknown as SoftwareItem[]);
    } catch (error) {
      console.error('Error fetching catalog:', error);
      toast({ title: "Error", description: "Failed to load catalog", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({ title: "Error", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    setImportProgress(10);

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      setImportProgress(20);

      // Parse CSV
      const csvData: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');
        const item: Record<string, string> = {};
        headers.forEach((header, index) => {
          item[header] = values[index]?.trim() || '';
        });

        if (item.name) {
          csvData.push(item);
        }
      }

      setImportProgress(40);
      console.log(`Parsed ${csvData.length} items from CSV`);

      // Send to edge function
      const { data, error } = await supabase.functions.invoke('import-software-catalog', {
        body: { csvData }
      });

      setImportProgress(90);

      if (error) throw error;

      if (data.success) {
        setImportStats({
          total: data.total,
          imported: data.imported,
          failed: data.failed
        });
        toast({
          title: "Import Complete",
          description: data.message,
        });
        fetchCatalog();
        fetchTotalCount();
        fetchTypeStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import CSV",
        variant: "destructive"
      });
    } finally {
      setImportProgress(100);
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
      }, 1000);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearCatalog = async () => {
    if (!confirm("Are you sure you want to clear the entire software catalog? This cannot be undone.")) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('import-software-catalog', {
        body: { action: 'clear' }
      });

      if (error) throw error;

      toast({ title: "Cleared", description: "Software catalog has been cleared" });
      setCatalogItems([]);
      setTotalCount(0);
      setImportStats(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clear catalog",
        variant: "destructive"
      });
    }
  };

  const loadSampleData = async () => {
    setIsImporting(true);
    setImportProgress(5);
    
    try {
      toast({
        title: "Loading CSV...",
        description: "Fetching software catalog data...",
      });

      // Fetch the pre-uploaded CSV file
      const response = await fetch('/data/software-list.csv');
      if (!response.ok) {
        throw new Error(`Failed to load sample data file: ${response.status} ${response.statusText}`);
      }
      
      const text = await response.text();
      console.log('CSV file loaded, size:', text.length, 'bytes');
      
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      console.log('CSV headers:', headers);

      setImportProgress(15);

      // Parse CSV
      const csvData: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');
        const item: Record<string, string> = {};
        headers.forEach((header, index) => {
          item[header] = values[index]?.trim() || '';
        });

        if (item.name) {
          csvData.push(item);
        }
      }

      setImportProgress(30);
      console.log(`Parsed ${csvData.length} items from sample CSV`);

      toast({
        title: "Uploading to Database...",
        description: `Importing ${csvData.length.toLocaleString()} software products...`,
      });

      // Send to edge function
      console.log('Calling import-software-catalog edge function...');
      const { data, error } = await supabase.functions.invoke('import-software-catalog', {
        body: { csvData }
      });

      console.log('Edge function response:', data, error);

      setImportProgress(90);

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Edge function failed');
      }

      if (data?.success) {
        setImportStats({
          total: data.total,
          imported: data.imported,
          failed: data.failed
        });
        toast({
          title: "Import Complete!",
          description: `Successfully imported ${data.imported.toLocaleString()} of ${data.total.toLocaleString()} software products!`,
        });
        if (data.errors && data.errors.length > 0) {
          console.warn('Import errors:', data.errors);
        }
        fetchCatalog();
        fetchTotalCount();
        fetchTypeStats();
      } else {
        throw new Error(data?.error || 'Import returned unsuccessful');
      }
    } catch (error: any) {
      console.error('Load sample data error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to load sample data. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setImportProgress(100);
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
      }, 1500);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SaaS': return 'bg-neon-teal/20 text-neon-teal border-neon-teal/50';
      case 'Desktop': return 'bg-neon-purple/20 text-neon-purple border-neon-purple/50';
      case 'Mobile': return 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50';
      case 'Offline': return 'bg-muted text-muted-foreground border-muted';
      case 'Hybrid': return 'bg-neon-green/20 text-neon-green border-neon-green/50';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredItems = catalogItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">Software Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Master list of {totalCount.toLocaleString()} software products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button 
            variant="default"
            onClick={loadSampleData}
            disabled={isImporting}
            className="bg-gradient-to-r from-neon-green to-neon-teal text-black font-bold px-6 hover:opacity-90 shadow-lg shadow-neon-green/30 animate-pulse"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {totalCount > 0 ? 'Reload 5000+ Software' : 'Load 5000+ Software'}
          </Button>
          <Button 
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="border-primary/50"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Import CSV
          </Button>
          <Button 
            variant="outline"
            onClick={clearCatalog}
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Import Progress */}
      <AnimatePresence>
        {isImporting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="glass-panel border-primary/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Importing software catalog...</p>
                    <Progress value={importProgress} className="mt-2 h-2" />
                  </div>
                  <span className="text-sm text-muted-foreground">{importProgress}%</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Stats */}
      {importStats && (
        <Card className="glass-panel border-neon-green/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-6">
              <CheckCircle2 className="w-8 h-8 text-neon-green" />
              <div className="flex-1 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-mono font-bold text-foreground">{importStats.total.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Entries</div>
                </div>
                <div>
                  <div className="text-2xl font-mono font-bold text-neon-green">{importStats.imported.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Imported</div>
                </div>
                <div>
                  <div className="text-2xl font-mono font-bold text-destructive">{importStats.failed.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setImportStats(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Products", value: totalCount.toLocaleString(), icon: Package, color: "text-primary" },
          { label: "SaaS", value: typeStats.saas.toLocaleString(), icon: Database, color: "text-neon-teal" },
          { label: "Registered", value: registeredCount.toLocaleString(), icon: CheckCircle2, color: "text-neon-green" },
          { label: "Pending", value: (totalCount - registeredCount).toLocaleString(), icon: AlertCircle, color: "text-neon-orange" },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-panel p-4"
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <div className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search software..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCatalog()}
            className="pl-10 bg-secondary/50"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-32 bg-secondary/50">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40 bg-secondary/50">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchCatalog}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Table */}
      <Card className="glass-panel border-border/30">
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="font-mono">Software Name</TableHead>
                  <TableHead className="font-mono">Type</TableHead>
                  <TableHead className="font-mono">Category</TableHead>
                  <TableHead className="font-mono text-right">Price</TableHead>
                  <TableHead className="font-mono text-center">Status</TableHead>
                  <TableHead className="font-mono text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No software entries found</p>
                      <p className="text-xs mt-1">Import a CSV to populate the catalog</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} className="border-border/30">
                      <TableCell>
                        <div className="font-medium text-foreground">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.vendor}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(item.type)}>{item.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{item.category || 'General'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-primary">
                          ${item.base_price.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.is_demo_registered ? (
                          <Badge className="bg-neon-green/20 text-neon-green border-neon-green/50">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Registered
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Not Registered
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-7 text-xs text-primary"
                        >
                          <Link2 className="w-3 h-3 mr-1" />
                          Add Demo URL
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between p-4 border-t border-border/30">
              <span className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} of {totalCount.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={(page + 1) * pageSize >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SoftwareCatalogManager;
