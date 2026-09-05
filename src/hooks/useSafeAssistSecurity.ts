/**
 * Safe Assist Security Hook
 * Implements zero-trust security for Safe Assist sessions
 * 
 * FORBIDDEN ACTIONS:
 * - Wallet access
 * - Password changes
 * - Role modifications
 * - Admin routes
 * - Payment processing
 * - Profile modifications during session
 */

import { useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Absolutely forbidden routes during Safe Assist
const FORBIDDEN_ROUTES = [
  '/wallet',
  '/wallet/',
  '/settings/security',
  '/settings/password',
  '/admin',
  '/admin/',
  '/super-admin',
  '/super-admin/',
  '/master',
  '/master/',
  '/payments',
  '/checkout',
  '/withdrawal',
  '/payout',
  '/role-management',
  '/user-management',
];

// Partial matches (routes containing these)
const FORBIDDEN_ROUTE_PATTERNS = [
  'wallet',
  'password',
  'payout',
  'withdrawal',
  'checkout',
  'payment',
  '/admin',
  'role-change',
  'api-key',
  'secret',
];

// Forbidden actions that should be blocked
const FORBIDDEN_ACTIONS = [
  'wallet_view',
  'wallet_transaction',
  'password_change',
  'role_modify',
  'admin_access',
  'payment_process',
  'profile_edit',
  'api_key_access',
  'secret_view',
];

interface SafeAssistSecurityState {
  isSessionActive: boolean;
  sessionId: string | null;
  blockedAttempts: number;
  lastBlockedRoute: string | null;
}

export function useSafeAssistSecurity() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const stateRef = useRef<SafeAssistSecurityState>({
    isSessionActive: false,
    sessionId: null,
    blockedAttempts: 0,
    lastBlockedRoute: null,
  });

  // Check if current route is forbidden
  const isRouteForbidden = useCallback((path: string): boolean => {
    const lowerPath = path.toLowerCase();
    
    // Direct match
    if (FORBIDDEN_ROUTES.some(route => lowerPath === route || lowerPath.startsWith(route))) {
      return true;
    }
    
    // Pattern match
    if (FORBIDDEN_ROUTE_PATTERNS.some(pattern => lowerPath.includes(pattern))) {
      return true;
    }
    
    return false;
  }, []);

  // Log security violation to database
  const logSecurityViolation = useCallback(async (
    sessionId: string,
    violationType: string,
    details: { [key: string]: string | number | boolean }
  ) => {
    try {
      await supabase.rpc('log_safe_assist_ai_event', {
        p_session_id: sessionId,
        p_event_type: violationType,
        p_risk_level: 'critical',
        p_analysis: details as unknown as Record<string, never>,
        p_recommended_action: 'session_terminate',
        p_auto_handle: violationType === 'forbidden_route_access'
      });

      // Also log to audit
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'safe_assist_security_violation',
        module: 'safe_assist',
        meta_json: {
          session_id: sessionId,
          violation_type: violationType,
          ...details
        } as unknown as Record<string, never>
      });
    } catch (error) {
      console.error('Failed to log security violation:', error);
    }
  }, [user]);

  // Block forbidden route access
  const blockRouteAccess = useCallback(async (path: string) => {
    if (!stateRef.current.sessionId) return;
    
    stateRef.current.blockedAttempts++;
    stateRef.current.lastBlockedRoute = path;
    
    toast.error('Access Blocked', {
      description: 'This area is not accessible during Safe Assist sessions for security.',
    });
    
    await logSecurityViolation(stateRef.current.sessionId, 'forbidden_route_access', {
      attempted_route: path,
      blocked_count: stateRef.current.blockedAttempts,
      timestamp: new Date().toISOString()
    });
    
    // Navigate away from forbidden route
    navigate('/dashboard', { replace: true });
    
    // If too many attempts, auto-terminate session
    if (stateRef.current.blockedAttempts >= 3) {
      toast.error('Session Terminated', {
        description: 'Multiple attempts to access restricted areas detected.',
      });
      
      await terminateSession('security_violation_multiple_attempts');
    }
  }, [navigate, logSecurityViolation]);

  // Terminate session for security reasons
  const terminateSession = useCallback(async (reason: string) => {
    if (!stateRef.current.sessionId) return;
    
    try {
      await supabase
        .from('safe_assist_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          end_reason: `SECURITY: ${reason}`
        })
        .eq('id', stateRef.current.sessionId);
      
      await logSecurityViolation(stateRef.current.sessionId, 'security_termination', {
        reason,
        terminated_at: new Date().toISOString()
      });
      
      stateRef.current.isSessionActive = false;
      stateRef.current.sessionId = null;
    } catch (error) {
      console.error('Failed to terminate session:', error);
    }
  }, [logSecurityViolation]);

  // Check for active session
  const checkActiveSession = useCallback(async () => {
    if (!user?.id) return false;
    
    try {
      const { data } = await supabase
        .from('safe_assist_sessions')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        stateRef.current.isSessionActive = true;
        stateRef.current.sessionId = data.id;
        return true;
      }
      
      stateRef.current.isSessionActive = false;
      stateRef.current.sessionId = null;
      return false;
    } catch {
      return false;
    }
  }, [user]);

  // Validate action is allowed
  const validateAction = useCallback(async (actionType: string): Promise<boolean> => {
    if (!stateRef.current.isSessionActive) return true;
    
    if (FORBIDDEN_ACTIONS.includes(actionType)) {
      toast.error('Action Blocked', {
        description: 'This action is not allowed during Safe Assist sessions.',
      });
      
      await logSecurityViolation(stateRef.current.sessionId!, 'forbidden_action', {
        action_type: actionType,
        timestamp: new Date().toISOString()
      });
      
      return false;
    }
    
    return true;
  }, [logSecurityViolation]);

  // Monitor route changes
  useEffect(() => {
    if (!stateRef.current.isSessionActive) return;
    
    if (isRouteForbidden(location.pathname)) {
      blockRouteAccess(location.pathname);
    }
  }, [location.pathname, isRouteForbidden, blockRouteAccess]);

  // Check session status on mount and periodically
  useEffect(() => {
    checkActiveSession();
    
    const interval = setInterval(checkActiveSession, 10000); // Check every 10s
    
    return () => clearInterval(interval);
  }, [checkActiveSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stateRef.current = {
        isSessionActive: false,
        sessionId: null,
        blockedAttempts: 0,
        lastBlockedRoute: null,
      };
    };
  }, []);

  return {
    isSessionActive: stateRef.current.isSessionActive,
    sessionId: stateRef.current.sessionId,
    blockedAttempts: stateRef.current.blockedAttempts,
    validateAction,
    terminateSession,
    isRouteForbidden,
    checkActiveSession,
  };
}

// Hook to use for protecting specific components
export function useProtectedAction() {
  const { validateAction, isSessionActive, terminateSession } = useSafeAssistSecurity();
  
  const protectedAction = useCallback(async (
    actionType: string, 
    action: () => Promise<void> | void
  ) => {
    const isAllowed = await validateAction(actionType);
    if (isAllowed) {
      await action();
    }
  }, [validateAction]);
  
  return { 
    protectedAction, 
    isSessionActive, 
    terminateSession 
  };
}
