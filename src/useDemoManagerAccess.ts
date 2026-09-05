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

  const logUnauthorizedAttempt = useCallback(async (action: string, demoId?: string) => {
    if (!user) return;

    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'unauthorized_demo_access_attempt',
        module: 'demo_security',
        role: (userRole || 'client') as AppRole,
        meta_json: {
          action_attempted: action,
          demo_id: demoId,
          blocked: true,
          flagged: true,
          timestamp: new Date().toISOString()
        }
      });

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
      
      const { data, error } = await supabase
        .from('demo_report_cards')
        .insert({
          demo_id: params.demoId,
          demo_name: params.demoName,
          sector: params.sector,
          sub_category: params.subCategory,
          action_type: params.actionType,
          performed_by: user.id,
          performed_by_role: DEMO_ACTION_ROLE,
          demo_status: params.demoStatus,
          uptime_state: params.uptimeState,
          error_details: params.errorDetails,
          fix_details: params.fixDetails,
          old_values: params.oldValues,
          new_values: params.newValues,
          auto_registered: true,
          workflow_status: 'submitted',
          completion_time_seconds: Math.round((Date.now() - startTime) / 1000)
        })
        .select('id')
        .single();

      if (error) throw error;

      // Also log to audit_logs
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: params.actionType,
        module: 'demo',
        role: DEMO_ACTION_ROLE as AppRole,
        meta_json: {
          demo_id: params.demoId,
          demo_name: params.demoName,
          report_card_id: data.id,
          auto_registered: true
        }
      });

      return data.id;
    } catch (error: any) {
      console.error('Error creating report card:', error);
      toast.error('Failed to create report card');
      return null;
    }
  }, [user, isDemoManager, logUnauthorizedAttempt]);

  const fetchReportCards = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('demo_report_cards')
        .select('*')
        .order('action_timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setReportCards((data ?? []) as unknown as DemoReportCard[]);
    } catch (error) {
      console.error('Error fetching report cards:', error);
    }
  }, [user]);

  const updateWorkflowStatus = useCallback(async (reportCardId: string, status: string): Promise<boolean> => {
    if (!isDemoManager) {
      await logUnauthorizedAttempt('workflow_update');
      return false;
    }

    try {
      const { error } = await supabase
        .from('demo_report_cards')
        .update({ workflow_status: status })
        .eq('id', reportCardId);

      if (error) throw error;

      setReportCards(prev => 
        prev.map(rc => rc.id === reportCardId ? { ...rc, workflow_status: status } : rc)
      );

      return true;
    } catch (error) {
      console.error('Error updating workflow status:', error);
      return false;
    }
  }, [isDemoManager, logUnauthorizedAttempt]);

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
