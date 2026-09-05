import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Plus, 
  Upload, 
  Globe, 
  Lock,
  Unlock,
  Eye,
  Monitor,
  Smartphone,
  Tablet,
  Save,
  RefreshCw,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DemoCreator = () => {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    stack: "",
    description: "",
    loginMode: "open",
    autoRotate: true,
    multiRegion: false,
  });

  const categories = [
    "Retail", "Healthcare", "Education", "Finance", "Food & Beverage", 
    "Property", "Tourism", "Logistics", "Fitness", "Beauty", "Enterprise"
  ];

  const techStacks = [
    "React + Node.js", "Angular + Java", "Vue.js + PHP", "Flutter + Firebase",
    "React Native + Node", "Next.js + MongoDB", ".NET + Angular", "Python + React"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">Create New Demo</h1>
          <p className="text-muted-foreground text-sm mt-1">Add a new product demo to the catalog</p>
        </div>
        <Badge className="bg-neon-orange/20 text-neon-orange border-neon-orange/50">
          Requires Super Admin Approval
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 col-span-2"
        >
          <h2 className="font-mono font-semibold text-foreground mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Demo Details
          </h2>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Demo Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., E-Commerce Pro"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stack">Technology Stack *</Label>
              <Select value={formData.stack} onValueChange={(value) => setFormData({ ...formData, stack: value })}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Select technology stack" />
                </SelectTrigger>
                <SelectContent>
                  {techStacks.map((stack) => (
                    <SelectItem key={stack} value={stack}>{stack}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the demo..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-secondary/50 border-border/50 min-h-[100px]"
              />
            </div>

            {/* Login Mode */}
            <div className="space-y-3">
              <Label>Login Mode</Label>
              <div className="flex gap-4">
                {[
                  { value: "open", label: "Open Access", icon: Unlock, desc: "No login required" },
                  { value: "prefilled", label: "Pre-filled", icon: Eye, desc: "Demo credentials" },
                  { value: "readonly", label: "Read Only", icon: Lock, desc: "View only mode" },
                ].map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => setFormData({ ...formData, loginMode: mode.value })}
                      className={`flex-1 p-4 rounded-lg border transition-all ${
                        formData.loginMode === mode.value
                          ? "border-primary/50 bg-primary/10"
                          : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-2 ${formData.loginMode === mode.value ? "text-primary" : "text-muted-foreground"}`} />
                      <div className={`text-sm font-medium ${formData.loginMode === mode.value ? "text-primary" : "text-foreground"}`}>
                        {mode.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{mode.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Platform Availability */}
            <div className="space-y-3">
              <Label>Platform Availability</Label>
              <div className="flex gap-4">
                {[
                  { id: "web", label: "Web", icon: Monitor },
                  { id: "mobile", label: "Android", icon: Smartphone },
                  { id: "ios", label: "iOS", icon: Smartphone },
                  { id: "tablet", label: "Tablet", icon: Tablet },
                ].map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <label
                      key={platform.id}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-secondary/30 cursor-pointer hover:bg-secondary/50"
                    >
                      <input type="checkbox" className="sr-only peer" />
                      <Icon className="w-4 h-4 text-muted-foreground peer-checked:text-primary" />
                      <span className="text-sm">{platform.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Upload Section */}
            <div className="space-y-3">
              <Label>Demo Assets</Label>
              <div className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-foreground mb-1">Drop files here or click to upload</div>
                <div className="text-xs text-muted-foreground">Screenshots, APK files, documentation</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Settings Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Options */}
          <div className="glass-panel p-6">
            <h2 className="font-mono font-semibold text-foreground mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-neon-teal" />
              Options
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">Auto Rotate Previews</div>
                  <div className="text-xs text-muted-foreground">Rotate demo screenshots</div>
                </div>
                <Switch
                  checked={formData.autoRotate}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoRotate: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">Multi-Region Versions</div>
                  <div className="text-xs text-muted-foreground">Enable region-specific demos</div>
                </div>
                <Switch
                  checked={formData.multiRegion}
                  onCheckedChange={(checked) => setFormData({ ...formData, multiRegion: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">AI Health Monitoring</div>
                  <div className="text-xs text-muted-foreground">Automatic health checks</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">Auto Screenshot</div>
                  <div className="text-xs text-muted-foreground">Hourly screenshot capture</div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>

          {/* Region Settings */}
          <div className="glass-panel p-6">
            <h2 className="font-mono font-semibold text-foreground mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-neon-cyan" />
              Primary Region
            </h2>
            <Select defaultValue="global">
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="india">India</SelectItem>
                <SelectItem value="usa">USA</SelectItem>
                <SelectItem value="europe">Europe</SelectItem>
                <SelectItem value="uae">UAE</SelectItem>
                <SelectItem value="africa">Africa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button className="w-full command-button-primary">
              <Save className="w-4 h-4 mr-2" />
              Submit for Approval
            </Button>
            <Button variant="outline" className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Save as Draft
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DemoCreator;
