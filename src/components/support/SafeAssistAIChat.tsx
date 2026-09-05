import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Send, User, CheckCircle, AlertTriangle, 
  Lightbulb, HelpCircle, RefreshCw, Loader2, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  quickActions?: QuickAction[];
  quickSolution?: QuickSolution;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  primary?: boolean;
}

interface QuickSolution {
  title: string;
  steps: string[];
  resolved: boolean;
  escalate?: boolean;
}

interface SafeAssistAIChatProps {
  onEscalateToHuman: () => void;
  onResolved: () => void;
  sessionId?: string;
}

export function SafeAssistAIChat({ onEscalateToHuman, onResolved, sessionId }: SafeAssistAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI Support Assistant. I can help you with common issues like password resets, login problems, and more. What can I help you with today?",
      timestamp: new Date(),
      quickActions: [
        { id: 'password', label: 'Password Issue', icon: 'key' },
        { id: 'login', label: 'Login Problem', icon: 'login' },
        { id: 'payment', label: 'Payment Issue', icon: 'card' },
        { id: 'other', label: 'Something Else', icon: 'help' }
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuickAction = async (action: QuickAction) => {
    if (action.id === 'human') {
      onEscalateToHuman();
      return;
    }
    if (action.id === 'solved') {
      onResolved();
      return;
    }
    if (action.id === 'restart') {
      setMessages([messages[0]]);
      return;
    }

    // Map quick action to message
    const actionMessages: Record<string, string> = {
      'password': 'I need help with my password',
      'login': 'I cannot log in to my account',
      'payment': 'I have a payment issue',
      'other': 'I need help with something else',
      'try_solution': 'Let me try the solution first',
      'more_help': 'I need more help with this'
    };

    const message = actionMessages[action.id] || action.label;
    await sendMessage(message);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const { data, error } = await supabase.functions.invoke('safe-assist-ai', {
        body: {
          message: text,
          sessionId,
          conversationHistory
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        quickActions: data.quickActions,
        quickSolution: data.quickSolution
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, I'm having trouble processing your request. Would you like to connect with a human agent?",
        timestamp: new Date(),
        quickActions: [
          { id: 'human', label: 'Connect with Agent', icon: 'user', primary: true },
          { id: 'retry', label: 'Try Again', icon: 'refresh' }
        ]
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      'user': <User className="w-3 h-3" />,
      'check': <CheckCircle className="w-3 h-3" />,
      'help': <HelpCircle className="w-3 h-3" />,
      'refresh': <RefreshCw className="w-3 h-3" />,
      'lightbulb': <Lightbulb className="w-3 h-3" />,
      'key': <span className="text-xs">🔑</span>,
      'login': <span className="text-xs">🔐</span>,
      'card': <span className="text-xs">💳</span>
    };
    return icons[iconName] || <HelpCircle className="w-3 h-3" />;
  };

  return (
    <div className="flex flex-col h-[400px]">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-gradient-to-r from-primary/10 to-transparent">
        <div className="relative">
          <Bot className="w-5 h-5 text-primary" />
          <Sparkles className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1" />
        </div>
        <div>
          <p className="text-sm font-medium">AI Support Assistant</p>
          <p className="text-xs text-muted-foreground">Handles 80% of issues instantly</p>
        </div>
        <Badge variant="outline" className="ml-auto text-xs bg-green-500/10 text-green-500 border-green-500/30">
          Online
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-primary" />
                  </div>
                )}
                
                <div className={`max-w-[80%] space-y-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`rounded-lg p-3 text-sm ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* Quick Solution Steps */}
                  {message.quickSolution && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm">
                      <p className="font-medium text-green-600 mb-2 flex items-center gap-1">
                        <Lightbulb className="w-4 h-4" />
                        {message.quickSolution.title}
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        {message.quickSolution.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      {message.quickSolution.escalate && (
                        <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          May require human assistance
                        </p>
                      )}
                    </div>
                  )}

                  {/* Quick Actions */}
                  {message.quickActions && message.quickActions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {message.quickActions.map((action) => (
                        <Button
                          key={action.id}
                          variant={action.primary ? "default" : "outline"}
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => handleQuickAction(action)}
                        >
                          {getActionIcon(action.icon)}
                          <span className="ml-1">{action.label}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2"
            >
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-3 h-3 text-primary" />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

export default SafeAssistAIChat;
