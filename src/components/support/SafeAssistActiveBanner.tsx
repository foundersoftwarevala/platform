/**
 * Safe Assist Active Banner
 * Always visible thin banner when session is active
 * User can always stop the session instantly
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, Eye, Bot, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ActiveSession {
  id: string;
  status: string;
  ai_risk_score: number;
  started_at: string;
  agent_masked_id?: string;
}

export function SafeAssistActiveBanner() {
  const { user } = useAuth();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isEnding, setIsEnding] = useState(false);

  // Check for active session
  useEffect(() => {
    if (!user?.id) return;

    const checkSession = async () => {
      const { data } = await supabase
        .from('safe_assist_sessions')
        .select('id, status, ai_risk_score, started_at, agent_masked_id')
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setSession(data as ActiveSession);
      } else {
        setSession(null);
      }
    };

    checkSession();

    // Subscribe to session changes
    const channel = supabase
      .channel('active-session-banner')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'safe_assist_sessions',
        filter: `user_id=eq.${user.id}`
      }, () => {
        checkSession();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Timer for elapsed time
  useEffect(() => {
    if (!session?.started_at) return;

    const startTime = new Date(session.started_at).getTime();
    
    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [session?.started_at]);

  // Instant stop - user always in control
  const handleStopSession = async () => {
    if (!session) return;
    setIsEnding(true);

    try {
      // Immediately end the session
      const { error } = await supabase
        .from('safe_assist_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          ended_by: user?.id,
          end_reason: 'User stopped session'
        })
        .eq('id', session.id);

      if (error) throw error;

      // Log to audit
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'safe_assist_user_stopped',
        module: 'safe_assist',
        meta_json: {
          session_id: session.id,
          elapsed_seconds: elapsed
        }
      });

      setSession(null);
      toast.success('Safe Assist session ended');
    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('Failed to end session. Try again.');
    } finally {
      setIsEnding(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!session) return null;

  const riskLevel = session.ai_risk_score > 50 ? 'high' : session.ai_risk_score > 25 ? 'medium' : 'low';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[9999] pointer-events-auto"
      >
        <div className={`
          px-4 py-2 flex items-center justify-between
          ${riskLevel === 'high' 
            ? 'bg-destructive/90 text-destructive-foreground' 
            : riskLevel === 'medium'
            ? 'bg-yellow-500/90 text-yellow-950'
            : 'bg-green-600/90 text-foreground'
          }
          backdrop-blur-sm border-b
        `}>
          {/* Left: Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="font-medium text-sm">Safe Assist Active</span>
            </div>
            <div className="w-px h-4 bg-current opacity-30" />
            <div className="flex items-center gap-1 text-xs">
              <Eye className="w-3 h-3" />
              <span>View-only</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Bot className="w-3 h-3" />
              <span>AI Monitored</span>
            </div>
          </div>

          {/* Center: Timer & Risk */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm">
              <Clock className="w-3 h-3" />
              <span className="font-mono">{formatTime(elapsed)}</span>
            </div>
            {session.ai_risk_score > 0 && (
              <Badge 
                variant="outline" 
                className={`text-xs ${riskLevel === 'high' ? 'border-white/50' : 'border-current/30'}`}
              >
                {riskLevel === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
                Risk: {session.ai_risk_score}
              </Badge>
            )}
          </div>

          {/* Right: Stop Button - Always visible and accessible */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleStopSession}
            disabled={isEnding}
            className={`
              font-medium
              ${riskLevel === 'high' 
                ? 'bg-card/20 hover:bg-card/30 text-foreground border-white/50' 
                : 'bg-card/20 hover:bg-card/30 text-current border-current/30'
              }
            `}
          >
            <X className="w-4 h-4 mr-1" />
            {isEnding ? 'Ending...' : 'Stop Safe Assist'}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default SafeAssistActiveBanner;
