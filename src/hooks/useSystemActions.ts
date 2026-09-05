/**
 * System-Wide Action Handler
 * Provides unified actions for all manager modules with audit logging,
 * API connections, and state management
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Module definitions
export type SystemModule = 
  | 'product' | 'lead' | 'franchise' | 'reseller' | 'marketing'
  | 'server' | 'support' | 'sales' | 'finance' | 'legal' | 'hr'
  | 'developer' | 'role' | 'customer_support' | 'task' | 'pro';

// Action types
export type SystemAction = 
  | 'create' | 'read' | 'update' | 'delete' | 'soft_delete' | 'restore'
  | 'enable' | 'disable' | 'suspend' | 'activate' | 'pause' | 'resume'
  | 'approve' | 'reject' | 'escalate' | 'assign' | 'reassign' | 'unassign'
  | 'export' | 'import' | 'sync' | 'refresh' | 'duplicate' | 'merge'
  | 'lock' | 'unlock' | 'archive' | 'unarchive' | 'publish' | 'unpublish';

// Status types
export type EntityStatus = 'active' | 'inactive' | 'draft' | 'pending' | 'suspended' | 'archived' | 'deleted';

// Action configuration
export interface SystemActionConfig {
  module: SystemModule;
  action: SystemAction;
  entityType: string;
  entityId?: string;
  entityName?: string;
  data?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data?: unknown) => void;
  onError?: (error: string) => void;
}

// Action result
export interface SystemActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  actionId: string;
}

// Hook state
interface ActionState {
  isLoading: boolean;
  isConfirming: boolean;
  currentAction?: SystemActionConfig;
  lastResult?: SystemActionResult;
}

/**
 * Generate unique action ID
 */
function generateActionId(): string {
  return `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log action to audit system
 */
async function logToAudit(config: SystemActionConfig, result: SystemActionResult) {
  try {
    const { data: session } = await supabase.auth.getSession();
    
    // Log to audit_logs table
    await supabase.from('audit_logs').insert([{
      action: `${config.action}_${config.entityType}`,
      module: config.module,
      user_id: session?.session?.user?.id || null,
      meta_json: JSON.parse(JSON.stringify({
        action_id: result.actionId,
        entity_id: config.entityId || null,
        entity_name: config.entityName || null,
        action_type: config.action,
        success: result.success,
        data: config.data || null,
        error: result.error || null,
        timestamp: result.timestamp
      }))
    }]);

    // For critical actions, also log to blackbox_events
    const criticalActions: SystemAction[] = ['delete', 'suspend', 'lock', 'approve', 'reject'];
    if (criticalActions.includes(config.action)) {
      await supabase.from('blackbox_events').insert([{
        event_type: `${config.module}_${config.action}`,
        module_name: config.module,
        entity_type: config.entityType,
        entity_id: config.entityId,
        user_id: session?.session?.user?.id,
        metadata: JSON.parse(JSON.stringify({
          action_id: result.actionId,
          entity_name: config.entityName || null,
          success: result.success,
          data: config.data || null
        })),
        is_sealed: true
      }]);
    }
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
}

/**
 * Main system actions hook
 */
export function useSystemActions() {
  const [state, setState] = useState<ActionState>({
    isLoading: false,
    isConfirming: false
  });

  /**
   * Execute a system action
   */
  const executeAction = useCallback(async <T = unknown>(
    config: SystemActionConfig,
    handler?: () => Promise<T>
  ): Promise<SystemActionResult<T>> => {
    const actionId = generateActionId();
    const timestamp = new Date().toISOString();

    setState(prev => ({
      ...prev,
      isLoading: true,
      currentAction: config
    }));

    try {
      let data: T | undefined;

      // Execute the handler if provided
      if (handler) {
        data = await handler();
      }

      const result: SystemActionResult<T> = {
        success: true,
        data,
        timestamp,
        actionId
      };

      // Log to audit system
      await logToAudit(config, result);

      // Show success toast
      const successMsg = config.successMessage || 
        `${config.entityType} ${config.action}d successfully`;
      toast.success(successMsg, {
        description: config.entityName ? `Target: ${config.entityName}` : undefined
      });

      // Callback
      config.onSuccess?.(data);

      setState(prev => ({
        ...prev,
        isLoading: false,
        lastResult: result as SystemActionResult
      }));

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      const result: SystemActionResult<T> = {
        success: false,
        error: errorMessage,
        timestamp,
        actionId
      };

      // Log failed action
      await logToAudit(config, result);

      // Show error toast
      const errorMsg = config.errorMessage || `Failed to ${config.action} ${config.entityType}`;
      toast.error(errorMsg, { description: errorMessage });

      // Callback
      config.onError?.(errorMessage);

      setState(prev => ({
        ...prev,
        isLoading: false,
        lastResult: result as SystemActionResult
      }));

      return result;
    }
  }, []);

  /**
   * Confirm action before execution
   */
  const confirmAction = useCallback((config: SystemActionConfig) => {
    setState(prev => ({
      ...prev,
      isConfirming: true,
      currentAction: config
    }));
  }, []);

  /**
   * Cancel confirmation
   */
  const cancelConfirmation = useCallback(() => {
    setState(prev => ({
      ...prev,
      isConfirming: false,
      currentAction: undefined
    }));
  }, []);

  /**
   * Proceed with confirmed action
   */
  const proceedWithAction = useCallback(async <T = unknown>(
    handler?: () => Promise<T>
  ): Promise<SystemActionResult<T> | null> => {
    if (!state.currentAction) return null;
    
    const config = state.currentAction;
    setState(prev => ({ ...prev, isConfirming: false }));
    
    return executeAction(config, handler);
  }, [state.currentAction, executeAction]);

  // Pre-built action helpers
  const actions = {
    // CRUD Operations
    create: useCallback((module: SystemModule, entityType: string, data?: Record<string, unknown>, name?: string) =>
      executeAction({
        module,
        action: 'create',
        entityType,
        entityName: name,
        data,
        successMessage: `${entityType} created successfully`
      }), [executeAction]),

    read: useCallback((module: SystemModule, entityType: string, entityId?: string, name?: string) =>
      executeAction({
        module,
        action: 'read',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} loaded successfully`
      }), [executeAction]),

    update: useCallback((module: SystemModule, entityType: string, entityId: string, data?: Record<string, unknown>, name?: string) =>
      executeAction({
        module,
        action: 'update',
        entityType,
        entityId,
        entityName: name,
        data,
        successMessage: `${entityType} updated successfully`
      }), [executeAction]),

    delete: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      confirmAction({
        module,
        action: 'delete',
        entityType,
        entityId,
        entityName: name,
        requiresConfirmation: true,
        confirmTitle: `Delete ${entityType}?`,
        confirmMessage: `Are you sure you want to delete ${name || entityType}? This action cannot be undone.`
      }), [confirmAction]),

    softDelete: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'soft_delete',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} moved to trash`
      }), [executeAction]),

    restore: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'restore',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} restored successfully`
      }), [executeAction]),

    // Status Operations
    enable: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'enable',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} enabled`
      }), [executeAction]),

    disable: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'disable',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} disabled`
      }), [executeAction]),

    suspend: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      confirmAction({
        module,
        action: 'suspend',
        entityType,
        entityId,
        entityName: name,
        requiresConfirmation: true,
        confirmTitle: `Suspend ${entityType}?`,
        confirmMessage: `This will suspend ${name || entityType} and restrict all access.`
      }), [confirmAction]),

    activate: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'activate',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} activated`
      }), [executeAction]),

    pause: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'pause',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} paused`
      }), [executeAction]),

    resume: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'resume',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} resumed`
      }), [executeAction]),

    // Workflow Operations
    approve: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'approve',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} approved`
      }), [executeAction]),

    reject: useCallback((module: SystemModule, entityType: string, entityId: string, reason?: string, name?: string) =>
      executeAction({
        module,
        action: 'reject',
        entityType,
        entityId,
        entityName: name,
        data: { reason },
        successMessage: `${entityType} rejected`
      }), [executeAction]),

    escalate: useCallback((module: SystemModule, entityType: string, entityId: string, level?: string, name?: string) =>
      executeAction({
        module,
        action: 'escalate',
        entityType,
        entityId,
        entityName: name,
        data: { level },
        successMessage: `${entityType} escalated`
      }), [executeAction]),

    assign: useCallback((module: SystemModule, entityType: string, entityId: string, assigneeId: string, name?: string) =>
      executeAction({
        module,
        action: 'assign',
        entityType,
        entityId,
        entityName: name,
        data: { assigneeId },
        successMessage: `${entityType} assigned`
      }), [executeAction]),

    // Data Operations
    export: useCallback((module: SystemModule, entityType: string, format?: string) =>
      executeAction({
        module,
        action: 'export',
        entityType,
        data: { format },
        successMessage: `${entityType} export started`
      }), [executeAction]),

    import: useCallback((module: SystemModule, entityType: string, data?: Record<string, unknown>) =>
      executeAction({
        module,
        action: 'import',
        entityType,
        data,
        successMessage: `${entityType} import completed`
      }), [executeAction]),

    sync: useCallback((module: SystemModule, entityType: string) =>
      executeAction({
        module,
        action: 'sync',
        entityType,
        successMessage: `${entityType} synced`
      }), [executeAction]),

    refresh: useCallback((module: SystemModule, entityType: string) =>
      executeAction({
        module,
        action: 'refresh',
        entityType,
        successMessage: `${entityType} refreshed`
      }), [executeAction]),

    // Archive Operations
    archive: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'archive',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} archived`
      }), [executeAction]),

    publish: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'publish',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} published`
      }), [executeAction]),

    lock: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'lock',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} locked`
      }), [executeAction]),

    unlock: useCallback((module: SystemModule, entityType: string, entityId: string, name?: string) =>
      executeAction({
        module,
        action: 'unlock',
        entityType,
        entityId,
        entityName: name,
        successMessage: `${entityType} unlocked`
      }), [executeAction]),
  };

  return {
    ...state,
    executeAction,
    confirmAction,
    cancelConfirmation,
    proceedWithAction,
    actions
  };
}

/**
 * Create module-specific action helpers
 */
export function createModuleActions(module: SystemModule) {
  return {
    create: (entityType: string, data?: Record<string, unknown>) => ({
      module, action: 'create' as SystemAction, entityType, data
    }),
    update: (entityType: string, entityId: string, data?: Record<string, unknown>) => ({
      module, action: 'update' as SystemAction, entityType, entityId, data
    }),
    delete: (entityType: string, entityId: string) => ({
      module, action: 'delete' as SystemAction, entityType, entityId, requiresConfirmation: true
    }),
    enable: (entityType: string, entityId: string) => ({
      module, action: 'enable' as SystemAction, entityType, entityId
    }),
    disable: (entityType: string, entityId: string) => ({
      module, action: 'disable' as SystemAction, entityType, entityId
    }),
    suspend: (entityType: string, entityId: string) => ({
      module, action: 'suspend' as SystemAction, entityType, entityId, requiresConfirmation: true
    }),
    approve: (entityType: string, entityId: string) => ({
      module, action: 'approve' as SystemAction, entityType, entityId
    }),
    reject: (entityType: string, entityId: string, reason?: string) => ({
      module, action: 'reject' as SystemAction, entityType, entityId, data: { reason }
    }),
    export: (entityType: string, format?: string) => ({
      module, action: 'export' as SystemAction, entityType, data: { format }
    }),
    refresh: (entityType: string) => ({
      module, action: 'refresh' as SystemAction, entityType
    }),
  };
}

// Pre-built module action factories
export const productModuleActions = createModuleActions('product');
export const leadModuleActions = createModuleActions('lead');
export const franchiseModuleActions = createModuleActions('franchise');
export const resellerModuleActions = createModuleActions('reseller');
export const marketingModuleActions = createModuleActions('marketing');
export const serverModuleActions = createModuleActions('server');
export const supportModuleActions = createModuleActions('support');
export const financeModuleActions = createModuleActions('finance');
export const legalModuleActions = createModuleActions('legal');
export const developerModuleActions = createModuleActions('developer');
export const roleModuleActions = createModuleActions('role');
