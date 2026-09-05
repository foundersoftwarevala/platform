import { motion } from 'framer-motion';
import { 
  Clock, MessageCircle, CheckCircle2, Smile, 
  TrendingUp, Award, Star, Target
} from 'lucide-react';

const performanceScores = [
  { 
    label: 'Response Time', 
    score: 92, 
    target: 90,
    description: 'Average first response under 4 minutes',
    icon: Clock,
    color: 'teal'
  },
  { 
    label: 'Politeness Score', 
    score: 98, 
    target: 95,
    description: 'Based on AI sentiment analysis',
    icon: MessageCircle,
    color: 'sky'
  },
  { 
    label: 'Resolution Rate', 
    score: 87, 
    target: 85,
    description: 'First contact resolution',
    icon: CheckCircle2,
    color: 'emerald'
  },
  { 
    label: 'Client Happiness', 
    score: 96, 
    target: 90,
    description: 'Based on post-ticket surveys',
    icon: Smile,
    color: 'amber'
  },
];

const achievements = [
  { title: 'Speed Demon', description: 'Resolved 5 tickets under 10 minutes', icon: '⚡' },
  { title: 'Empathy Master', description: 'Perfect politeness score this week', icon: '💝' },
  { title: 'Problem Solver', description: '10 complex issues resolved', icon: '🧩' },
];

const PerformancePanel = () => {
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
          <span className="text-sm text-emerald-400">Top 10% this month</span>
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
                <span className="text-3xl font-bold text-foreground">{metric.score}</span>
                <span className="text-lg text-muted-foreground">%</span>
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
                  animate={{ width: `${metric.score}%` }}
                  transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                  className={`h-full bg-gradient-to-r from-${metric.color}-500 to-${metric.color}-400`}
                />
              </div>
              {metric.score >= metric.target && (
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
              <div className="text-4xl font-bold text-foreground">93.2</div>
              <div className="text-xs text-muted-foreground">out of 100</div>
            </div>
            <div className="flex items-center gap-1 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">+2.4%</span>
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
