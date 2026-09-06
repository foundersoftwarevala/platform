import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, Shield, Save, RefreshCw, Activity, HardDriveDownload,
  CalendarClock, Workflow, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { smMutate } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type SettingValue = Record<string, unknown>;

interface SettingRow {
  id: string;
  setting_key: string;
  setting_value: SettingValue;
  category: string;
  updated_at: string;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Bell }> = {
  monitoring: { label: 'Monitoring', icon: Activity },
  notifications: { label: 'Notifications', icon: Bell },
  security: { label: 'Security', icon: Shield },
  backup: { label: 'Backup', icon: HardDriveDownload },
  maintenance: { label: 'Maintenance', icon: CalendarClock },
  automation: { label: 'Automation', icon: Workflow },
};

const humanize = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const SMSettings = () => {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [draft, setDraft] = useState<Record<string, SettingValue>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('monitoring');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('server_settings')
        .select('id, setting_key, setting_value, category, updated_at')
        .order('category', { ascending: true });

      if (error) {
        console.error('[server-manager] settings failed', error);
        toast.error('Failed to load settings', { description: error.message });
        setLoadError('Could not load settings. Please try again.');
        setRows([]);
        setDraft({});
        return;
      }

      const list = (data ?? []) as unknown as SettingRow[];
      setRows(list);
      setDraft(
        Object.fromEntries(list.map((r) => [r.id, { ...(r.setting_value ?? {}) }])),
      );
      if (list.length > 0 && !list.some((r) => r.category === activeCategory)) {
        setActiveCategory(list[0]!.category);
      }
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category))),
    [rows],
  );

  const visibleRows = rows.filter((r) => r.category === activeCategory);

  const dirty = useMemo(
    () =>
      rows.some(
        (r) => JSON.stringify(r.setting_value) !== JSON.stringify(draft[r.id]),
      ),
    [rows, draft],
  );

  const setField = (rowId: string, field: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const changed = rows.filter(
        (r) => JSON.stringify(r.setting_value) !== JSON.stringify(draft[r.id]),
      );
      if (changed.length === 0) {
        toast.info('No changes to save');
        return;
      }
      const ok = await smMutate(
        'Save settings',
        async () => {
          for (const row of changed) {
            const { error } = await supabase
              .from('server_settings')
              .update({
                setting_value: draft[row.id] as never,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id);
            if (error) return { data: null, error };

            const { error: auditError } = await supabase.from('server_audit_logs').insert({
              action: `Updated setting "${row.setting_key}"`,
              actor: 'admin',
              result: 'success',
              risk_level: row.category === 'security' ? 'high' : 'low',
              details: `Category ${row.category} configuration changed`,
            });
            if (auditError) return { data: null, error: auditError };
          }
          return { data: null, error: null };
        },
        `${changed.length} setting group(s) saved`,
      );
      if (ok) await load();
    } finally {
      setSaving(false);
    }
  };

  const renderField = (row: SettingRow, field: string, value: unknown) => {
    const current = (draft[row.id] ?? {})[field];

    if (typeof value === 'boolean') {
      return (
        <div
          key={field}
          className="flex items-center justify-between p-4 rounded-xl bg-surface/60 border border-border"
        >
          <div>
            <p className="text-foreground font-medium">{humanize(field)}</p>
            <p className="text-muted-foreground text-sm">{row.setting_key}</p>
          </div>
          <Switch
            checked={Boolean(current)}
            onCheckedChange={(checked) => setField(row.id, field, checked)}
          />
        </div>
      );
    }

    if (typeof value === 'number') {
      return (
        <div key={field} className="space-y-2">
          <Label className="text-muted-foreground">{humanize(field)}</Label>
          <Input
            type="number"
            value={String(current ?? '')}
            onChange={(e) => setField(row.id, field, Number(e.target.value))}
          />
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={field} className="space-y-2 md:col-span-2">
          <Label className="text-muted-foreground">{humanize(field)} (comma separated)</Label>
          <Input
            value={(current as unknown[] | undefined)?.join(', ') ?? ''}
            onChange={(e) =>
              setField(
                row.id,
                field,
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            className="font-mono"
          />
        </div>
      );
    }

    return (
      <div key={field} className="space-y-2 md:col-span-2">
        <Label className="text-muted-foreground">{humanize(field)}</Label>
        <Input
          value={String(current ?? '')}
          onChange={(e) => setField(row.id, field, e.target.value)}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Server Manager configuration stored in your cloud backend"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Reload
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || !dirty}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="bento-card p-10 text-center text-muted-foreground">Loading settings…</div>
      ) : rows.length === 0 ? (
        <div className="bento-card p-10 text-center text-muted-foreground">
          No settings found in the backend.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="bento-card lg:col-span-1 h-fit !p-0">
            <CardContent className="p-4 space-y-2">
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat] ?? { label: humanize(cat), icon: Activity };
                const Icon = meta.icon;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      activeCategory === cat
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bento-card lg:col-span-3 !p-0">
            <CardContent className="p-6 space-y-8">
              {visibleRows.map((row) => {
                const entries = Object.entries(row.setting_value ?? {});
                const toggles = entries.filter(([, v]) => typeof v === 'boolean');
                const others = entries.filter(([, v]) => typeof v !== 'boolean');
                return (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold tracking-tight">
                        {humanize(row.setting_key)}
                      </h3>
                      <Badge className="bg-surface text-muted-foreground border border-border">
                        Updated {new Date(row.updated_at).toLocaleString()}
                      </Badge>
                    </div>
                    {toggles.length > 0 && (
                      <div className="space-y-3">
                        {toggles.map(([field, value]) => renderField(row, field, value))}
                      </div>
                    )}
                    {others.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {others.map(([field, value]) => renderField(row, field, value))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SMSettings;
