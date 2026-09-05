import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Upload,
  Save,
  Users,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Play,
  Pause,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoManagerAccess } from '@/hooks/useDemoManagerAccess';
import { DemoAccessGate } from './DemoAccessGate';

// Demo types available
const DEMO_TYPES = [
  'School',
  'Hospital',
  'ERP',
  'CRM',
  'E-commerce',
  'Restaurant',
  'Gym',
  'Salon',
  'Hotel',
  'Real Estate',
  'Accounting',
  'Inventory',
  'HR Management',
  'Other'
];

// Common login role templates per demo type
const ROLE_TEMPLATES: Record<string, string[]> = {
  School: ['Admin', 'Teacher', 'Student', 'Accountant', 'Parent', 'Principal'],
  Hospital: ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician'],
  ERP: ['Admin', 'Manager', 'Employee', 'Accountant', 'HR', 'Sales'],
  CRM: ['Admin', 'Sales Manager', 'Sales Rep', 'Support', 'Marketing'],
  'E-commerce': ['Admin', 'Vendor', 'Customer', 'Warehouse', 'Delivery'],
  Restaurant: ['Admin', 'Manager', 'Waiter', 'Chef', 'Cashier'],
  Gym: ['Admin', 'Trainer', 'Member', 'Receptionist'],
  Salon: ['Admin', 'Stylist', 'Receptionist', 'Customer'],
  Hotel: ['Admin', 'Front Desk', 'Housekeeping', 'Restaurant', 'Guest'],
  'Real Estate': ['Admin', 'Agent', 'Buyer', 'Seller', 'Landlord'],
  Accounting: ['Admin', 'Accountant', 'Auditor', 'Client'],
  Inventory: ['Admin', 'Manager', 'Staff', 'Supplier'],
  'HR Management': ['Admin', 'HR Manager', 'Employee', 'Payroll', 'Recruiter'],
  Other: ['Admin', 'User', 'Manager', 'Staff']
};

interface LoginRole {
  id: string;
  role_name: string;
  username: string;
  password: string;
}

interface DemoEntry {
  id: string;
  name: string;
  login_url: string;
  demo_type: string;
  login_roles: LoginRole[];
}

function BulkDemoCreatorContent() {
  const [demos, setDemos] = useState<DemoEntry[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [currentDemo, setCurrentDemo] = useState<DemoEntry | null>(null);
  const [showRolesDialog, setShowRolesDialog] = useState(false);
  const { isDemoManager, createReportCard } = useDemoManagerAccess();

  // Add new empty demo
  const addDemo = useCallback(() => {
    const newDemo: DemoEntry = {
      id: crypto.randomUUID(),
      name: '',
      login_url: '',
      demo_type: 'School',
      login_roles: []
    };
    setDemos(prev => [...prev, newDemo]);
  }, []);

  // Remove demo
  const removeDemo = useCallback((demoId: string) => {
    setDemos(prev => prev.filter(d => d.id !== demoId));
  }, []);

  // Update demo field
  const updateDemo = useCallback((demoId: string, field: keyof DemoEntry, value: any) => {
    setDemos(prev => prev.map(d => 
      d.id === demoId ? { ...d, [field]: value } : d
    ));
  }, []);

  // Apply role template
  const applyRoleTemplate = useCallback((demoId: string, demoType: string) => {
    const roles = ROLE_TEMPLATES[demoType] || ROLE_TEMPLATES.Other;
    const loginRoles: LoginRole[] = roles.slice(0, 6).map((roleName, idx) => ({
      id: crypto.randomUUID(),
      role_name: roleName,
      username: `${roleName.toLowerCase().replace(/\s+/g, '_')}_demo`,
      password: `Demo@${roleName.replace(/\s+/g, '')}123`
    }));
    
    updateDemo(demoId, 'login_roles', loginRoles);
    updateDemo(demoId, 'demo_type', demoType);
  }, [updateDemo]);

  // Add login role to demo
  const addLoginRole = useCallback((demoId: string) => {
    const demo = demos.find(d => d.id === demoId);
    if (!demo) return;
    
    if (demo.login_roles.length >= 9) {
      toast.error('Maximum 9 login roles per demo');
      return;
    }

    const newRole: LoginRole = {
      id: crypto.randomUUID(),
      role_name: '',
      username: '',
      password: ''
    };

    updateDemo(demoId, 'login_roles', [...demo.login_roles, newRole]);
  }, [demos, updateDemo]);

  // Remove login role
  const removeLoginRole = useCallback((demoId: string, roleId: string) => {
    const demo = demos.find(d => d.id === demoId);
    if (!demo) return;

    if (demo.login_roles.length <= 4) {
      toast.error('Minimum 4 login roles required per demo');
      return;
    }

    updateDemo(demoId, 'login_roles', demo.login_roles.filter(r => r.id !== roleId));
  }, [demos, updateDemo]);

  // Update login role
  const updateLoginRole = useCallback((demoId: string, roleId: string, field: keyof LoginRole, value: string) => {
    const demo = demos.find(d => d.id === demoId);
    if (!demo) return;

    const updatedRoles = demo.login_roles.map(r =>
      r.id === roleId ? { ...r, [field]: value } : r
    );
    updateDemo(demoId, 'login_roles', updatedRoles);
  }, [demos, updateDemo]);

  // Open roles dialog
  const openRolesDialog = useCallback((demo: DemoEntry) => {
    setCurrentDemo(demo);
    setShowRolesDialog(true);
  }, []);

  // Validate demos before creation
  const validateDemos = useCallback((): boolean => {
    for (const demo of demos) {
      if (!demo.name.trim()) {
        toast.error(`Demo name is required for all demos`);
        return false;
      }
      if (!demo.login_url.trim()) {
        toast.error(`Login URL is required for "${demo.name}"`);
        return false;
      }
      if (demo.login_roles.length < 4) {
        toast.error(`"${demo.name}" needs at least 4 login roles`);
        return false;
      }
      for (const role of demo.login_roles) {
        if (!role.role_name.trim() || !role.username.trim() || !role.password.trim()) {
          toast.error(`All login role fields are required for "${demo.name}"`);
          return false;
        }
      }
    }
    return true;
  }, [demos]);

  // Bulk create demos
  const bulkCreateDemos = async () => {
    if (!isDemoManager) {
      toast.error('Only Demo Manager can create demos');
      return;
    }

    if (demos.length === 0) {
      toast.error('Add at least one demo');
      return;
    }

    if (!validateDemos()) return;

    setIsCreating(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process in batches of 50 for performance
      const batchSize = 50;
      for (let i = 0; i < demos.length; i += batchSize) {
        const batch = demos.slice(i, i + batchSize);
        
        for (const demo of batch) {
          try {
            // Insert demo
            const { data: demoData, error: demoError } = await supabase
              .from('demos')
              .insert({
                title: demo.name,
                url: demo.login_url,
                login_url: demo.login_url,
                demo_type: demo.demo_type,
                category: demo.demo_type,
                lifecycle_status: 'pending',
                is_bulk_created: true,
                status: 'maintenance'
              })
              .select('id')
              .single();

            if (demoError) throw demoError;

            // Insert login roles
            const loginRolesData = demo.login_roles.map((role, idx) => ({
              demo_id: demoData.id,
              role_name: role.role_name,
              username: role.username,
              password_encrypted: role.password, // In production, encrypt this
              display_order: idx + 1
            }));

            const { error: rolesError } = await supabase
              .from('demo_login_roles')
              .insert(loginRolesData);

            if (rolesError) throw rolesError;

            // Create report card
            await createReportCard({
              demoId: demoData.id,
              demoName: demo.name,
              actionType: 'add',
              sector: demo.demo_type,
              demoStatus: 'pending',
              newValues: { login_roles_count: demo.login_roles.length }
            });

            successCount++;
          } catch (err) {
            console.error(`Failed to create demo "${demo.name}":`, err);
            failCount++;
          }
        }

        // Progress update
        toast.info(`Progress: ${Math.min(i + batchSize, demos.length)}/${demos.length} demos processed`);
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} demos in PENDING state`);
        setDemos([]);
      }
      if (failCount > 0) {
        toast.error(`Failed to create ${failCount} demos`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Bulk creation failed');
    } finally {
      setIsCreating(false);
    }
  };

  // Quick add multiple demos
  const quickAddDemos = useCallback((count: number) => {
    const newDemos: DemoEntry[] = Array.from({ length: count }, (_, idx) => ({
      id: crypto.randomUUID(),
      name: '',
      login_url: '',
      demo_type: 'School',
      login_roles: ROLE_TEMPLATES.School.slice(0, 4).map(roleName => ({
        id: crypto.randomUUID(),
        role_name: roleName,
        username: `${roleName.toLowerCase().replace(/\s+/g, '_')}_demo`,
        password: `Demo@${roleName.replace(/\s+/g, '')}123`
      }))
    }));
    setDemos(prev => [...prev, ...newDemos]);
    toast.success(`Added ${count} demo templates`);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <FileSpreadsheet className="w-7 h-7 text-primary" />
            Bulk Demo Creator
          </h1>
          <p className="text-muted-foreground mt-1">
            Create thousands of demos with multiple login roles - Demo Manager Only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/20 text-primary">
            {demos.length} Demos Ready
          </Badge>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="bg-card/50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={addDemo} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Single Demo
            </Button>
            <Button onClick={() => quickAddDemos(10)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add 10 Demos
            </Button>
            <Button onClick={() => quickAddDemos(50)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add 50 Demos
            </Button>
            <Button onClick={() => quickAddDemos(100)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add 100 Demos
            </Button>
            <div className="ml-auto">
              <Button 
                onClick={bulkCreateDemos} 
                disabled={isCreating || demos.length === 0}
                className="min-w-[200px]"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create All ({demos.length}) Demos
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demos List */}
      <ScrollArea className="h-[600px]">
        <div className="space-y-4 pr-4">
          {demos.length === 0 ? (
            <Card className="bg-card/30 border-dashed">
              <CardContent className="py-12 text-center">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No demos added yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Click "Add Demo" to start creating demos with login roles
                </p>
              </CardContent>
            </Card>
          ) : (
            demos.map((demo, idx) => (
              <Card key={demo.id} className="bg-card/50 hover:bg-card/70 transition-colors">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <div className="text-2xl font-bold text-muted-foreground w-12">
                      #{idx + 1}
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Demo Name */}
                      <div className="space-y-1">
                        <Label className="text-xs">Demo Name *</Label>
                        <Input
                          placeholder="Enter demo name"
                          value={demo.name}
                          onChange={(e) => updateDemo(demo.id, 'name', e.target.value)}
                        />
                      </div>
                      
                      {/* Login URL */}
                      <div className="space-y-1">
                        <Label className="text-xs">Login URL *</Label>
                        <Input
                          placeholder="https://demo.example.com/login"
                          value={demo.login_url}
                          onChange={(e) => updateDemo(demo.id, 'login_url', e.target.value)}
                        />
                      </div>
                      
                      {/* Demo Type */}
                      <div className="space-y-1">
                        <Label className="text-xs">Demo Type *</Label>
                        <Select
                          value={demo.demo_type}
                          onValueChange={(value) => applyRoleTemplate(demo.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEMO_TYPES.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Login Roles & Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRolesDialog(demo)}
                        className="gap-1"
                      >
                        <Users className="w-4 h-4" />
                        {demo.login_roles.length} Roles
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeDemo(demo.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Validation Status */}
                  <div className="mt-3 flex items-center gap-2">
                    {demo.name && demo.login_url && demo.login_roles.length >= 4 ? (
                      <Badge className="bg-green-500/20 text-green-400 gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-500/20 text-yellow-400 gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Incomplete
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {demo.login_roles.length}/4+ roles • Status: PENDING
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Login Roles Dialog */}
      <Dialog open={showRolesDialog} onOpenChange={setShowRolesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Login Roles for "{currentDemo?.name || 'Demo'}"
            </DialogTitle>
          </DialogHeader>
          
          {currentDemo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Min 4, Max 9 login roles per demo
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addLoginRole(currentDemo.id)}
                  disabled={currentDemo.login_roles.length >= 9}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Role
                </Button>
              </div>

              <div className="space-y-3">
                {currentDemo.login_roles.map((role, idx) => (
                  <Card key={role.id} className="bg-background/50">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium w-6">{idx + 1}.</span>
                        
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Role Name"
                            value={role.role_name}
                            onChange={(e) => updateLoginRole(currentDemo.id, role.id, 'role_name', e.target.value)}
                          />
                          <Input
                            placeholder="Username"
                            value={role.username}
                            onChange={(e) => updateLoginRole(currentDemo.id, role.id, 'username', e.target.value)}
                          />
                          <div className="relative">
                            <Input
                              type={showPasswords[role.id] ? 'text' : 'password'}
                              placeholder="Password"
                              value={role.password}
                              onChange={(e) => updateLoginRole(currentDemo.id, role.id, 'password', e.target.value)}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-2"
                              onClick={() => setShowPasswords(prev => ({ ...prev, [role.id]: !prev[role.id] }))}
                            >
                              {showPasswords[role.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => removeLoginRole(currentDemo.id, role.id)}
                          disabled={currentDemo.login_roles.length <= 4}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setShowRolesDialog(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BulkDemoCreator() {
  return (
    <DemoAccessGate requireEdit>
      <BulkDemoCreatorContent />
    </DemoAccessGate>
  );
}
