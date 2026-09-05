import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface SafeAssistSession {
  id: string;
  session_code: string;
  user_id: string;
  user_role: string;
  support_agent_id: string | null;
  status: string;
  mode: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  user_consent_given: boolean;
  dual_verified: boolean;
  ai_risk_score: number;
  ai_monitoring_enabled: boolean;
  agent_masked_id: string | null;
}

export interface SafeAssistAlert {
  id: string;
  session_id: string;
  event_type: string;
  risk_level: string;
  ai_analysis: any;
  action_recommended: string | null;
  timestamp: string;
}

export interface SafeAssistMetrics {
  activeSessions: number;
  totalToday: number;
  avgDuration: string;
  aiAlerts: number;
  terminatedByAI: number;
  satisfactionRate: number;
}

export function useSafeAssistSessions() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('safe-assist-sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safe_assist_sessions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['safe-assist-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['safe-assist-metrics'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ['safe-assist-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safe_assist_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as SafeAssistSession[];
    },
  });
}

export function useSafeAssistAlerts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('safe-assist-alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safe_assist_ai_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['safe-assist-alerts'] });
        queryClient.invalidateQueries({ queryKey: ['safe-assist-metrics'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ['safe-assist-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safe_assist_ai_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as SafeAssistAlert[];
    },
  });
}

export function useSafeAssistMetrics() {
  return useQuery({
    queryKey: ['safe-assist-metrics'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get active sessions
      const { data: activeSessions, error: activeError } = await supabase
        .from('safe_assist_sessions')
        .select('id')
        .in('status', ['active', 'pending']);

      if (activeError) throw activeError;

      // Get today's sessions
      const { data: todaySessions, error: todayError } = await supabase
        .from('safe_assist_sessions')
        .select('id, started_at, ended_at')
        .gte('created_at', today.toISOString());

      if (todayError) throw todayError;

      // Get AI alerts today
      const { data: alerts, error: alertsError } = await supabase
        .from('safe_assist_ai_logs')
        .select('id, risk_level')
        .gte('timestamp', today.toISOString());

      if (alertsError) throw alertsError;

      // Calculate average duration
      let totalDuration = 0;
      let sessionCount = 0;
      (todaySessions || []).forEach((s: any) => {
        if (s.started_at && s.ended_at) {
          totalDuration += new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
          sessionCount++;
        }
      });
      const avgMs = sessionCount > 0 ? totalDuration / sessionCount : 0;
      const avgMinutes = Math.floor(avgMs / 60000);
      const avgSeconds = Math.floor((avgMs % 60000) / 1000);

      const terminatedByAI = (alerts || []).filter((a: any) => 
        a.risk_level === 'critical'
      ).length;

      return {
        activeSessions: (activeSessions || []).length,
        totalToday: (todaySessions || []).length,
        avgDuration: sessionCount > 0 ? `${avgMinutes}:${avgSeconds.toString().padStart(2, '0')}` : '0:00',
        aiAlerts: (alerts || []).length,
        terminatedByAI,
        satisfactionRate: 96, // Would come from feedback table
      } as SafeAssistMetrics;
    },
  });
}
