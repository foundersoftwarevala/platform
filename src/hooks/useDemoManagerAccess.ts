import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface DemoReportCard {
  id: string;
  demo_id: string;
  demo_name: string;
  sector: string;
  sub_category: string;
  action_type: string;
  performed_by: string;
  performed_by_role: string;
  action_timestamp: string;
  demo_status: string;
  uptime_state: string;
  error_details: string;
  fix_details: string;
  completion_time_seconds: number;
  old_values: any;
  new_values: any;
  auto_registered: boolean;
  workflow_status: string;
  created_at: string;
}

interface UseDemoManagerAccessReturn {
  isDemoManager: boolean;
  canAccessDemos: boolean;
  isLoading: boolean;
  createReportCard: (params: CreateReportCardParams) => Promise<string | null>;
  logUnauthorizedAttempt: (action: string, demoId?: string) => Promise<void>;
  reportCards: DemoReportCard[];
  fetchReportCards: () => Promise<void>;
  updateWorkflowStatus: (reportCardId: string, status: string) => Promise<boolean>;
}

interface CreateReportCardParams {
  demoId?: string;
  demoName: string;
  actionType: 'add' | 'edit' | 'delete' | 'fix' | 'replace_link' | 'approve' | 'reject' | 'health_check' | 'status_update';
  sector?: string;
  subCategory?: string;
  demoStatus?: string;
  uptimeState?: string;
  errorDetails?: string;
  fixDetails?: string;
  oldValues?: any;
  newValues?: any;
}

// Roles that can VIEW demos but NOT modify them
const VIEW_ONLY_ROLES = ['super_admin', 'admin'];

// The ONLY role that can perform demo actions
const DEMO_ACTION_ROLE = 'demo_manager';

export function useDemoManagerAccess(): UseDemoManagerAccessReturn {
  const { user, userRole } = useAuth();
  const [isDemoManager, setIsDemoManager] = useState(false);
  const [canAccessDemos, setCanAccessDemos] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reportCards, setReportCards] = useState<DemoReportCard[]>([]);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setIsDemoManager(false);
        setCanAccessDemos(false);
        setIsLoading(false);
        return;
      }

      try {
        // Check if user is demo_manager
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        const currentRole = roleData?.role || userRole;
        const isManager = currentRole === DEMO_ACTION_ROLE;
        const canView = isManager || VIEW_ONLY_ROLES.includes(currentRole || '');

        setIsDemoManager(isManager);
        setCanAccessDemos(canView);
      } catch (error) {
        console.error('Error checking demo access:', error);
        setIsDemoManager(false);
        setCanAccessDemos(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [user, userRole]);

  // Demo manager actions are recorded in demo_url_audit_log, the demo estate's
  // audit table. A signed-in user may insert there only as themselves
  // (actor_id = auth.uid()); audit_logs takes no browser writes, and
  // demo_report_cards was never created. A report card is one row whose
  // metadata.kind is 'report_card'; workflow changes are appended, not edited.
  const logUnauthorizedAttempt = useCallback(async (action: string, demoId?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('demo_url_audit_log').insert({
        actor_id: user.id,
        actor_email: user.email ?? null,
        action: 'demo.unauthorized_access_attempt',
        metadata: {
          module: 'demo_security',
          role: (userRole || 'client') as AppRole,
          action_attempted: action,
          demo_id: demoId ?? null,
          blocked: true,
          flagged: true,
          timestamp: new Date().toISOString()
        }
      });
      if (error) console.error('Error logging unauthorized attempt:', error);

      toast.error('Access Denied: Only Demo Manager can perform this action', {
        description: 'This attempt has been logged.'
      });
    } catch (error) {
      console.error('Error logging unauthorized attempt:', error);
    }
  }, [user, userRole]);

  const createReportCard = useCallback(async (params: CreateReportCardParams): Promise<string | null> => {
    if (!user) {
      toast.error('You must be logged in');
      return null;
    }

    if (!isDemoManager) {
      await logUnauthorizedAttempt(params.actionType, params.demoId);
      return null;
    }

    try {
      const startTime = Date.now();
      // The id is made here: the log's read policy is admin/boss only, so the
      // inserted row cannot be returned to a demo manager.
      const id = crypto.randomUUID();

      const { error } = await supabase
        .from('demo_url_audit_log')
        .insert({
          id,
          actor_id: user.id,
          actor_email: user.email ?? null,
          action: `demo.${params.actionType}`,
          metadata: {
            kind: 'report_card',
            demo_id: params.demoId ?? null,
            demo_name: params.demoName,
            sector: params.sector ?? null,
            sub_category: params.subCategory ?? null,
            action_type: params.actionType,
            performed_by_role: DEMO_ACTION_ROLE,
            demo_status: params.demoStatus ?? null,
            uptime_state: params.uptimeState ?? null,
            error_details: params.errorDetails ?? null,
            fix_details: params.fixDetails ?? null,
            old_values: params.oldValues ?? null,
            new_values: params.newValues ?? null,
            auto_registered: true,
            workflow_status: 'submitted',
            completion_time_seconds: Math.round((Date.now() - startTime) / 1000)
          }
        });

      if (error) throw error;

      return id;
    } catch (error: any) {
      console.error('Error creating report card:', error);
      toast.error('Failed to create report card');
      return null;
    }
  }, [user, isDemoManager, logUnauthorizedAttempt]);

  const fetchReportCards = useCallback(async () => {
    if (!user) return;

    try {
      const [cards, workflow] = await Promise.all([
        supabase
          .from('demo_url_audit_log')
          .select('id, actor_id, metadata, created_at')
          .eq('metadata->>kind', 'report_card')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('demo_url_audit_log')
          .select('metadata, created_at')
          .eq('action', 'demo.report_card.workflow')
          .order('created_at', { ascending: true })
          .limit(1000)
      ]);

      if (cards.error) throw cards.error;
      if (workflow.error) throw workflow.error;

      // Later workflow entries win.
      const latestStatus = new Map<string, string>();
      for (const row of workflow.data ?? []) {
        const m = (row.metadata ?? {}) as Record<string, any>;
        if (m.report_card_id && m.workflow_status) latestStatus.set(m.report_card_id, m.workflow_status);
      }

      setReportCards((cards.data ?? []).map((row) => {
        const m = (row.metadata ?? {}) as Record<string, any>;
        return {
          id: row.id,
          demo_id: m.demo_id,
          demo_name: m.demo_name,
          sector: m.sector,
          sub_category: m.sub_category,
          action_type: m.action_type,
          performed_by: row.actor_id ?? '',
          performed_by_role: m.performed_by_role,
          action_timestamp: row.created_at,
          demo_status: m.demo_status,
          uptime_state: m.uptime_state,
          error_details: m.error_details,
          fix_details: m.fix_details,
          completion_time_seconds: m.completion_time_seconds,
          old_values: m.old_values,
          new_values: m.new_values,
          auto_registered: m.auto_registered === true,
          workflow_status: latestStatus.get(row.id) ?? m.workflow_status,
          created_at: row.created_at
        } as DemoReportCard;
      }));
    } catch (error) {
      console.error('Error fetching report cards:', error);
    }
  }, [user]);

  const updateWorkflowStatus = useCallback(async (reportCardId: string, status: string): Promise<boolean> => {
    if (!isDemoManager) {
      await logUnauthorizedAttempt('workflow_update');
      return false;
    }
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('demo_url_audit_log')
        .insert({
          actor_id: user.id,
          actor_email: user.email ?? null,
          action: 'demo.report_card.workflow',
          metadata: { kind: 'report_card_workflow', report_card_id: reportCardId, workflow_status: status }
        });

      if (error) throw error;

      setReportCards(prev =>
        prev.map(rc => rc.id === reportCardId ? { ...rc, workflow_status: status } : rc)
      );

      return true;
    } catch (error) {
      console.error('Error updating workflow status:', error);
      return false;
    }
  }, [user, isDemoManager, logUnauthorizedAttempt]);

  return {
    isDemoManager,
    canAccessDemos,
    isLoading,
    createReportCard,
    logUnauthorizedAttempt,
    reportCards,
    fetchReportCards,
    updateWorkflowStatus
  };
}
