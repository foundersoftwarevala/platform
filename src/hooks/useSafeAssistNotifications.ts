/**
 * Safe Assist Notifications Hook
 * Triggers notifications when Safe Assist events occur
 */

import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/contexts/NotificationContext';
import { useNotificationSound } from '@/hooks/useNotificationSound';

export function useSafeAssistNotifications() {
  const { user, userRole } = useAuth();
  const { addNotification } = useNotifications();
  const { playWarning, playCritical, playInfo } = useNotificationSound(userRole || 'developer');

  // Subscribe to Safe Assist session events
  useEffect(() => {
    if (!user) return;

    // Listen for session changes that are relevant to the user
    const sessionChannel = supabase
      .channel('safe-assist-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'safe_assist_sessions',
        },
        async (payload) => {
          const session = payload.new as any;
          
          // Only notify if user is involved in the session
          if (session?.user_id !== user.id && session?.support_agent_id !== user.id) {
            // Check if user is a manager role
            if (!['safe_assist', 'assist_manager', 'super_admin', 'master'].includes(userRole || '')) {
              return;
            }
          }

          if (payload.eventType === 'INSERT') {
            // New session created
            if (['safe_assist', 'assist_manager'].includes(userRole || '')) {
              await addNotification('info', `New Safe Assist session requested`, 'safe_assist_new_session', {
                actionLabel: 'View Session',
                roleTarget: ['safe_assist', 'assist_manager'],
              });
              playInfo();
            }
          } else if (payload.eventType === 'UPDATE') {
            // Session status changed
            if (session.status === 'connected' && session.user_id === user.id) {
              await addNotification('success', 'Support agent has connected to your session', 'safe_assist_connected', {
                isBuzzer: false,
              });
              playInfo();
            } else if (session.status === 'terminated') {
              await addNotification('danger', 'Session was terminated due to security concerns', 'safe_assist_terminated', {
                isBuzzer: true,
                roleTarget: ['safe_assist', 'assist_manager', 'super_admin'],
              });
              playCritical();
            }
          }
        }
      )
      .subscribe();

    // Listen for AI alerts
    const alertChannel = supabase
      .channel('safe-assist-ai-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'safe_assist_ai_logs',
        },
        async (payload) => {
          const alert = payload.new as any;
          
          // Only notify managers and relevant roles
          if (!['safe_assist', 'assist_manager', 'super_admin', 'master'].includes(userRole || '')) {
            return;
          }

          if (alert.risk_level === 'critical') {
            await addNotification('danger', `Critical AI alert: ${alert.event_type}`, 'safe_assist_critical_alert', {
              isBuzzer: true,
              actionLabel: 'Review Now',
              roleTarget: ['safe_assist', 'assist_manager', 'super_admin'],
            });
            playCritical();
          } else if (alert.risk_level === 'high') {
            await addNotification('warning', `High risk detected: ${alert.event_type}`, 'safe_assist_high_alert', {
              actionLabel: 'Review',
              roleTarget: ['safe_assist', 'assist_manager'],
            });
            playWarning();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(alertChannel);
    };
  }, [user, userRole, addNotification, playWarning, playCritical, playInfo]);
}

export default useSafeAssistNotifications;
