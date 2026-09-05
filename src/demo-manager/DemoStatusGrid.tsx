import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Monitor, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Play,
  Pause,
  RefreshCw,
  ExternalLink,
  Globe,
  Smartphone,
  Tablet,
  Eye,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Demo {
  id: string;
  name: string;
  category: string;
  stack: string;
  status: "active" | "maintenance" | "offline";
  uptime: string;
  visitors: number;
  loadTime: string;
  lastCheck: string;
  platforms: string[];
  region: string;
  thumbnail: string;
}

const demos: Demo[] = [
  { id: "1", name: "E-Commerce Pro", category: "Retail", stack: "React + Node", status: "active", uptime: "99.99%", visitors: 234, loadTime: "1.1s", lastCheck: "2 min ago", platforms: ["web", "mobile"], region: "Global", thumbnail: "🛒" },
  { id: "2", name: "Hospital Management", category: "Healthcare", stack: "Java + Angular", status: "active", uptime: "99.95%", visitors: 156, loadTime: "1.3s", lastCheck: "1 min ago", platforms: ["web"], region: "India", thumbnail: "🏥" },
  { id: "3", name: "School ERP", category: "Education", stack: "PHP + Vue", status: "active", uptime: "99.90%", visitors: 189, loadTime: "1.5s", lastCheck: "3 min ago", platforms: ["web", "mobile"], region: "Global", thumbnail: "🎓" },
  { id: "4", name: "Restaurant POS", category: "Food & Beverage", stack: "Flutter + Firebase", status: "maintenance", uptime: "98.50%", visitors: 0, loadTime: "-", lastCheck: "Updating", platforms: ["mobile", "tablet"], region: "USA", thumbnail: "🍽️" },
  { id: "5", name: "Real Estate Portal", category: "Property", stack: "Next.js + MongoDB", status: "active", uptime: "99.97%", visitors: 312, loadTime: "0.9s", lastCheck: "1 min ago", platforms: ["web"], region: "UAE", thumbnail: "🏠" },
  { id: "6", name: "Gym Management", category: "Fitness", stack: "React Native", status: "active", uptime: "99.88%", visitors: 87, loadTime: "1.4s", lastCheck: "2 min ago", platforms: ["mobile"], region: "Europe", thumbnail: "💪" },
  { id: "7", name: "Travel Booking", category: "Tourism", stack: "Python + React", status: "active", uptime: "99.92%", visitors: 445, loadTime: "1.2s", lastCheck: "1 min ago", platforms: ["web", "mobile"], region: "Global", thumbnail: "✈️" },
  { id: "8", name: "Inventory System", category: "Logistics", stack: "Java + Spring", status: "offline", uptime: "0%", visitors: 0, loadTime: "-", lastCheck: "Error", platforms: ["web"], region: "India", thumbnail: "📦" },
  { id: "9", name: "Banking Portal", category: "Finance", stack: ".NET + Angular", status: "active", uptime: "99.99%", visitors: 523, loadTime: "0.8s", lastCheck: "30 sec ago", platforms: ["web", "mobile"], region: "Global", thumbnail: "🏦" },
  { id: "10", name: "Food Delivery", category: "Food & Beverage", stack: "Flutter + Node", status: "active", uptime: "99.94%", visitors: 678, loadTime: "1.0s", lastCheck: "1 min ago", platforms: ["mobile"], region: "India", thumbnail: "🍔" },
  { id: "11", name: "HR Management", category: "Enterprise", stack: "React + PostgreSQL", status: "active", uptime: "99.96%", visitors: 145, loadTime: "1.1s", lastCheck: "2 min ago", platforms: ["web"], region: "Global", thumbnail: "👥" },
  { id: "12", name: "Salon Booking", category: "Beauty", stack: "React Native + Firebase", status: "active", uptime: "99.85%", visitors: 234, loadTime: "1.3s", lastCheck: "1 min ago", platforms: ["mobile"], region: "USA", thumbnail: "💇" },
];

const DemoStatusGrid = () => {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredDemos = demos.filter(demo => {
    const matchesCategory = categoryFilter === "all" || demo.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || demo.status === statusFilter;
    return matchesCategory && matchesStatus;
  });

  const activeCount = demos.filter(d => d.status === "active").length;
  const maintenanceCount = demos.filter(d => d.status === "maintenance").length;
  const offlineCount = demos.filter(d => d.status === "offline").length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="w-4 h-4 text-neon-green" />;
      case "maintenance": return <AlertTriangle className="w-4 h-4 text-neon-orange" />;
      case "offline": return <XCircle className="w-4 h-4 text-neon-red" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-neon-green/20 text-neon-green border-neon-green/50";
      case "maintenance": return "bg-neon-orange/20 text-neon-orange border-neon-orange/50";
      case "offline": return "bg-neon-red/20 text-neon-red border-neon-red/50";
      default: return "";
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "web": return <Monitor className="w-3 h-3" />;
      case "mobile": return <Smartphone className="w-3 h-3" />;
      case "tablet": return <Tablet className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">Demo Status Grid</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time monitoring of all product demos</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-neon-green/20 text-neon-green border-neon-green/50 px-3 py-1">
            <CheckCircle className="w-3 h-3 mr-1" /> {activeCount} Active
          </Badge>
          <Badge className="bg-neon-orange/20 text-neon-orange border-neon-orange/50 px-3 py-1">
            <AlertTriangle className="w-3 h-3 mr-1" /> {maintenanceCount} Maintenance
          </Badge>
          <Badge className="bg-neon-red/20 text-neon-red border-neon-red/50 px-3 py-1">
            <XCircle className="w-3 h-3 mr-1" /> {offlineCount} Offline
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-secondary/50 border-border/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="ml-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* Demo Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filteredDemos.map((demo, index) => (
          <motion.div
            key={demo.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="glass-panel p-4 hover:border-neon-teal/50 transition-all duration-300 group"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-card flex items-center justify-center text-2xl">
                  {demo.thumbnail}
                </div>
                <div>
                  <h3 className="font-mono font-semibold text-foreground">{demo.name}</h3>
                  <div className="text-xs text-muted-foreground">{demo.category}</div>
                </div>
              </div>
              <Badge className={`${getStatusColor(demo.status)}`}>
                {getStatusIcon(demo.status)}
                <span className="ml-1 text-[10px] uppercase">{demo.status}</span>
              </Badge>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div className="p-2 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Uptime</div>
                <div className={`font-mono font-bold text-sm ${demo.status === "active" ? "text-neon-green" : "text-muted-foreground"}`}>
                  {demo.uptime}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Visitors</div>
                <div className="font-mono font-bold text-sm text-primary">{demo.visitors}</div>
              </div>
              <div className="p-2 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Load</div>
                <div className="font-mono font-bold text-sm text-neon-cyan">{demo.loadTime}</div>
              </div>
            </div>

            {/* Info Row */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {demo.region}
              </div>
              <div className="flex items-center gap-1">
                {demo.platforms.map((p, i) => (
                  <span key={i} className="text-primary">{getPlatformIcon(p)}</span>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {demo.lastCheck}
              </div>
            </div>

            {/* Tech Stack */}
            <div className="text-[10px] text-muted-foreground mb-3 font-mono bg-secondary/30 px-2 py-1 rounded">
              {demo.stack}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="sm" variant="outline" className="flex-1 text-xs">
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs">
                <ExternalLink className="w-3 h-3 mr-1" />
                Open
              </Button>
              {demo.status === "active" ? (
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <Pause className="w-3 h-3" />
                </Button>
              ) : (
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <Play className="w-3 h-3" />
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DemoStatusGrid;
