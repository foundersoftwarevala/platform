/**
 * Safe Assist Security Provider
 * Wraps the app to enforce security during Safe Assist sessions
 * Blocks forbidden actions and routes in real-time
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { SafeAssistActiveBanner } from './SafeAssistActiveBanner';

// Forbidden routes - absolute no access during Safe Assist
const FORBIDDEN_ROUTES = new Set([
  '/wallet',
  '/settings/security',
  '/settings/password', 
  '/admin',
  '/super-admin',
  '/master',
  '/payments',
  '/checkout',
  '/withdrawal',
  '/payout',
  '/role-management',
]);

const FORBIDDEN_PATTERNS = [
  /\/wallet/i,
  /\/payout/i,
  /\/withdrawal/i,
  /\/password/i,
  /\/admin/i,
  /\/payment/i,
  /\/checkout/i,
  /api-key/i,
];

interface SafeAssistSecurityContextType {
  isSessionActive: boolean;
  sessionId: string | null;
  canAccessRoute: (path: string) => boolean;
  validateAction: (action: string) => Promise<boolean>;
  endSession: () => Promise<void>;
}

const SafeAssistSecurityContext = createContext<SafeAssistSecurityContextType>({
  isSessionActive: false,
  sessionId: null,
  canAccessRoute: () => true,
  validateAction: async () => true,
  endSession: async () => {},
});

export function useSafeAssistSecurityContext() {
  return useContext(SafeAssistSecurityContext);
}

interface Props {
  children: React.ReactNode;
}

export function SafeAssistSecurityProvider({ children }: Props) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [violationCount, setViolationCount] = useState(0);

  // Check for active session
  const checkSession = useCallback(async () => {
    if (!user?.id) {
      setIsSessionActive(false);
      setSessionId(null);
      return;
    }

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
        setIsSessionActive(true);
        setSessionId(data.id);
      } else {
        setIsSessionActive(false);
        setSessionId(null);
      }
    } catch {
      setIsSessionActive(false);
      setSessionId(null);
    }
  }, [user?.id]);

  // Check if route is forbidden
  const isRouteForbidden = useCallback((path: string): boolean => {
    const lowerPath = path.toLowerCase();
    
    if (FORBIDDEN_ROUTES.has(lowerPath)) return true;
    if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(lowerPath))) return true;
    
    return false;
  }, []);

  // Can access route
  const canAccessRoute = useCallback((path: string): boolean => {
    if (!isSessionActive) return true;
    return !isRouteForbidden(path);
  }, [isSessionActive, isRouteForbidden]);

  // Log violation
  const logViolation = useCallback(async (type: string, details: { [key: string]: string | number | boolean }) => {
    if (!sessionId) return;

    try {
      await supabase.rpc('log_safe_assist_ai_event', {
        p_session_id: sessionId,
        p_event_type: type,
        p_risk_level: 'critical',
        p_analysis: details as unknown as Record<string, never>,
        p_recommended_action: 'block_and_alert',
        p_auto_handle: false
      });
    } catch (error) {
      console.error('Failed to log violation:', error);
    }
  }, [sessionId]);

  // Validate action
  const validateAction = useCallback(async (action: string): Promise<boolean> => {
    if (!isSessionActive) return true;

    const forbiddenActions = [
      'wallet_access', 'password_change', 'role_modify',
      'payment_process', 'admin_access', 'api_key_view'
    ];

    if (forbiddenActions.includes(action)) {
      toast.error('Action Blocked', {
        description: 'This action is not available during Safe Assist sessions.'
      });
      
      await logViolation('forbidden_action_attempt', { action, timestamp: new Date().toISOString() });
      return false;
    }

    return true;
  }, [isSessionActive, logViolation]);

  // End session
  const endSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await supabase
        .from('safe_assist_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          end_reason: 'User ended session'
        })
        .eq('id', sessionId);

      setIsSessionActive(false);
      setSessionId(null);
      setViolationCount(0);
      
      toast.success('Safe Assist session ended');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [sessionId]);

  // Monitor route changes
  useEffect(() => {
    if (!isSessionActive) return;

    if (isRouteForbidden(location.pathname)) {
      setViolationCount(prev => prev + 1);
      
      toast.error('Access Blocked', {
        description: 'This area is restricted during Safe Assist sessions for your security.'
      });
      
      logViolation('forbidden_route_access', {
        attempted_route: location.pathname,
        violation_count: violationCount + 1
      });
      
      navigate('/dashboard', { replace: true });
      
      // Auto-terminate after 3 violations
      if (violationCount >= 2) {
        toast.error('Session Terminated', {
          description: 'Multiple security violations detected.'
        });
        endSession();
      }
    }
  }, [location.pathname, isSessionActive, isRouteForbidden, navigate, logViolation, violationCount, endSession]);

  // Check session on mount and subscribe to changes
  useEffect(() => {
    checkSession();

    if (!user?.id) return;

    const channel = supabase
      .channel('safe-assist-security')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'safe_assist_sessions',
        filter: `user_id=eq.${user.id}`
      }, () => {
        checkSession();
      })
      .subscribe();

    const interval = setInterval(checkSession, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user?.id, checkSession]);

  const contextValue: SafeAssistSecurityContextType = {
    isSessionActive,
    sessionId,
    canAccessRoute,
    validateAction,
    endSession,
  };

  return (
    <SafeAssistSecurityContext.Provider value={contextValue}>
      {isSessionActive && <SafeAssistActiveBanner />}
      <div className={isSessionActive ? 'pt-10' : ''}>
        {children}
      </div>
    </SafeAssistSecurityContext.Provider>
  );
}

export default SafeAssistSecurityProvider;
