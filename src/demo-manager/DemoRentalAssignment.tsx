import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  UserPlus, 
  Users, 
  Calendar, 
  Clock, 
  Search,
  CheckCircle,
  XCircle,
  MoreVertical,
  Sparkles,
  Target,
  TrendingUp
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

interface Rental {
  id: string;
  demoName: string;
  assigneeName: string;
  assigneeRole: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  notes: string;
}

const DemoRentalAssignment = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    demo: "",
    assignee: "",
    role: "",
    startDate: "",
    endDate: "",
    notes: "",
  });

  const rentals: Rental[] = [
    { id: "1", demoName: "CRM Enterprise", assigneeName: "Franchise Alpha", assigneeRole: "franchise", startDate: "2024-01-15", endDate: "2024-03-15", isActive: true, notes: "Premium demo access" },
    { id: "2", demoName: "E-Commerce Suite", assigneeName: "Reseller Beta", assigneeRole: "reseller", startDate: "2024-01-20", endDate: null, isActive: true, notes: "Unlimited access" },
    { id: "3", demoName: "HR Management", assigneeName: "Partner Gamma", assigneeRole: "reseller", startDate: "2024-02-01", endDate: "2024-04-01", isActive: true, notes: "Trial period" },
    { id: "4", demoName: "Finance Portal", assigneeName: "Franchise Delta", assigneeRole: "franchise", startDate: "2023-12-01", endDate: "2024-02-01", isActive: false, notes: "Expired" },
    { id: "5", demoName: "Inventory System", assigneeName: "Reseller Epsilon", assigneeRole: "reseller", startDate: "2024-01-10", endDate: "2024-06-10", isActive: true, notes: "Extended access" },
  ];

  const demos = ["CRM Enterprise", "E-Commerce Suite", "HR Management", "Finance Portal", "Inventory System"];
  const assignees = [
    { name: "Franchise Alpha", role: "franchise" },
    { name: "Franchise Beta", role: "franchise" },
    { name: "Reseller Gamma", role: "reseller" },
    { name: "Reseller Delta", role: "reseller" },
    { name: "Partner Epsilon", role: "reseller" },
  ];

  const aiSuggestions = [
    { demo: "CRM Enterprise", assignee: "Franchise Alpha", reason: "High conversion rate (4.2%) in similar category", confidence: 94 },
    { demo: "E-Commerce Suite", assignee: "Reseller Gamma", reason: "Strong regional presence in target market", confidence: 87 },
    { demo: "HR Management", assignee: "Franchise Beta", reason: "Specialized in HR sector demos", confidence: 82 },
  ];

  const metrics = [
    { label: "Active Rentals", value: "42", icon: Users, color: "text-primary" },
    { label: "Pending Requests", value: "8", icon: Clock, color: "text-orange-400" },
    { label: "Expiring Soon", value: "5", icon: Calendar, color: "text-red-400" },
    { label: "AI Matched", value: "67%", icon: Sparkles, color: "text-neon-teal" },
  ];

  const handleSubmit = () => {
    if (!formData.demo || !formData.assignee || !formData.role) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Rental Assigned",
      description: `${formData.demo} has been assigned to ${formData.assignee}`,
    });
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleAIAssign = (suggestion: typeof aiSuggestions[0]) => {
    toast({
      title: "AI Assignment Applied",
      description: `${suggestion.demo} assigned to ${suggestion.assignee} with ${suggestion.confidence}% confidence`,
    });
    setIsAIDialogOpen(false);
  };

  const handleRevoke = (rental: Rental) => {
    toast({
      title: "Rental Revoked",
      description: `Access to ${rental.demoName} has been revoked for ${rental.assigneeName}`,
    });
  };

  const handleExtend = (rental: Rental) => {
    toast({
      title: "Rental Extended",
      description: `${rental.demoName} rental extended for ${rental.assigneeName}`,
    });
  };

  const resetForm = () => {
    setFormData({
      demo: "",
      assignee: "",
      role: "",
      startDate: "",
      endDate: "",
      notes: "",
    });
  };

  const filteredRentals = rentals.filter(rental =>
    rental.demoName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rental.assigneeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rental Assignment</h1>
          <p className="text-muted-foreground">Manage demo rentals for franchises and resellers</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-neon-teal text-neon-teal hover:bg-neon-teal/10">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Suggestions
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg bg-card border-border">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-neon-teal" />
                  AI-Powered Assignment Suggestions
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Based on category expertise, conversion rates, and regional presence:
                </p>
                {aiSuggestions.map((suggestion, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 rounded-lg bg-background/50 border border-border hover:border-neon-teal/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{suggestion.demo}</p>
                          <Badge className="bg-neon-teal/20 text-neon-teal">{suggestion.confidence}% match</Badge>
                        </div>
                        <p className="text-sm text-primary mt-1">→ {suggestion.assignee}</p>
                        <p className="text-xs text-muted-foreground mt-2">{suggestion.reason}</p>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => handleAIAssign(suggestion)}
                        className="bg-neon-teal hover:bg-neon-teal/90 text-background"
                      >
                        Apply
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <UserPlus className="w-4 h-4 mr-2" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Assign Demo Rental
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Demo *</Label>
                  <Select value={formData.demo} onValueChange={(v) => setFormData({ ...formData, demo: v })}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Choose a demo" />
                    </SelectTrigger>
                    <SelectContent>
                      {demos.map(demo => (
                        <SelectItem key={demo} value={demo}>{demo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assign To *</Label>
                  <Select 
                    value={formData.assignee} 
                    onValueChange={(v) => {
                      const selected = assignees.find(a => a.name === v);
                      setFormData({ ...formData, assignee: v, role: selected?.role || "" });
                    }}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Choose assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignees.map(assignee => (
                        <SelectItem key={assignee.name} value={assignee.name}>
                          <div className="flex items-center gap-2">
                            {assignee.name}
                            <Badge variant="outline" className="text-xs">{assignee.role}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="bg-background border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Add any notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90">
                    Assign Rental
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <metric.icon className={`w-5 h-5 ${metric.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search rentals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-background/50 border-border"
        />
      </div>

      {/* Rental List */}
      <div className="grid gap-4">
        {filteredRentals.map((rental, index) => (
          <motion.div
            key={rental.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`glass-card border-border/50 hover:border-primary/50 transition-all ${!rental.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${rental.isActive ? 'bg-neon-green/10' : 'bg-red-500/10'}`}>
                      {rental.isActive ? (
                        <CheckCircle className="w-6 h-6 text-neon-green" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{rental.demoName}</h3>
                        <Badge className={rental.isActive ? "bg-neon-green/20 text-neon-green" : "bg-red-500/20 text-red-400"}>
                          {rental.isActive ? "Active" : "Expired"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Assigned to: <span className="text-primary">{rental.assigneeName}</span>
                        <Badge variant="outline" className="ml-2 text-xs">{rental.assigneeRole}</Badge>
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {rental.startDate} - {rental.endDate || "No end date"}
                        </span>
                        {rental.notes && (
                          <span className="italic">{rental.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="border-border">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {rental.isActive && (
                        <>
                          <DropdownMenuItem onClick={() => handleExtend(rental)}>
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Extend Rental
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRevoke(rental)}
                            className="text-red-400 focus:text-red-400"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Revoke Access
                          </DropdownMenuItem>
                        </>
                      )}
                      {!rental.isActive && (
                        <DropdownMenuItem onClick={() => handleExtend(rental)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Reactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DemoRentalAssignment;
