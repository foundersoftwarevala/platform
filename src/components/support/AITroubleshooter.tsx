import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Sparkles, Send, FileText, Globe, 
  Smile, Lightbulb, CheckCircle2, Volume2
} from 'lucide-react';

interface AITroubleshooterProps {
  isOpen: boolean;
  onClose: () => void;
}

const quickActions = [
  "Suggest fix steps for this issue",
  "Pull relevant logs",
  "Translate to Hindi",
  "Generate calm response",
];

const suggestedFixes = [
  { step: 1, text: "Verify the user's software version is up to date" },
  { step: 2, text: "Check if the invoice template is properly configured" },
  { step: 3, text: "Clear browser cache and retry the operation" },
  { step: 4, text: "If issue persists, escalate to developer team" },
];

const AITroubleshooter = ({ isOpen, onClose }: AITroubleshooterProps) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm here to help you resolve issues calmly and efficiently. I can suggest fixes, translate responses, and help maintain a positive tone. How can I assist?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [toneMode, setToneMode] = useState<'calm' | 'professional' | 'friendly'>('calm');

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Based on the issue description, I've analyzed similar tickets. The most likely cause is a cache synchronization issue. Here's a step-by-step guide to help the client, with a calm and reassuring tone."
      }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className="fixed right-0 top-16 bottom-0 w-[420px] bg-card/60 backdrop-blur-2xl border-l border-teal-500/20 z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Sparkles className="w-5 h-5 text-teal-400" />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full"
            />
          </div>
          <div>
            <h3 className="font-medium text-foreground">AI Troubleshooter</h3>
            <p className="text-xs text-teal-400">Ready to assist</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-card/60 transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Tone Control */}
      <div className="p-4 border-b border-border">
        <p className="text-xs text-muted-foreground mb-2">Response Tone:</p>
        <div className="flex gap-2">
          {[
            { id: 'calm', label: 'Be Calm', icon: Smile },
            { id: 'professional', label: 'Professional', icon: FileText },
            { id: 'friendly', label: 'Friendly', icon: Volume2 },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setToneMode(mode.id as typeof toneMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                toneMode === mode.id
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                  : 'bg-card/60 text-muted-foreground border border-border hover:border-border'
              }`}
            >
              <mode.icon className="w-3 h-3" />
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-border">
        <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => setInput(action)}
              className="px-3 py-1.5 rounded-lg bg-card/60 border border-border text-xs text-muted-foreground hover:border-teal-500/20 hover:text-teal-400 transition-all"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Suggested Fixes Panel */}
      <div className="p-4 border-b border-border bg-teal-500/5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-teal-400" />
          <span className="text-sm text-teal-400 font-medium">Suggested Fix Steps</span>
        </div>
        <div className="space-y-2">
          {suggestedFixes.map((fix) => (
            <div key={fix.step} className="flex items-start gap-3 text-sm">
              <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-teal-400">{fix.step}</span>
              </div>
              <span className="text-muted-foreground">{fix.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] p-4 rounded-2xl ${
              message.role === 'user'
                ? 'bg-teal-500/10 border border-teal-500/20'
                : 'bg-card/60 border border-border'
            }`}>
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-3 h-3 text-teal-400" />
                  <span className="text-xs text-teal-400 font-medium">AI Assistant</span>
                </div>
              )}
              <p className="text-sm text-foreground leading-relaxed">{message.content}</p>
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-card/60 border border-border p-4 rounded-2xl">
              <div className="flex items-center gap-1.5">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1.5 h-1.5 bg-teal-400 rounded-full"
                />
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  className="w-1.5 h-1.5 bg-teal-400 rounded-full"
                />
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                  className="w-1.5 h-1.5 bg-teal-400 rounded-full"
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe the issue or ask for help..."
            className="flex-1 px-4 py-3 rounded-xl bg-card/60 border border-border text-foreground placeholder-slate-500 focus:outline-none focus:border-teal-500/30 transition-colors text-sm"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            className="px-4 py-3 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 hover:bg-teal-500/30 transition-all"
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Remember: Always respond with empathy and patience 💙
        </p>
      </div>
    </motion.div>
  );
};

export default AITroubleshooter;
