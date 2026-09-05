import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useEndSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('safe_assist_sessions')
        .update({ 
          status: 'ended', 
          ended_at: new Date().toISOString() 
        })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safe-assist-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['safe-assist-metrics'] });
      toast.success('Session ended successfully');
    },
    onError: (error) => {
      toast.error('Failed to end session: ' + error.message);
    },
  });
}

export function useTerminateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, reason }: { sessionId: string; reason?: string }) => {
      // End the session (using 'ended' status since 'terminated' isn't in enum)
      const { error: sessionError } = await supabase
        .from('safe_assist_sessions')
        .update({ 
          status: 'ended', 
          ended_at: new Date().toISOString() 
        })
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      // Log AI alert for termination
      const { error: logError } = await supabase
        .from('safe_assist_ai_logs')
        .insert({
          session_id: sessionId,
          event_type: 'manual_termination',
          risk_level: 'high',
          ai_analysis: { reason: reason || 'Manually terminated by admin' },
          action_recommended: 'session_terminated'
        });

      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safe-assist-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['safe-assist-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['safe-assist-metrics'] });
      toast.success('Session terminated');
    },
    onError: (error) => {
      toast.error('Failed to terminate session: ' + error.message);
    },
  });
}
