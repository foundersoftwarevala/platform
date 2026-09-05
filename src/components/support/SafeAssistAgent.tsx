import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, Eye, X, AlertTriangle, Bot, Send, 
  Fingerprint, UserCheck, Activity, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSafeAssist } from '@/hooks/useSafeAssist';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SafeAssistAgentProps {
  onClose?: () => void;
}

interface AILog {
  id: string;
  event_type: string;
  risk_level: string;
  ai_analysis: any;
  action_recommended: string;
  auto_handled: boolean;
  timestamp: string;
}

export function SafeAssistAgent({ onClose }: SafeAssistAgentProps) {
  const {
    session,
    isConnected,
    isLoading,
    agentCode,
    joinSession,
    verifyConnection,
    endSession,
    sendCursorPosition
  } = useSafeAssist();

  const [sessionCode, setSessionCode] = useState('');
  const [enteredUserCode, setEnteredUserCode] = useState('');
  const [step, setStep] = useState<'join' | 'verify' | 'waiting' | 'active'>('join');
  const [aiLogs, setAiLogs] = useState<AILog[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(30 * 60); // 30 minutes

  // Track mouse movement and send cursor position
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (step !== 'active' || !session?.dual_verified) return;
    
    const element = document.elementFromPoint(e.clientX, e.clientY);
    sendCursorPosition({
      x: e.clientX,
      y: e.clientY,
      elementPath: element?.tagName,
      elementText: element?.textContent?.substring(0, 50)
    });
  }, [step, session, sendCursorPosition]);

  // Add mouse tracking
  useEffect(() => {
    if (step === 'active') {
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [step, handleMouseMove]);

  // Timer countdown
  useEffect(() => {
    if (step === 'active') {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 0) {
            endSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, endSession]);

  // Fetch AI logs
  useEffect(() => {
    if (session?.id && step === 'active') {
      const fetchLogs = async () => {
        const { data } = await supabase
          .from('safe_assist_ai_logs')
          .select('*')
          .eq('session_id', session.id)
          .order('timestamp', { ascending: false })
          .limit(10);
        
        if (data) {
          setAiLogs(data as unknown as AILog[]);
        }
      };
      
      fetchLogs();
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [session, step]);

  const handleJoinSession = async () => {
    if (sessionCode.length < 6) {
      toast.error('Please enter a valid session code');
      return;
    }
    
    const success = await joinSession(sessionCode);
    if (success) {
      setStep('verify');
    }
  };

  const handleVerifyUser = async () => {
    if (enteredUserCode.length !== 6) {
      toast.error('Please enter the 6-character user code');
      return;
    }
    
    const success = await verifyConnection(enteredUserCode, true);
    if (success) {
      setStep('waiting');
    }
  };

  // Auto-advance when fully verified
  useEffect(() => {
    if (session?.dual_verified && session?.user_consent_given) {
      setStep('active');
    }
  }, [session]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-4 top-20 z-50 w-96"
    >
      <Card className="border-primary/30 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4 text-green-500" />
              Safe Assist - Agent
            </CardTitle>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Step: Join Session */}
          {step === 'join' && (
            <div className="space-y-4">
              <Alert>
                <Eye className="w-4 h-4" />
                <AlertTitle>Join User Session</AlertTitle>
                <AlertDescription className="text-xs">
                  Enter the session code provided by the user.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Session Code</Label>
                <Input 
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="Enter session code"
                  className="font-mono tracking-wider"
                />
              </div>

              <Button 
                onClick={handleJoinSession} 
                className="w-full"
                disabled={isLoading}
              >
                <Send className="w-4 h-4 mr-2" />
                Join Session
              </Button>
            </div>
          )}

          {/* Step: Verify */}
          {step === 'verify' && (
            <div className="space-y-4">
              <Alert className="bg-orange-500/10 border-orange-500/30">
                <Fingerprint className="w-4 h-4" />
                <AlertTitle>Dual Verification Required</AlertTitle>
                <AlertDescription className="text-xs">
                  Exchange codes with the user for secure connection.
                </AlertDescription>
              </Alert>

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Give this code to user:</p>
                <p className="font-mono text-lg text-center text-primary">{agentCode}</p>
              </div>

              <div className="space-y-2">
                <Label>Enter User's Code</Label>
                <Input 
                  value={enteredUserCode}
                  onChange={(e) => setEnteredUserCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  maxLength={6}
                  className="font-mono text-lg tracking-wider text-center"
                />
              </div>

              <Button 
                onClick={handleVerifyUser} 
                className="w-full"
                disabled={enteredUserCode.length !== 6}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Verify Connection
              </Button>
            </div>
          )}

          {/* Step: Waiting for Consent */}
          {step === 'waiting' && (
            <div className="space-y-4">
              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <Clock className="w-4 h-4" />
                <AlertTitle>Waiting for User Consent</AlertTitle>
                <AlertDescription className="text-xs">
                  The user must confirm consent before you can guide them.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-center py-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}

          {/* Step: Active Session */}
          {step === 'active' && session && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                  Live
                </Badge>
                <Badge variant="outline" className={
                  timeRemaining < 300 ? 'text-destructive' : ''
                }>
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(timeRemaining)}
                </Badge>
              </div>

              <div className="p-2 bg-muted rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode</span>
                  <span>Guided Cursor Only</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Monitoring</span>
                  <Badge variant="secondary" className="text-xs">
                    <Bot className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span className={
                    (session.ai_risk_score || 0) > 50 ? 'text-destructive' : 
                    (session.ai_risk_score || 0) > 25 ? 'text-yellow-500' : 'text-green-500'
                  }>
                    {session.ai_risk_score || 0}
                  </span>
                </div>
              </div>

              {/* AI Logs */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4" />
                  <span>AI Activity Log</span>
                </div>
                <ScrollArea className="h-32 border rounded-lg p-2">
                  {aiLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No activity yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {aiLogs.map(log => (
                        <div 
                          key={log.id}
                          className={`p-2 rounded text-xs ${
                            log.risk_level === 'critical' ? 'bg-destructive/10' :
                            log.risk_level === 'high' ? 'bg-orange-500/10' :
                            log.risk_level === 'medium' ? 'bg-yellow-500/10' :
                            'bg-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{log.event_type}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {log.risk_level}
                            </Badge>
                          </div>
                          {log.action_recommended && (
                            <p className="text-muted-foreground mt-1">
                              → {log.action_recommended}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Session is being recorded. Agent ID watermarked.
                </AlertDescription>
              </Alert>

              <Button 
                variant="destructive" 
                onClick={endSession}
                className="w-full"
                size="sm"
              >
                <X className="w-4 h-4 mr-2" />
                End Session
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default SafeAssistAgent;
