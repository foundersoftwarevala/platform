import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Link2, 
  Plus, 
  Trash2, 
  Save,
  Loader2,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  Globe,
  Layers,
  User,
  Lock,
  Copy,
  Search,
  AlertTriangle,
  Zap,
  Upload,
  Shield,
  FileCheck,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LoginRole {
  id: string;
  roleName: string;
  username: string;
  password: string;
  showPassword: boolean;
}

interface ValidationResult {
  isValid: boolean;
  isDuplicate: boolean;
  isReachable: boolean;
  httpStatus?: number;
  responseTime?: number;
  normalizedUrl?: string;
  duplicateId?: string;
  duplicateTitle?: string;
  errorMessage?: string;
  title?: string;
  description?: string;
  source?: string;
  demoType?: string;
  category?: string;
}

interface RegisteredDemo {
  id: string;
  title: string;
  url: string;
  category: string;
  demo_type: string;
  status: string;
  lifecycle_status: string | null;
  verification_status: string | null;
  created_at: string;
  login_count: number;
  http_status: number | null;
  last_verified_at: string | null;
}

interface BulkVerifyStats {
  total: number;
  active: number;
  broken: number;
  pending: number;
}

const DEMO_TYPES = ["Admin Panel", "Dashboard", "Frontend", "Backend", "Full Stack", "API", "Mobile App"];
const CATEGORIES = [
  "Education", "Healthcare", "E-Commerce", "POS/Billing", "CRM", "HRM", 
  "Hotel/Booking", "Restaurant", "Real Estate", "ERP", "General", "Finance",
  "Logistics", "Social Media", "Entertainment", "Travel", "Fitness", "News/Blog",
  "Inventory", "Project Management", "Events", "Insurance", "Manufacturing",
  "Automotive", "Beauty/Salon", "Library", "Subscription"
];
const SOURCES = ["Codecanyon", "Envato", "ThemeForest", "GitHub", "Demo Site", "Preview Site", "Custom"];

const DemoURLCollector = () => {
  // Form state
  const [demoUrl, setDemoUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  // Editable fields
  const [demoName, setDemoName] = useState("");
  const [demoDescription, setDemoDescription] = useState("");
  const [sector, setSector] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [demoType, setDemoType] = useState("");
  const [source, setSource] = useState("");
  
  // Login roles (4-9 per demo)
  const [loginRoles, setLoginRoles] = useState<LoginRole[]>([]);
  
  // Registered demos list
  const [registeredDemos, setRegisteredDemos] = useState<RegisteredDemo[]>([]);
  const [isLoadingDemos, setIsLoadingDemos] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Bulk verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState(0);
  const [verifyStats, setVerifyStats] = useState<BulkVerifyStats | null>(null);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    broken: 0,
    pending: 0,
    unverified: 0
  });

  // Fetch registered demos on mount
  useEffect(() => {
    fetchRegisteredDemos();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { count: total } = await supabase.from('demos').select('id', { count: 'exact', head: true });
      const { count: active } = await supabase.from('demos').select('id', { count: 'exact', head: true }).eq('status', 'active');
      const { count: broken } = await supabase.from('demos').select('id', { count: 'exact', head: true }).eq('verification_status', 'broken');
      const { count: pending } = await supabase.from('demos').select('id', { count: 'exact', head: true }).eq('lifecycle_status', 'pending_activation');
      const { count: unverified } = await supabase.from('demos').select('id', { count: 'exact', head: true }).eq('verification_status', 'unverified');
      
      setStats({
        total: total || 0,
        active: active || 0,
        broken: broken || 0,
        pending: pending || 0,
        unverified: unverified || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRegisteredDemos = async () => {
    setIsLoadingDemos(true);
    try {
      const { data: demos, error } = await supabase
        .from('demos')
        .select(`
          id,
          title,
          url,
          category,
          demo_type,
          status,
          lifecycle_status,
          verification_status,
          http_status,
          last_verified_at,
          created_at,
          demo_login_credentials(id)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedDemos: RegisteredDemo[] = (demos || []).map((demo: any) => ({
        id: demo.id,
        title: demo.title,
        url: demo.url,
        category: demo.category,
        demo_type: demo.demo_type || 'Full Stack',
        status: demo.status,
        lifecycle_status: demo.lifecycle_status,
        verification_status: demo.verification_status,
        http_status: demo.http_status,
        last_verified_at: demo.last_verified_at,
        created_at: demo.created_at,
        login_count: demo.demo_login_credentials?.length || 0
      }));

      setRegisteredDemos(formattedDemos);
    } catch (error) {
      console.error('Error fetching demos:', error);
      toast({
        title: "Error",
        description: "Failed to load registered demos",
        variant: "destructive"
      });
    } finally {
      setIsLoadingDemos(false);
    }
  };

  const validateDemoUrl = async () => {
    if (!demoUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a demo URL to validate",
        variant: "destructive"
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-demo-url', {
        body: { url: demoUrl }
      });

      if (error) throw error;

      const validation = data.validation as ValidationResult;
      setValidationResult(validation);

      if (validation.isDuplicate) {
        toast({
          title: "Duplicate Detected",
          description: `This URL already exists as "${validation.duplicateTitle}"`,
          variant: "destructive"
        });
      } else if (!validation.isReachable) {
        toast({
          title: "URL Unreachable",
          description: validation.errorMessage || "Could not connect to the URL",
          variant: "destructive"
        });
      } else if (validation.isValid) {
        // Auto-fill fields from validation
        setDemoName(validation.title || '');
        setDemoDescription(validation.description || '');
        setSector(validation.category || 'General');
        setDemoType(validation.demoType || 'Full Stack');
        setSource(validation.source || 'Custom');
        
        toast({
          title: "URL Validated",
          description: "Demo details auto-detected. You can edit them if needed.",
        });
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast({
        title: "Validation Failed",
        description: "Could not validate URL. Please check and try again.",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const addLoginRole = () => {
    if (loginRoles.length >= 9) {
      toast({
        title: "Maximum Roles Reached",
        description: "You can add up to 9 login roles per demo",
        variant: "destructive"
      });
      return;
    }
    
    const newRole: LoginRole = {
      id: crypto.randomUUID(),
      roleName: "",
      username: "",
      password: "",
      showPassword: false
    };
    setLoginRoles([...loginRoles, newRole]);
  };

  const updateLoginRole = (id: string, field: keyof LoginRole, value: string | boolean) => {
    setLoginRoles(loginRoles.map(role => 
      role.id === id ? { ...role, [field]: value } : role
    ));
  };

  const removeLoginRole = (id: string) => {
    setLoginRoles(loginRoles.filter(role => role.id !== id));
  };

  const togglePasswordVisibility = (id: string) => {
    setLoginRoles(loginRoles.map(role => 
      role.id === id ? { ...role, showPassword: !role.showPassword } : role
    ));
  };

  const resetForm = () => {
    setDemoUrl("");
    setValidationResult(null);
    setDemoName("");
    setDemoDescription("");
    setSector("");
    setSubCategory("");
    setDemoType("");
    setSource("");
    setLoginRoles([]);
  };

  const handleSubmit = async () => {
    // Validation
    if (!demoUrl.trim()) {
      toast({ title: "Error", description: "Demo URL is required", variant: "destructive" });
      return;
    }
    if (!demoName.trim()) {
      toast({ title: "Error", description: "Demo name is required", variant: "destructive" });
      return;
    }
    if (!sector) {
      toast({ title: "Error", description: "Sector/Category is required", variant: "destructive" });
      return;
    }

    // Check if validation was done and passed
    if (validationResult?.isDuplicate) {
      toast({ 
        title: "Cannot Register", 
        description: "This URL is a duplicate. Please use a different URL.", 
        variant: "destructive" 
      });
      return;
    }

    // Validate login roles if any (minimum 4 if adding roles)
    if (loginRoles.length > 0 && loginRoles.length < 4) {
      toast({ 
        title: "Minimum Roles Required", 
        description: "Please add at least 4 login roles or remove all roles", 
        variant: "destructive" 
      });
      return;
    }

    for (const role of loginRoles) {
      if (!role.roleName.trim() || !role.username.trim() || !role.password.trim()) {
        toast({ 
          title: "Error", 
          description: "All login role fields must be filled", 
          variant: "destructive" 
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
        return;
      }

      // Insert demo in PENDING status
      const { data: newDemo, error: demoError } = await supabase
        .from('demos')
        .insert([{
          title: demoName,
          url: demoUrl,
          category: sector,
          description: demoDescription || null,
          demo_type: demoType || 'Full Stack',
          status: 'inactive' as const,
          lifecycle_status: 'pending_activation',
          verification_status: validationResult?.isReachable ? 'verified' : 'unverified',
          http_status: validationResult?.httpStatus,
          response_time_ms: validationResult?.responseTime,
          created_by: user.id,
          total_login_roles: loginRoles.length,
          tech_stack: 'php' as const
        }])
        .select()
        .single();

      if (demoError) {
        // Check for unique constraint violation
        if (demoError.code === '23505') {
          toast({ 
            title: "Duplicate URL", 
            description: "This demo URL already exists in the system", 
            variant: "destructive" 
          });
          return;
        }
        throw demoError;
      }

      // Insert login credentials if any
      if (loginRoles.length > 0) {
        const credentialsToInsert = loginRoles.map(role => ({
          demo_id: newDemo.id,
          role_type: role.roleName,
          username: role.username,
          password: role.password,
          is_active: true
        }));

        const { error: credError } = await supabase
          .from('demo_login_credentials')
          .insert(credentialsToInsert);

        if (credError) {
          console.error('Error inserting credentials:', credError);
        }
      }

      // Log the validation
      await supabase.from('demo_validation_logs').insert({
        demo_id: newDemo.id,
        demo_url: demoUrl,
        validation_type: 'registration',
        status: 'passed',
        http_status: validationResult?.httpStatus,
        response_time_ms: validationResult?.responseTime,
        validated_by: user.id
      });

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        module: 'demo_manager',
        action: 'demo_registered',
        meta_json: {
          demo_id: newDemo.id,
          demo_name: demoName,
          url: demoUrl,
          sector,
          login_roles: loginRoles.length
        }
      });

      toast({
        title: "Demo Registered",
        description: `"${demoName}" has been registered in PENDING state.`,
      });

      resetForm();
      fetchRegisteredDemos();
      fetchStats();

    } catch (error: any) {
      console.error('Error registering demo:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register demo",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bulkVerifyDemos = async () => {
    setIsVerifying(true);
    setVerifyProgress(0);
    setVerifyStats(null);

    try {
      // Process in batches
      let totalProcessed = 0;
      let allStats: BulkVerifyStats = { total: 0, active: 0, broken: 0, pending: 0 };

      for (let i = 0; i < 10; i++) { // Max 10 batches of 50 = 500 demos per run
        setVerifyProgress((i + 1) * 10);
        
        const { data, error } = await supabase.functions.invoke('bulk-verify-demos', {
          body: { batchSize: 50, skipVerified: true }
        });

        if (error) throw error;

        if (data.stats.total === 0) {
          break; // No more demos to verify
        }

        allStats.total += data.stats.total;
        allStats.active += data.stats.active;
        allStats.broken += data.stats.broken;
        totalProcessed += data.stats.total;

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setVerifyStats(allStats);
      setVerifyProgress(100);

      toast({
        title: "Verification Complete",
        description: `Verified ${allStats.total} demos: ${allStats.active} active, ${allStats.broken} broken`,
      });

      fetchRegisteredDemos();
      fetchStats();

    } catch (error: any) {
      console.error('Bulk verification error:', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify demos",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
      setTimeout(() => setVerifyProgress(0), 2000);
    }
  };

  const activateDemo = async (demoId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('demos')
        .update({ 
          status: 'active',
          lifecycle_status: 'active',
          activated_at: new Date().toISOString(),
          activated_by: user?.id
        })
        .eq('id', demoId);

      if (error) throw error;

      toast({ title: "Success", description: "Demo activated successfully" });
      fetchRegisteredDemos();
      fetchStats();
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to activate demo", 
        variant: "destructive" 
      });
    }
  };

  const deactivateDemo = async (demoId: string) => {
    try {
      const { error } = await supabase
        .from('demos')
        .update({ 
          status: 'inactive',
          lifecycle_status: 'deactivated'
        })
        .eq('id', demoId);

      if (error) throw error;

      toast({ title: "Success", description: "Demo deactivated" });
      fetchRegisteredDemos();
      fetchStats();
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to deactivate demo", 
        variant: "destructive" 
      });
    }
  };

  const deleteDemo = async (demoId: string) => {
    if (!confirm("Are you sure you want to delete this demo? This action cannot be undone.")) {
      return;
    }

    try {
      await supabase.from('demo_login_credentials').delete().eq('demo_id', demoId);
      await supabase.from('demo_validation_logs').delete().eq('demo_id', demoId);
      
      const { error } = await supabase.from('demos').delete().eq('id', demoId);
      if (error) throw error;

      toast({ title: "Deleted", description: "Demo has been removed" });
      fetchRegisteredDemos();
      fetchStats();
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete demo", 
        variant: "destructive" 
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "URL copied to clipboard" });
  };

  const filteredDemos = registeredDemos.filter(demo => {
    const matchesSearch = demo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      demo.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      demo.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') return matchesSearch && demo.status === 'active';
    if (statusFilter === 'pending') return matchesSearch && demo.lifecycle_status === 'pending_activation';
    if (statusFilter === 'broken') return matchesSearch && demo.verification_status === 'broken';
    return matchesSearch;
  });

  const getStatusColor = (demo: RegisteredDemo) => {
    if (demo.verification_status === 'broken') return 'bg-destructive/20 text-destructive border-destructive/50';
    if (demo.lifecycle_status === 'pending_activation') return 'bg-neon-orange/20 text-neon-orange border-neon-orange/50';
    if (demo.status === 'active') return 'bg-neon-green/20 text-neon-green border-neon-green/50';
    return 'bg-muted text-muted-foreground';
  };

  const getStatusLabel = (demo: RegisteredDemo) => {
    if (demo.verification_status === 'broken') return 'Broken';
    if (demo.lifecycle_status === 'pending_activation') return 'Pending';
    if (demo.status === 'active') return 'Active';
    return 'Inactive';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">Global Demo Registry</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Universal demo management system with validation and verification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={bulkVerifyDemos}
            disabled={isVerifying}
            className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30"
          >
            {isVerifying ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Bulk Verify All
          </Button>
          <Badge className="bg-neon-teal/20 text-neon-teal border-neon-teal/50">
            <Globe className="w-3 h-3 mr-1" />
            {stats.total.toLocaleString()} Demos
          </Badge>
        </div>
      </div>

      {/* Bulk Verify Progress */}
      <AnimatePresence>
        {isVerifying && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="glass-panel border-neon-cyan/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Activity className="w-5 h-5 animate-pulse text-neon-cyan" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Verifying all demo URLs...</p>
                    <Progress value={verifyProgress} className="mt-2 h-2" />
                  </div>
                  <span className="text-sm text-muted-foreground">{verifyProgress}%</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verify Stats */}
      {verifyStats && (
        <Card className="glass-panel border-neon-green/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-6">
              <FileCheck className="w-8 h-8 text-neon-green" />
              <div className="flex-1 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-mono font-bold text-foreground">{verifyStats.total}</div>
                  <div className="text-xs text-muted-foreground">Verified</div>
                </div>
                <div>
                  <div className="text-2xl font-mono font-bold text-neon-green">{verifyStats.active}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <div>
                  <div className="text-2xl font-mono font-bold text-destructive">{verifyStats.broken}</div>
                  <div className="text-xs text-muted-foreground">Broken</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setVerifyStats(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total, icon: Layers, color: "text-primary" },
          { label: "Active", value: stats.active, icon: CheckCircle2, color: "text-neon-green" },
          { label: "Pending", value: stats.pending, icon: AlertCircle, color: "text-neon-orange" },
          { label: "Broken", value: stats.broken, icon: AlertTriangle, color: "text-destructive" },
          { label: "Unverified", value: stats.unverified, icon: Shield, color: "text-muted-foreground" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-4"
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <div className={`text-2xl font-mono font-bold ${stat.color}`}>
                    {stat.value.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: URL Input & Registration Form */}
        <Card className="glass-panel border-border/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="w-5 h-5 text-primary" />
              Register New Demo
            </CardTitle>
            <CardDescription>
              Paste any demo URL worldwide - auto-validation enabled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* URL Input with Validation */}
            <div className="space-y-2">
              <Label>Demo URL *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://codecanyon.net/item/demo-preview..."
                  value={demoUrl}
                  onChange={(e) => {
                    setDemoUrl(e.target.value);
                    setValidationResult(null);
                  }}
                  className={`flex-1 bg-secondary/50 ${
                    validationResult?.isDuplicate ? 'border-destructive' : 
                    validationResult?.isValid ? 'border-neon-green' : ''
                  }`}
                />
                <Button 
                  onClick={validateDemoUrl}
                  disabled={isValidating || !demoUrl.trim()}
                  className="command-button-secondary"
                >
                  {isValidating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                  <span className="ml-2">Validate</span>
                </Button>
              </div>
              
              {/* Validation Status */}
              {validationResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  validationResult.isDuplicate ? 'bg-destructive/20 border border-destructive/50' :
                  !validationResult.isReachable ? 'bg-neon-orange/20 border border-neon-orange/50' :
                  'bg-neon-green/20 border border-neon-green/50'
                }`}>
                  <div className="flex items-center gap-2">
                    {validationResult.isDuplicate ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        <span className="text-destructive font-medium">Duplicate URL</span>
                      </>
                    ) : !validationResult.isReachable ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-neon-orange" />
                        <span className="text-neon-orange font-medium">URL Unreachable</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-neon-green" />
                        <span className="text-neon-green font-medium">Valid & Reachable</span>
                      </>
                    )}
                  </div>
                  {validationResult.errorMessage && (
                    <p className="mt-1 text-xs opacity-80">{validationResult.errorMessage}</p>
                  )}
                  {validationResult.responseTime && (
                    <p className="mt-1 text-xs opacity-80">
                      Response: {validationResult.responseTime}ms | HTTP {validationResult.httpStatus}
                    </p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Editable Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Demo Name *</Label>
                <Input
                  placeholder="E-Commerce Pro Dashboard"
                  value={demoName}
                  onChange={(e) => setDemoName(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>

              <div className="space-y-2">
                <Label>Sector / Category *</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sub-Category</Label>
                <Input
                  placeholder="e.g., Multi-vendor, SaaS"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>

              <div className="space-y-2">
                <Label>Demo Type</Label>
                <Select value={demoType} onValueChange={setDemoType}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of the demo..."
                  value={demoDescription}
                  onChange={(e) => setDemoDescription(e.target.value)}
                  className="bg-secondary/50 min-h-[80px]"
                />
              </div>
            </div>

            <Separator />

            {/* Login Roles Section (4-9 per demo) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Login Credentials (4-9 roles)</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {loginRoles.length}/9 roles added {loginRoles.length > 0 && loginRoles.length < 4 && "(min 4 required)"}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={addLoginRole}
                  disabled={loginRoles.length >= 9}
                  className="border-primary/50 text-primary hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Role
                </Button>
              </div>

              <AnimatePresence>
                {loginRoles.map((role, index) => (
                  <motion.div
                    key={role.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-primary">
                        Role #{index + 1}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeLoginRole(role.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Role Name</Label>
                        <div className="relative">
                          <User className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                          <Input
                            placeholder="Admin"
                            value={role.roleName}
                            onChange={(e) => updateLoginRole(role.id, 'roleName', e.target.value)}
                            className="pl-7 h-9 text-sm bg-background/50"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Username</Label>
                        <Input
                          placeholder="admin@demo.com"
                          value={role.username}
                          onChange={(e) => updateLoginRole(role.id, 'username', e.target.value)}
                          className="h-9 text-sm bg-background/50"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                          <Input
                            type={role.showPassword ? "text" : "password"}
                            placeholder="••••••"
                            value={role.password}
                            onChange={(e) => updateLoginRole(role.id, 'password', e.target.value)}
                            className="pl-7 pr-8 h-9 text-sm bg-background/50"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-9 w-8"
                            onClick={() => togglePasswordVisibility(role.id)}
                          >
                            {role.showPassword ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {loginRoles.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No login roles added yet</p>
                  <p className="text-xs">Click "Add Role" to add login credentials (4-9 roles)</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !demoUrl || !demoName || !sector || validationResult?.isDuplicate}
                className="flex-1 command-button-primary"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Register Demo (Pending)
              </Button>
              <Button 
                variant="outline"
                onClick={resetForm}
                className="border-border/50"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              <Shield className="w-3 h-3 inline mr-1" />
              Demos are validated for uniqueness and registered in PENDING state
            </p>
          </CardContent>
        </Card>

        {/* Right: Registered Demos List */}
        <Card className="glass-panel border-border/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers className="w-5 h-5 text-neon-teal" />
                  Registered Demos
                </CardTitle>
                <CardDescription>
                  {filteredDemos.length} of {registeredDemos.length} demos shown
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={fetchRegisteredDemos}
                className="h-8 w-8"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingDemos ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search demos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary/50"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 bg-secondary/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="broken">Broken</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Demo List */}
            <ScrollArea className="h-[500px]">
              {isLoadingDemos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredDemos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No demos found</p>
                  <p className="text-xs mt-1">Register a demo on the left to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDemos.map((demo) => (
                    <motion.div
                      key={demo.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground truncate">
                              {demo.title}
                            </h4>
                            <Badge className={getStatusColor(demo)}>
                              {getStatusLabel(demo)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {demo.url}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {demo.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {demo.login_count} roles
                        </span>
                        {demo.http_status && (
                          <span className="flex items-center gap-1">
                            HTTP {demo.http_status}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {demo.lifecycle_status === 'pending_activation' && (
                          <Button 
                            size="sm" 
                            className="h-7 text-xs bg-neon-green/20 text-neon-green hover:bg-neon-green/30"
                            onClick={() => activateDemo(demo.id)}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Activate
                          </Button>
                        )}
                        {demo.status === 'active' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => deactivateDemo(demo.id)}
                          >
                            Deactivate
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => copyToClipboard(demo.url)}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => window.open(demo.url, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                          onClick={() => deleteDemo(demo.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DemoURLCollector;