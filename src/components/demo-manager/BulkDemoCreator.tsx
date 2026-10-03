import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { richText, useTranslation } from '@/lib/i18n/use-translation';

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
  /**
   * Which marketplace category this demo is filed under.
   *
   * It used to not exist, and the insert wrote `category: demo.demo_type` - so
   * every bulk-created demo was filed under its *type* (School, Hospital, ERP)
   * out of a list of fourteen written into this file, while the marketplace
   * carries ninety categories. A demo could not be put in the category of the
   * card it belongs to. The type still drives the login-role template, which is
   * what it is actually for.
   */
  category: string;
  login_roles: LoginRole[];
}

function BulkDemoCreatorContent() {
  const { t } = useTranslation();
  const [demos, setDemos] = useState<DemoEntry[]>([]);
  /** The real categories, from demo_categories, seeded from the marketplace. */
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  /** Applied to every row a paste or a quick-add creates, and by "apply to all". */
  const [defaultCategory, setDefaultCategory] = useState<string>('');
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('demo_categories')
        .select('name, display_order')
        .eq('is_active', true)
        .order('display_order');
      if (cancelled) return;
      if (error) {
        setCategoriesError(error.message);
        return;
      }
      const names = (data ?? []).map((row) => String(row.name)).filter(Boolean);
      setCategoriesError(null);
      setCategories(names);
      setDefaultCategory((current) => current || names[0] || '');
    })();
    return () => {
      cancelled = true;
    };
  }, []);
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
      category: defaultCategory,
      login_roles: []
    };
    setDemos(prev => [...prev, newDemo]);
  }, [defaultCategory]);

  /**
   * Turns a pasted list of URLs into rows.
   *
   * There are twelve thousand demo URLs to put in. Adding them a row at a time
   * and typing each one is not a way anybody would finish, so a paste of the
   * list is the way in. One demo per line, and the separator may be a pipe, a
   * tab or a comma:
   *
   *     https://demo.example.com/login
   *     https://demo.example.com/login | School ERP Demo
   *     https://demo.example.com/login | School ERP Demo | School Management
   *
   * A missing title is taken from the URL's host, and a missing or unknown
   * category falls back to the one chosen above - unknown rather than silently
   * accepted, because a category that is not in the list would file the demo
   * somewhere the marketplace cannot see.
   */
  const importPastedUrls = useCallback(() => {
    const lines = pasteText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      toast.error(t('demo.bulk_creator.nothing_to_import'));
      return;
    }

    const known = new Map(categories.map((c) => [c.toLowerCase(), c]));
    const rows: DemoEntry[] = [];
    const rejected: string[] = [];
    let unknownCategories = 0;

    for (const line of lines) {
      const parts = line.split(/\s*[|\t]\s*|\s*,\s(?=[^,]*$)/).map((p) => p.trim());
      const url = parts[0] ?? '';
      if (!/^https?:\/\//i.test(url)) {
        rejected.push(line.slice(0, 60));
        continue;
      }
      let name = parts[1] ?? '';
      if (!name) {
        try {
          name = new URL(url).hostname.replace(/^www\./i, '');
        } catch {
          name = url;
        }
      }
      const askedFor = parts[2] ?? '';
      const matched = askedFor ? known.get(askedFor.toLowerCase()) : undefined;
      if (askedFor && !matched) unknownCategories += 1;

      rows.push({
        id: crypto.randomUUID(),
        name,
        login_url: url,
        demo_type: 'School',
        category: matched ?? defaultCategory,
        login_roles: ROLE_TEMPLATES.School.slice(0, 4).map((roleName) => ({
          id: crypto.randomUUID(),
          role_name: roleName,
          username: `${roleName.toLowerCase().replace(/\s+/g, '_')}_demo`,
          password: `Demo@${roleName.replace(/\s+/g, '')}123`
        }))
      });
    }

    if (rows.length === 0) {
      toast.error(t('demo.bulk_creator.no_url_lines'));
      return;
    }
    setDemos((prev) => [...prev, ...rows]);
    setPasteText('');
    toast.success(
      `Imported ${rows.length} demo${rows.length === 1 ? '' : 's'}` +
        (rejected.length ? ` — ${rejected.length} line(s) had no URL and were skipped` : '') +
        (unknownCategories ? ` — ${unknownCategories} unknown categor${unknownCategories === 1 ? 'y' : 'ies'} fell back to ${defaultCategory}` : '')
    );
  }, [pasteText, categories, defaultCategory, t]);

  /** Files every row under the chosen category, for a batch that all belongs together. */
  const applyCategoryToAll = useCallback(() => {
    if (!defaultCategory) {
      toast.error(t('demo.bulk_creator.choose_category'));
      return;
    }
    setDemos((prev) => prev.map((d) => ({ ...d, category: defaultCategory })));
    toast.success(`All ${demos.length} demo(s) filed under ${defaultCategory}`);
  }, [defaultCategory, demos.length, t]);

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
      toast.error(t('demo.bulk_creator.max_roles'));
      return;
    }

    const newRole: LoginRole = {
      id: crypto.randomUUID(),
      role_name: '',
      username: '',
      password: ''
    };

    updateDemo(demoId, 'login_roles', [...demo.login_roles, newRole]);
  }, [demos, updateDemo, t]);

  // Remove login role
  const removeLoginRole = useCallback((demoId: string, roleId: string) => {
    const demo = demos.find(d => d.id === demoId);
    if (!demo) return;

    if (demo.login_roles.length <= 4) {
      toast.error(t('demo.bulk_creator.min_roles'));
      return;
    }

    updateDemo(demoId, 'login_roles', demo.login_roles.filter(r => r.id !== roleId));
  }, [demos, updateDemo, t]);

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
        toast.error(t('demo.bulk_creator.name_required'));
        return false;
      }
      if (!demo.login_url.trim()) {
        toast.error(`Login URL is required for "${demo.name}"`);
        return false;
      }
      if (!demo.category.trim()) {
        toast.error(`Category is required for "${demo.name}" — a demo with no category cannot be found in the marketplace`);
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
  }, [demos, t]);

  // Bulk create demos
  const bulkCreateDemos = async () => {
    if (!isDemoManager) {
      toast.error(t('demo.bulk_creator.manager_only'));
      return;
    }

    if (demos.length === 0) {
      toast.error(t('demo.bulk_creator.add_one'));
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
                // The category the operator chose, not the demo type. These are
                // different things: the type picks the login-role template, the
                // category is where the marketplace looks for it.
                category: demo.category,
                lifecycle_status: 'pending',
                is_bulk_created: true,
                status: 'maintenance'
              })
              .select('id')
              .single();

            if (demoError) throw demoError;

            // Insert login roles into demo_login_credentials (demo_login_roles was never created)
            const loginRolesData = demo.login_roles.map((role) => ({
              demo_id: demoData.id,
              role_type: role.role_name,
              username: role.username,
              password: role.password,
              login_url: demo.login_url,
              is_active: true
            }));

            const { error: rolesError } = await supabase
              .from('demo_login_credentials')
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
      category: defaultCategory,
      login_roles: ROLE_TEMPLATES.School.slice(0, 4).map(roleName => ({
        id: crypto.randomUUID(),
        role_name: roleName,
        username: `${roleName.toLowerCase().replace(/\s+/g, '_')}_demo`,
        password: `Demo@${roleName.replace(/\s+/g, '')}123`
      }))
    }));
    setDemos(prev => [...prev, ...newDemos]);
    toast.success(`Added ${count} demo templates`);
  }, [defaultCategory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <FileSpreadsheet className="w-7 h-7 text-primary" />
            {t('demo.bulk_creator.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('demo.bulk_creator.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/20 text-primary">
            {t('demo.bulk_creator.ready_count', { count: demos.length })}
          </Badge>
        </div>
      </div>

      {/* Paste the list in. Typing twelve thousand URLs is not a way to finish. */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            {t('demo.bulk_creator.import_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-[260px]">
              <Label className="text-xs">{t('demo.bulk_creator.import_category')}</Label>
              <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      categoriesError
                        ? t('demo.bulk_creator.categories_unloaded')
                        : categories.length === 0
                          ? t('demo.bulk_creator.categories_loading')
                          : t('demo.bulk_creator.select_one_of', { count: categories.length })
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={importPastedUrls} disabled={!pasteText.trim() || !defaultCategory}>
              <Upload className="w-4 h-4 mr-2" />
              {t('demo.bulk_creator.import_pasted')}
            </Button>
            <Button onClick={applyCategoryToAll} variant="outline" disabled={demos.length === 0 || !defaultCategory}>
              {t('demo.bulk_creator.apply_all')} {demos.length || ''}
            </Button>
          </div>

          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={
              'One demo per line. The URL is required; a title and a category are optional.\n' +
              'https://demo.example.com/login\n' +
              'https://demo.example.com/login | School ERP Demo\n' +
              'https://demo.example.com/login | School ERP Demo | School Management'
            }
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            {richText(t('demo.bulk_creator.paste_help'), { pipe: <code>|</code> })}
            {categoriesError && (
              <span className="text-destructive"> {t('demo.bulk_creator.categories_failed')} {categoriesError}</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-card/50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={addDemo} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              {t('demo.bulk_creator.add_single')}
            </Button>
            <Button onClick={() => quickAddDemos(10)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              {t('demo.bulk_creator.add_n', { count: 10 })}
            </Button>
            <Button onClick={() => quickAddDemos(50)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              {t('demo.bulk_creator.add_n', { count: 50 })}
            </Button>
            <Button onClick={() => quickAddDemos(100)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              {t('demo.bulk_creator.add_n', { count: 100 })}
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
                    {t('demo.bulk_creator.creating')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t('demo.bulk_creator.create_all', { count: demos.length })}
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
                <p className="text-muted-foreground">{t('demo.bulk_creator.empty')}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('demo.bulk_creator.empty_hint')}
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
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      {/* Demo Name */}
                      <div className="space-y-1">
                        <Label className="text-xs">{t('demo.bulk_creator.demo_name')}</Label>
                        <Input
                          placeholder={t('demo.bulk_creator.demo_name_placeholder')}
                          value={demo.name}
                          onChange={(e) => updateDemo(demo.id, 'name', e.target.value)}
                        />
                      </div>
                      
                      {/* Login URL */}
                      <div className="space-y-1">
                        <Label className="text-xs">{t('demo.bulk_creator.login_url')}</Label>
                        <Input
                          // i18n-ignore: sample URL
                          placeholder="https://demo.example.com/login"
                          value={demo.login_url}
                          onChange={(e) => updateDemo(demo.id, 'login_url', e.target.value)}
                        />
                      </div>
                      
                      {/* Demo Type — this is what picks the login-role template */}
                      <div className="space-y-1">
                        <Label className="text-xs">{t('demo.bulk_creator.demo_type')}</Label>
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

                      {/* Category — where the marketplace looks for this demo */}
                      <div className="space-y-1">
                        <Label className="text-xs">{t('demo.bulk_creator.category')}</Label>
                        <Select
                          value={demo.category}
                          onValueChange={(value) => updateDemo(demo.id, 'category', value)}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                categories.length === 0 ? t('demo.bulk_creator.loading') : t('demo.bulk_creator.select_one_of', { count: categories.length })
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
                        {t('demo.bulk_creator.roles_count', { count: demo.login_roles.length })}
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
                        {t('demo.bulk_creator.ready')}
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-500/20 text-yellow-400 gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {t('demo.bulk_creator.incomplete')}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {t('demo.bulk_creator.roles_status', { count: demo.login_roles.length })}
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
              {t('demo.bulk_creator.roles_for', { name: currentDemo?.name || t('demo.bulk_creator.demo_fallback') })}
            </DialogTitle>
          </DialogHeader>
          
          {currentDemo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('demo.bulk_creator.roles_limits')}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addLoginRole(currentDemo.id)}
                  disabled={currentDemo.login_roles.length >= 9}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('demo.bulk_creator.add_role')}
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
                            placeholder={t('demo.bulk_creator.role_name')}
                            value={role.role_name}
                            onChange={(e) => updateLoginRole(currentDemo.id, role.id, 'role_name', e.target.value)}
                          />
                          <Input
                            placeholder={t('demo.bulk_creator.username')}
                            value={role.username}
                            onChange={(e) => updateLoginRole(currentDemo.id, role.id, 'username', e.target.value)}
                          />
                          <div className="relative">
                            <Input
                              type={showPasswords[role.id] ? 'text' : 'password'}
                              placeholder={t('demo.bulk_creator.password')}
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
                  {t('demo.bulk_creator.done')}
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
