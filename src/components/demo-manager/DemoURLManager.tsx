import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Link2, 
  Copy, 
  ExternalLink, 
  Shield,
  Globe,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

interface DemoURL {
  id: string;
  demo: string;
  url: string;
  type: "public" | "private" | "reseller";
  accessMode: "open" | "prefilled" | "readonly";
  region: string;
  visits: number;
  created: string;
  expires: string | null;
  active: boolean;
}

const demoURLs: DemoURL[] = [
  { id: "1", demo: "E-Commerce Pro", url: "demo.softwarevala.com/ecommerce", type: "public", accessMode: "open", region: "Global", visits: 1234, created: "Jan 15, 2024", expires: null, active: true },
  { id: "2", demo: "Hospital Management", url: "demo.softwarevala.com/hospital", type: "public", accessMode: "prefilled", region: "India", visits: 856, created: "Feb 1, 2024", expires: null, active: true },
  { id: "3", demo: "School ERP", url: "demo.softwarevala.com/school", type: "public", accessMode: "readonly", region: "Global", visits: 2341, created: "Dec 10, 2023", expires: null, active: true },
  { id: "4", demo: "Banking Portal", url: "franchise-001.demo.softwarevala.com/bank", type: "reseller", accessMode: "prefilled", region: "UAE", visits: 456, created: "Mar 5, 2024", expires: "Jun 5, 2024", active: true },
  { id: "5", demo: "Real Estate Portal", url: "private.softwarevala.com/realestate-demo", type: "private", accessMode: "open", region: "USA", visits: 89, created: "Mar 10, 2024", expires: "Apr 10, 2024", active: true },
  { id: "6", demo: "Travel Booking", url: "demo.softwarevala.com/travel", type: "public", accessMode: "open", region: "Global", visits: 3456, created: "Nov 20, 2023", expires: null, active: true },
  { id: "7", demo: "Food Delivery", url: "demo.softwarevala.com/food", type: "public", accessMode: "prefilled", region: "India", visits: 5678, created: "Oct 5, 2023", expires: null, active: true },
  { id: "8", demo: "Gym Management", url: "franchise-002.demo.softwarevala.com/gym", type: "reseller", accessMode: "open", region: "Europe", visits: 234, created: "Mar 1, 2024", expires: "Sep 1, 2024", active: false },
];

const DemoURLManager = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredURLs = demoURLs.filter(url => 
    url.demo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    url.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyURL = (url: string) => {
    navigator.clipboard.writeText(`https://${url}`);
    toast({
      title: "URL Copied",
      description: "Demo URL has been copied to clipboard",
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "public": return "bg-neon-green/20 text-neon-green border-neon-green/50";
      case "private": return "bg-neon-purple/20 text-neon-purple border-neon-purple/50";
      case "reseller": return "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50";
      default: return "";
    }
  };

  const getAccessModeColor = (mode: string) => {
    switch (mode) {
      case "open": return "text-neon-green";
      case "prefilled": return "text-neon-cyan";
      case "readonly": return "text-neon-orange";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">Demo URL Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate, manage, and track secure demo URLs</p>
        </div>
        <Button className="command-button-primary">
          <Plus className="w-4 h-4 mr-2" />
          Generate New URL
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total URLs", value: "48", icon: Link2, color: "text-primary" },
          { label: "Active", value: "45", icon: Eye, color: "text-neon-green" },
          { label: "Total Visits", value: "24.5K", icon: Globe, color: "text-neon-cyan" },
          { label: "Expiring Soon", value: "3", icon: Clock, color: "text-neon-orange" },
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

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by demo name or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>
      </div>

      {/* URL Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-panel overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="font-mono">Demo</TableHead>
              <TableHead className="font-mono">URL</TableHead>
              <TableHead className="font-mono">Type</TableHead>
              <TableHead className="font-mono">Access</TableHead>
              <TableHead className="font-mono">Region</TableHead>
              <TableHead className="font-mono text-center">Visits</TableHead>
              <TableHead className="font-mono">Expires</TableHead>
              <TableHead className="font-mono text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredURLs.map((item) => (
              <TableRow key={item.id} className="border-border/30">
                <TableCell>
                  <div className="font-medium text-foreground">{item.demo}</div>
                  <div className="text-xs text-muted-foreground">Created {item.created}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-secondary/50 px-2 py-1 rounded font-mono text-primary">
                      {item.url}
                    </code>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getTypeColor(item.type)}>
                    {item.type === "private" && <Shield className="w-3 h-3 mr-1" />}
                    {item.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={`text-sm font-mono ${getAccessModeColor(item.accessMode)}`}>
                    {item.accessMode}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Globe className="w-3 h-3" />
                    {item.region}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono text-primary">{item.visits.toLocaleString()}</span>
                </TableCell>
                <TableCell>
                  {item.expires ? (
                    <span className="text-xs text-neon-orange">{item.expires}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyURL(item.url)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <QrCode className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      {item.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
};

export default DemoURLManager;
