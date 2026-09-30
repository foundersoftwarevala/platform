import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, Brain, MessageSquare, Copy, Clock, AlertTriangle, 
  CheckCircle, Settings, ToggleLeft, Target, TrendingUp, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useGlobalActions } from '@/hooks/useGlobalActions';

interface AIModule {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  accuracy: number;
  lastRun: string;
  stats: { label: string; value: string }[];
}

interface SuggestedReply {
  id: string;
  ticketId: string;
  suggestion: string;
  confidence: number;
  category: string;
}

const AIFeaturesPanel = () => {
  const { executeAction } = useGlobalActions();

  // None of these AI modules runs on the platform yet. The catalogue says what
  // each would do; it no longer claims them enabled, accurate or busy.
  const [aiModules] = useState<AIModule[]>(() => ([
    {
      id: 'priority',
      name: 'Auto-Priority Detection',
      description: 'Automatically classify ticket priority based on content analysis',
      icon: Target,
      enabled: false,
      accuracy: 0,
      lastRun: 'Not running',
      stats: [],
    },
    {
      id: 'sentiment',
      name: 'Sentiment Analysis',
      description: 'Detect customer emotion and urgency from message tone',
      icon: Brain,
      enabled: false,
      accuracy: 0,
      lastRun: 'Not running',
      stats: [],
    },
    {
      id: 'duplicate',
      name: 'Duplicate Detection',
      description: 'Identify and merge duplicate tickets automatically',
      icon: Copy,
      enabled: false,
      accuracy: 0,
      lastRun: 'Not running',
      stats: [],
    },
    {
      id: 'autoclose',
      name: 'Auto-Close Rules',
      description: 'Close resolved tickets automatically after inactivity',
      icon: CheckCircle,
      enabled: false,
      accuracy: 0,
      lastRun: 'Not running',
      stats: [],
    },
    {
      id: 'breach',
      name: 'SLA Breach Prediction',
      description: 'Predict tickets at risk of SLA breach before it happens',
      icon: AlertTriangle,
      enabled: false,
      accuracy: 0,
      lastRun: 'Not running',
      stats: [],
    },
    {
      id: 'replies',
      name: 'Smart Reply Suggestions',
      description: 'Generate contextual response suggestions for agents',
      icon: MessageSquare,
      enabled: false,
      accuracy: 0,
      lastRun: 'Not running',
      stats: [],
    },
  ] as AIModule[]));

  // No AI writes reply suggestions yet; these were invented.
  const suggestedReplies: SuggestedReply[] = [];

  // No region-level AI setting is stored; the four regions here were invented.
  const regionSettings: { id: string; region: string; aiEnabled: boolean }[] = [];

  const handleToggleModule = useCallback(async (moduleId: string) => {
    const module = aiModules.find(m => m.id === moduleId);
    if (!module) return;

    await executeAction({
      actionId: `toggle_ai_${moduleId}`,
      actionType: 'toggle',
      entityType: 'ai_task',
      entityId: moduleId,
      metadata: { enabled: !module.enabled },
      successMessage: `${module.name} ${!module.enabled ? 'enabled' : 'disabled'}`,
    });
  }, [aiModules, executeAction]);

  const handleUseSuggestion = useCallback(async (replyId: string, ticketId: string) => {
    await executeAction({
      actionId: `use_suggestion_${replyId}`,
      actionType: 'approve',
      entityType: 'ai_task',
      entityId: replyId,
      metadata: { ticketId },
      successMessage: 'Suggestion applied to ticket',
    });
  }, [executeAction]);

  const handleTrainModel = useCallback(async () => {
    await executeAction({
      actionId: 'train_ai_model',
      actionType: 'sync',
      entityType: 'ai_task',
      metadata: { action: 'retrain' },
      successMessage: 'AI model training initiated',
    });
  }, [executeAction]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            AI Support Features
          </h2>
          <p className="text-muted-foreground text-sm">Intelligent automation for faster, smarter support</p>
        </div>
        <Button onClick={handleTrainModel} className="bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30">
          <Brain className="w-4 h-4 mr-2" />
          Retrain Models
        </Button>
      </div>

      {/* AI Performance Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-4 gap-4"
      >
        {[
          { label: 'Overall Accuracy', value: '—', icon: Target, color: 'text-emerald-400' },
          { label: 'Tickets Processed', value: '0', icon: Zap, color: 'text-purple-400' },
          { label: 'Time Saved', value: '—', icon: Clock, color: 'text-teal-400' },
          { label: 'Modules Running', value: String(aiModules.filter((m) => m.enabled).length), icon: TrendingUp, color: 'text-orange-400' },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            whileHover={{ scale: 1.02 }}
            className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* AI Modules Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">AI Modules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiModules.map((module) => (
            <motion.div
              key={module.id}
              whileHover={{ scale: 1.01 }}
              className={`p-4 rounded-xl border transition-all ${
                module.enabled 
                  ? 'bg-purple-500/5 border-purple-500/20' 
                  : 'bg-card/60 border-border'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    module.enabled ? 'bg-purple-500/20' : 'bg-muted/40'
                  }`}>
                    <module.icon className={`w-4 h-4 ${module.enabled ? 'text-purple-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{module.name}</p>
                    <p className="text-xs text-muted-foreground">{module.lastRun}</p>
                  </div>
                </div>
                <Switch 
                  checked={module.enabled}
                  onCheckedChange={() => handleToggleModule(module.id)}
                />
              </div>
              <p className="text-xs text-muted-foreground mb-3">{module.description}</p>
              <div className="flex items-center justify-between">
                <Badge className={module.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted/40 text-muted-foreground'}>
                  {module.enabled ? `${module.accuracy}% accuracy` : 'Not running'}
                </Badge>
                <div className="flex gap-2 text-xs">
                  {module.stats.map((stat, idx) => (
                    <span key={idx} className="text-muted-foreground">
                      {stat.label}: <span className="text-foreground">{stat.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Smart Reply Suggestions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="w-5 h-5 text-teal-400" />
          <h3 className="text-lg font-semibold text-foreground">Pending AI Suggestions</h3>
          <Badge className="bg-teal-500/20 text-teal-400">{suggestedReplies.length} Ready</Badge>
        </div>

        <div className="space-y-3">
          {suggestedReplies.length === 0 && <p className="text-sm text-muted-foreground">No AI writes reply suggestions on the platform yet.</p>}
          {suggestedReplies.map((reply) => (
            <div
              key={reply.id}
              className="p-4 rounded-xl bg-card/60 border border-border"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-teal-400">{reply.ticketId}</span>
                  <Badge className="bg-muted/40 text-muted-foreground">{reply.category}</Badge>
                </div>
                <Badge className="bg-purple-500/20 text-purple-400">{reply.confidence}% match</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{reply.suggestion}</p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => handleUseSuggestion(reply.id, reply.ticketId)}
                  className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30"
                >
                  <CheckCircle className="w-3 h-3 mr-1" /> Use Suggestion
                </Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
                  <Settings className="w-3 h-3 mr-1" /> Customize
                </Button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Region AI Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <ToggleLeft className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-foreground">Regional AI Settings</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {regionSettings.map((region) => (
            <div
              key={region.id}
              className={`p-4 rounded-xl border text-center ${
                region.aiEnabled 
                  ? 'bg-emerald-500/5 border-emerald-500/20' 
                  : 'bg-card/60 border-border'
              }`}
            >
              <p className="font-medium text-foreground text-sm mb-2">{region.region}</p>
              <div className="flex items-center justify-center gap-2">
                <Switch checked={region.aiEnabled} />
                <span className={`text-xs ${region.aiEnabled ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  {region.aiEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default AIFeaturesPanel;
