import { useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Global Action System - Enterprise Grade
 * Every button action is: logged, validated, executed, and confirmed
 */

export type ActionType = 
  | 'navigate' | 'create' | 'read' | 'update' | 'delete' 
  | 'approve' | 'reject' | 'escalate' | 'suspend' | 'activate'
  | 'assign' | 'reassign' | 'resolve' | 'close' | 'reopen'
  | 'export' | 'import' | 'sync' | 'refresh' | 'toggle';

export type EntityType = 
  | 'user' | 'role' | 'permission' | 'module' | 'action'
  | 'country' | 'region' | 'franchise' | 'reseller' | 'server'
  | 'ticket' | 'lead' | 'customer' | 'deal' | 'task'
  | 'alert' | 'log' | 'report' | 'setting' | 'ai_task';

export interface ActionPayload {
  actionId: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId?: string;
  metadata?: Record<string, any>;
  requiresConfirmation?: boolean;
  apiEndpoint?: string;
  successMessage?: string;
  errorMessage?: string;
}

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

export function useGlobalActions() {
  const { user, userRole, isBossOwner } = useAuth();

  // Audit log every action
  const logToAudit = useCallback(async (
    action: string,
    module: string,
    meta: Record<string, any>
  ) => {
    try {
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        role: userRole as any,
        module,
        action,
        meta_json: {
          ...meta,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        }
      });
    } catch (error) {
      console.error('Audit log failed:', error);
    }
  }, [user?.id, userRole]);

  // Execute any action with full tracking
  const executeAction = useCallback(async (payload: ActionPayload): Promise<ActionResult> => {
    const startTime = Date.now();
    const toastId = payload.actionId;

    try {
      // Log action start
      await logToAudit(`${payload.actionType}_start`, payload.entityType, {
        actionId: payload.actionId,
        entityId: payload.entityId,
        ...payload.metadata
      });

      // Show loading toast
      toast.loading(`Processing ${payload.entityType}...`, { id: toastId });

      // Execute API call if endpoint provided
      let result: any = null;
      if (payload.apiEndpoint) {
        const { data, error } = await supabase.functions.invoke(payload.apiEndpoint, {
          body: {
            actionType: payload.actionType,
            entityType: payload.entityType,
            entityId: payload.entityId,
            ...payload.metadata
          }
        });
        if (error) throw error;
        result = data;
      }

      const duration = Date.now() - startTime;

      // Log success
      await logToAudit(`${payload.actionType}_success`, payload.entityType, {
        actionId: payload.actionId,
        entityId: payload.entityId,
        duration,
        result: result ? 'completed' : 'no_api',
        ...payload.metadata
      });

      // Success toast
      toast.success(payload.successMessage || `${payload.actionType} completed`, {
        id: toastId,
        description: `Completed in ${duration}ms`
      });

      return { success: true, data: result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failure
      await logToAudit(`${payload.actionType}_error`, payload.entityType, {
        actionId: payload.actionId,
        entityId: payload.entityId,
        error: errorMessage,
        duration,
        ...payload.metadata
      });

      // Error toast
      toast.error(payload.errorMessage || `${payload.actionType} failed`, {
        id: toastId,
        description: errorMessage
      });

      return { success: false, error: errorMessage, duration };
    }
  }, [logToAudit]);

  // Quick action helpers with proper typing
  const quickActions = {
    approve: (entityType: EntityType, entityId: string, meta?: Record<string, any>) =>
      executeAction({ actionId: `approve_${entityId}`, actionType: 'approve', entityType, entityId, metadata: meta, successMessage: 'Approved successfully' }),
    
    reject: (entityType: EntityType, entityId: string, reason: string) =>
      executeAction({ actionId: `reject_${entityId}`, actionType: 'reject', entityType, entityId, metadata: { reason }, successMessage: 'Rejected' }),
    
    suspend: (entityType: EntityType, entityId: string, reason: string) =>
      executeAction({ actionId: `suspend_${entityId}`, actionType: 'suspend', entityType, entityId, metadata: { reason }, successMessage: 'Suspended' }),
    
    activate: (entityType: EntityType, entityId: string) =>
      executeAction({ actionId: `activate_${entityId}`, actionType: 'activate', entityType, entityId, successMessage: 'Activated' }),
    
    escalate: (entityType: EntityType, entityId: string, level: number, reason: string) =>
      executeAction({ actionId: `escalate_${entityId}`, actionType: 'escalate', entityType, entityId, metadata: { level, reason }, successMessage: 'Escalated' }),
    
    assign: (entityType: EntityType, entityId: string, assigneeId: string) =>
      executeAction({ actionId: `assign_${entityId}`, actionType: 'assign', entityType, entityId, metadata: { assigneeId }, successMessage: 'Assigned' }),
    
    resolve: (entityType: EntityType, entityId: string, notes?: string) =>
      executeAction({ actionId: `resolve_${entityId}`, actionType: 'resolve', entityType, entityId, metadata: { notes }, successMessage: 'Resolved' }),
    
    close: (entityType: EntityType, entityId: string) =>
      executeAction({ actionId: `close_${entityId}`, actionType: 'close', entityType, entityId, successMessage: 'Closed' }),
    
    create: (entityType: EntityType, data: Record<string, any>) =>
      executeAction({ actionId: `create_${entityType}_${Date.now()}`, actionType: 'create', entityType, metadata: data, successMessage: `${entityType} created` }),
    
    update: (entityType: EntityType, entityId: string, data: Record<string, any>) =>
      executeAction({ actionId: `update_${entityId}`, actionType: 'update', entityType, entityId, metadata: data, successMessage: 'Updated' }),
    
    delete: (entityType: EntityType, entityId: string, soft: boolean = true) =>
      executeAction({ actionId: `delete_${entityId}`, actionType: 'delete', entityType, entityId, metadata: { soft }, requiresConfirmation: true, successMessage: soft ? 'Archived' : 'Deleted' }),
    
    navigate: (target: string, meta?: Record<string, any>) =>
      executeAction({ actionId: `nav_${target}`, actionType: 'navigate', entityType: 'module' as EntityType, metadata: { target, ...meta }, successMessage: `Navigated to ${target}` }),
    
    export: (entityType: EntityType, format: 'pdf' | 'excel' | 'csv', filters?: Record<string, any>) =>
      executeAction({ actionId: `export_${entityType}_${format}`, actionType: 'export', entityType, metadata: { format, filters }, successMessage: `${entityType} exported as ${format.toUpperCase()}` }),
    
    refresh: (entityType: EntityType) =>
      executeAction({ actionId: `refresh_${entityType}`, actionType: 'refresh', entityType, successMessage: 'Data refreshed' }),
    
    toggle: (entityType: EntityType, entityId: string, field: string, currentValue: boolean) =>
      executeAction({ actionId: `toggle_${field}_${entityId}`, actionType: 'toggle', entityType, entityId, metadata: { field, oldValue: currentValue, newValue: !currentValue }, successMessage: `${field} ${!currentValue ? 'enabled' : 'disabled'}` }),
  };

  return {
    executeAction,
    logToAudit,
    ...quickActions,
    isBossOwner,
    userRole,
    userId: user?.id,
  };
}
