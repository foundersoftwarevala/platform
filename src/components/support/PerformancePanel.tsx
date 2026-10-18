import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMembers, useTickets } from '@/hooks/useSalesSupportData';
import {
  Clock, MessageCircle, CheckCircle2, Smile, Award, Star, Target,
} from 'lucide-react';

/**
 * The signed-in agent's own performance, from the tickets assigned to them.
 *
 * Every score, the "Top 10% this month" badge, the overall 93.2 and the three
 * achievements were typed in. The scores are the agent's tickets now, the rank
 * is theirs among the support team this month, and the achievements are the
 * AMS awards they have earned. Politeness is scored by nothing on the
 * platform, so it shows a dash.
 */
type Score = { label: string; score: number | null; target: number; description: string; icon: typeof Clock; color: string };

const PerformancePanel = () => {
  const { data: ticketRows } = useTickets();
  const { data: members } = useTeamMembers('support');
  const me = useQuery({
    queryKey: ['support-performance', 'me'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return { email: null as string | null, awards: [] as { title: string; description: string; icon: string }[] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const earned = await (supabase as any).from('user_awards').select('award_id,earned_at').eq('user_id', user.id).order('earned_at', { ascending: false }).limit(3);
      const ids = ((earned.data ?? []) as { award_id: string }[]).map((e) => e.award_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const awards = ids.length ? await (supabase as any).from('awards').select('id,name,description').in('id', ids) : { data: [] };
      return {
        email: user.email ?? null,
        awards: ((awards.data ?? []) as { name: string; description: string | null }[]).map((w) => ({ title: w.name, description: w.description ?? '', icon: '🏆' })),
      };
    },
  });
  const mine = (members ?? []).find((m) => (m as unknown as { email?: string }).email === me.data?.email);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = (ticketRows ?? []) as any[];
  const assigned = mine ? all.filter((t) => t.assigned_to === mine.id) : [];
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
  const answered = assigned.filter((t) => t.first_response_at);
  const rated = assigned.filter((t) => t.csat != null);
  const performanceScores: Score[] = [
    { label: 'Response Time', score: pct(answered.filter((t) => !t.sla_breached).length, answered.length), target: 90, description: 'Answered tickets that met their SLA', icon: Clock, color: 'teal' },
    { label: 'Politeness Score', score: null, target: 95, description: 'Not scored on the platform yet', icon: MessageCircle, color: 'sky' },
    { label: 'Resolution Rate', score: pct(assigned.filter((t) => t.status === 'resolved' || t.status === 'closed').length, assigned.length), target: 85, description: 'Your assigned tickets that are resolved', icon: CheckCircle2, color: 'emerald' },
    { label: 'Client Happiness', score: rated.length ? Math.round((rated.reduce((s2, t) => s2 + Number(t.csat), 0) / rated.length / 5) * 100) : null, target: 90, description: 'Customer ratings on your tickets', icon: Smile, color: 'amber' },
  ];
  const scored = performanceScores.filter((x) => x.score != null) as (Score & { score: number })[];
  const overall = scored.length ? scored.reduce((s2, x) => s2 + x.score, 0) / scored.length : null;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const resolvedBy = (id: string) => all.filter((t) => t.assigned_to === id && t.resolved_at && new Date(t.resolved_at) >= monthStart).length;
  const ranking = [...(members ?? [])].sort((x, y) => resolvedBy(y.id) - resolvedBy(x.id));
  const rank = mine ? ranking.findIndex((m) => m.id === mine.id) + 1 : 0;
  const achievements = me.data?.awards ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Performance Overview</h2>
          <p className="text-muted-foreground mt-1">Your support metrics and achievements</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Award className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-400">
            {!mine ? 'Not in the support team directory' : `#${rank} of ${ranking.length} this month`}
          </span>
        </div>
      </div>

      {/* Performance Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {performanceScores.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-6 rounded-2xl bg-card/60 backdrop-blur-xl border border-border"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-${metric.color}-500/10 flex items-center justify-center`}>
                <metric.icon className={`w-6 h-6 text-${metric.color}-400`} />
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-foreground">{metric.score ?? '—'}</span>
                {metric.score != null && <span className="text-lg text-muted-foreground">%</span>}
              </div>
            </div>
            <h4 className="text-foreground font-medium mb-1">{metric.label}</h4>
            <p className="text-sm text-muted-foreground mb-4">{metric.description}</p>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className={`text-${metric.color}-400`}>Target: {metric.target}%</span>
              </div>
              <div className="h-2 bg-card/60 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.score ?? 0}%` }}
                  transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                  className={`h-full bg-gradient-to-r from-${metric.color}-500 to-${metric.color}-400`}
                />
              </div>
              {metric.score != null && metric.score >= metric.target && (
                <div className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Target achieved
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Overall Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 to-sky-500/10 border border-teal-500/20"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Overall Performance Score</h3>
            <p className="text-sm text-muted-foreground">Combined score across all metrics</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground">{overall == null ? '—' : overall.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">{overall == null ? 'no scored tickets yet' : `out of 100 · ${scored.length} scores`}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-6 rounded-2xl bg-card/60 border border-border"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400" />
          Recent Achievements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {achievements.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">{me.isLoading ? 'Loading…' : 'No award earned yet.'}</p>
          )}
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="p-4 rounded-xl bg-card/60 border border-border text-center"
            >
              <div className="text-3xl mb-2">{achievement.icon}</div>
              <h4 className="font-medium text-foreground">{achievement.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Visibility Notice */}
      <div className="p-4 rounded-xl bg-card/60 border border-border">
        <p className="text-xs text-muted-foreground text-center">
          📊 Performance metrics are visible only to you and your team lead. These help track progress and identify areas for growth.
        </p>
      </div>
    </div>
  );
};

export default PerformancePanel;
