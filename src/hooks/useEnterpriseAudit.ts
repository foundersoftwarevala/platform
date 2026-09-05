/**
 * JIRA-SEC-02: Enterprise-Grade Immutable Audit System
 * All buttons, actions, and system events logged here
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AuditModule = 
  | 'lead_manager' 
  | 'franchise_manager' 
  | 'reseller_manager' 
  | 'server_manager' 
  | 'authentication'
  | 'access_control'
  | 'finance'
  | 'ai_system'
  | 'data_protection'
  | 'system'
  | 'vala_builder'
  | 'server_orchestration'
  | 'validation'
  | 'source_protection'
  | 'boss_dashboard'
  | 'continent_dashboard';

export interface AuditEntry {
  action: string;
  module: AuditModule;
  severity: AuditSeverity;
  target_id?: string;
  target_type?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
}

interface DeviceInfo {
  user_agent: string;
  screen: string;
  timezone: string;
  language: string;
  platform: string;
}

const getDeviceInfo = (): DeviceInfo => ({
  user_agent: navigator.userAgent,
  screen: `${screen.width}x${screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  language: navigator.language,
  platform: navigator.platform || 'unknown',
});

export function useEnterpriseAudit() {
  /**
   * Core audit logging - immutable entry
   */
  const logAction = useCallback(async (entry: AuditEntry): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Log entry even without user for system events
      const userId = user?.id || null;
      const deviceInfo = getDeviceInfo();

      // Primary audit log (immutable)
      const { error: auditError } = await supabase.from('audit_logs').insert([{
        user_id: userId,
        action: entry.action,
        module: entry.module,
        meta_json: JSON.parse(JSON.stringify({
          severity: entry.severity,
          target_id: entry.target_id,
          target_type: entry.target_type,
          old_values: entry.old_values,
          new_values: entry.new_values,
          reason: entry.reason,
          device_info: deviceInfo,
          timestamp: new Date().toISOString(),
          ...entry.metadata,
        }))
      }]);

      if (auditError) {
        console.error('[AUDIT] Primary log failed:', auditError);
        return false;
      }

      // For high/critical actions, also log to blackbox_events (immutable)
      if (entry.severity === 'critical' || entry.severity === 'high') {
        const riskScore = entry.severity === 'critical' ? 90 : 70;
        
        await supabase.from('blackbox_events').insert([{
          event_type: entry.action,
          module_name: entry.module,
          user_id: userId,
          entity_id: entry.target_id || null,
          entity_type: entry.target_type || null,
          is_sealed: true,
          risk_score: riskScore,
          metadata: JSON.parse(JSON.stringify({
            old_values: entry.old_values,
            new_values: entry.new_values,
            reason: entry.reason,
            device_info: deviceInfo,
          }))
        }]);
      }

      return true;
    } catch (err) {
      console.error('[AUDIT] Logging failed:', err);
      return false;
    }
  }, []);

  /**
   * Button click audit
   */
  const logButtonClick = useCallback(async (
    buttonId: string,
    buttonLabel: string,
    module: AuditModule,
    context?: Record<string, unknown>
  ): Promise<void> => {
    await logAction({
      action: `button_click:${buttonId}`,
      module,
      severity: 'low',
      metadata: {
        button_label: buttonLabel,
        ...context,
      }
    });
  }, [logAction]);

  /**
   * API call audit
   */
  const logApiCall = useCallback(async (
    endpoint: string,
    method: string,
    module: AuditModule,
    success: boolean,
    responseCode?: number,
    errorMessage?: string
  ): Promise<void> => {
    await logAction({
      action: `api_call:${method}:${endpoint}`,
      module,
      severity: success ? 'low' : 'medium',
      metadata: {
        method,
        endpoint,
        success,
        response_code: responseCode,
        error: errorMessage,
      }
    });
  }, [logAction]);

  /**
   * CRUD operation audit
   */
  const logCrudOperation = useCallback(async (
    operation: 'create' | 'read' | 'update' | 'delete' | 'soft_delete',
    entityType: string,
    entityId: string,
    module: AuditModule,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>
  ): Promise<void> => {
    const severityMap: Record<string, AuditSeverity> = {
      create: 'low',
      read: 'low',
      update: 'medium',
      delete: 'high',
      soft_delete: 'medium',
    };

    await logAction({
      action: `crud:${operation}`,
      module,
      severity: severityMap[operation],
      target_id: entityId,
      target_type: entityType,
      old_values: oldValues,
      new_values: newValues,
    });
  }, [logAction]);

  /**
   * AI action audit (never auto-execute)
   */
  const logAiAction = useCallback(async (
    actionType: string,
    targetId: string,
    suggestion: string,
    confidence: number,
    humanApproved: boolean
  ): Promise<void> => {
    await logAction({
      action: `ai:${actionType}`,
      module: 'ai_system',
      severity: humanApproved ? 'medium' : 'low',
      target_id: targetId,
      metadata: {
        suggestion,
        confidence,
        human_approved: humanApproved,
        auto_executed: false, // AI never auto-executes
      }
    });
  }, [logAction]);

  /**
   * Security event audit
   */
  const logSecurityEvent = useCallback(async (
    eventType: 'login' | 'logout' | 'failed_login' | 'permission_denied' | 'session_expired' | 'role_change',
    details?: Record<string, unknown>
  ): Promise<void> => {
    const severityMap: Record<string, AuditSeverity> = {
      login: 'low',
      logout: 'low',
      failed_login: 'medium',
      permission_denied: 'high',
      session_expired: 'low',
      role_change: 'critical',
    };

    await logAction({
      action: `security:${eventType}`,
      module: 'authentication',
      severity: severityMap[eventType] || 'medium',
      metadata: details,
    });
  }, [logAction]);

  /**
   * Financial action audit
   */
  const logFinancialAction = useCallback(async (
    actionType: 'payout' | 'commission' | 'refund' | 'adjustment',
    amount: number,
    currency: string,
    targetId: string,
    reason?: string
  ): Promise<void> => {
    await logAction({
      action: `finance:${actionType}`,
      module: 'finance',
      severity: amount > 10000 ? 'critical' : 'high',
      target_id: targetId,
      target_type: 'transaction',
      new_values: { amount, currency },
      reason,
    });
  }, [logAction]);

  return {
    logAction,
    logButtonClick,
    logApiCall,
    logCrudOperation,
    logAiAction,
    logSecurityEvent,
    logFinancialAction,
  };
}
