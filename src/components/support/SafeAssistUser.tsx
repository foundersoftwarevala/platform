import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Eye, Copy, Check, X, AlertTriangle, 
  Lock, Fingerprint, Bot, Bell, Clock, UserCheck, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSafeAssist } from '@/hooks/useSafeAssist';
import { SafeAssistAIChat } from './SafeAssistAIChat';
import { toast } from 'sonner';

interface SafeAssistUserProps {
  onClose?: () => void;
}

export function SafeAssistUser({ onClose }: SafeAssistUserProps) {
  const {
    session,
    isConnected,
    cursorPosition,
    isLoading,
    notifications,
    userCode,
    agentCode,
    createSession,
    verifyConnection,
    giveConsent,
    endSession,
    markNotificationRead
  } = useSafeAssist();

  const [copied, setCopied] = useState(false);
  const [enteredAgentCode, setEnteredAgentCode] = useState('');
  const [step, setStep] = useState<'ai_chat' | 'create' | 'share' | 'verify' | 'consent' | 'active'>('ai_chat');
  const [showNotifications, setShowNotifications] = useState(false);
  const [aiResolved, setAiResolved] = useState(false);

  const unreadNotifications = notifications.filter(n => !n.read_at);

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateSession = async () => {
    const result = await createSession();
    if (result) {
      setStep('share');
    }
  };

  const handleVerifyAgent = async () => {
    if (enteredAgentCode.length !== 6) {
      toast.error('Please enter the 6-character agent code');
      return;
    }
    
    const success = await verifyConnection(enteredAgentCode, false);
    if (success) {
      setStep('consent');
    }
  };

  const handleGiveConsent = async () => {
    const success = await giveConsent();
    if (success) {
      setStep('active');
    }
  };

  // Show guided cursor overlay
  useEffect(() => {
    if (cursorPosition && step === 'active') {
      // The cursor is shown as an overlay - handled in CSS
    }
  }, [cursorPosition, step]);

  // Auto-advance when agent joins
  useEffect(() => {
    if (session?.agent_id && step === 'share') {
      setStep('verify');
    }
    if (session?.dual_verified && session?.user_consent_given) {
      setStep('active');
    }
  }, [session, step]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm p-4 pt-56"
    >
      {/* Guided Cursor Overlay */}
      <AnimatePresence>
        {cursorPosition && step === 'active' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed pointer-events-none z-[100]"
            style={{ 
              left: cursorPosition.x, 
              top: cursorPosition.y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-primary animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white" />
              {cursorPosition.elementText && (
                <div className="absolute top-10 left-0 bg-background border rounded-lg px-3 py-1 text-xs shadow-lg max-w-[200px] truncate">
                  {cursorPosition.elementText}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="w-full max-w-md relative">
        {/* Notifications Bell */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="absolute top-4 right-12 p-2 hover:bg-muted rounded-lg transition-colors relative"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifications.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
              {unreadNotifications.length}
            </span>
          )}
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Safe Assist
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              <Bot className="w-3 h-3 mr-1" />
              AI Protected
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Notifications Panel */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border rounded-lg p-3 mb-4 max-h-48 overflow-y-auto"
              >
                <h4 className="text-sm font-medium mb-2">Notifications</h4>
                {notifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No notifications</p>
                ) : (
                  <div className="space-y-2">
                    {notifications.slice(0, 5).map(notification => (
                      <div 
                        key={notification.id}
                        onClick={() => markNotificationRead(notification.id)}
                        className={`p-2 rounded text-xs cursor-pointer transition-colors ${
                          notification.read_at ? 'bg-muted/50' : 'bg-primary/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {notification.severity === 'error' && <AlertTriangle className="w-3 h-3 text-destructive" />}
                          {notification.severity === 'warning' && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
                          {notification.severity === 'info' && <Bell className="w-3 h-3 text-primary" />}
                          <span className="font-medium">{notification.title}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">{notification.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step: AI Chat (First) */}
          {step === 'ai_chat' && (
            <div className="space-y-4">
              <SafeAssistAIChat
                sessionId={session?.id}
                onEscalateToHuman={() => setStep('create')}
                onResolved={() => {
                  setAiResolved(true);
                  toast.success('Issue resolved by AI!');
                  onClose?.();
                }}
              />
              <div className="flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('create')}
                  className="text-xs text-muted-foreground"
                >
                  <UserCheck className="w-3 h-3 mr-1" />
                  Skip to Human Agent
                </Button>
              </div>
            </div>
          )}

          {/* Step: Create Session */}
          {step === 'create' && (
            <div className="space-y-4">
              <Alert>
                <Shield className="w-4 h-4" />
                <AlertTitle>Secure Support Session</AlertTitle>
                <AlertDescription className="text-xs">
                  Start a Safe Assist session to get help from our support team. 
                  AI monitors every action for your protection.
                </AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" />
                  <span>View-only guided cursor</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-green-500" />
                  <span>Real-time AI monitoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-orange-500" />
                  <span>Dual verification required</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-500" />
                  <span>30-minute max session</span>
                </div>
              </div>

              <Button 
                onClick={handleCreateSession} 
                className="w-full"
                disabled={isLoading}
              >
                <Shield className="w-4 h-4 mr-2" />
                Start Safe Assist Session
              </Button>
            </div>
          )}

          {/* Step: Share Code */}
          {step === 'share' && session && (
            <div className="space-y-4">
              <Alert className="bg-primary/10 border-primary/30">
                <AlertTitle>Share Your Session Code</AlertTitle>
                <AlertDescription className="text-xs">
                  Give this code to the support agent. They will enter it to join.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Session Code</Label>
                <div className="flex gap-2">
                  <Input 
                    value={session.session_code} 
                    readOnly 
                    className="font-mono text-lg tracking-wider text-center"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => copyCode(session.session_code)}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Your Verification Code</Label>
                <p className="text-xs text-muted-foreground">
                  Keep this code safe. You'll exchange it with the agent.
                </p>
                <div className="flex gap-2">
                  <Input 
                    value={userCode} 
                    readOnly 
                    className="font-mono text-lg tracking-wider text-center bg-green-500/10 border-green-500/30"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => copyCode(userCode)}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                Waiting for agent to join...
              </div>
            </div>
          )}

          {/* Step: Verify Agent */}
          {step === 'verify' && (
            <div className="space-y-4">
              <Alert className="bg-orange-500/10 border-orange-500/30">
                <Fingerprint className="w-4 h-4" />
                <AlertTitle>Dual Verification</AlertTitle>
                <AlertDescription className="text-xs">
                  Agent has joined! Enter the code they give you to verify.
                </AlertDescription>
              </Alert>

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Give this to the agent:</p>
                <p className="font-mono text-lg text-center">{userCode}</p>
              </div>

              <div className="space-y-2">
                <Label>Enter Agent's Code</Label>
                <Input 
                  value={enteredAgentCode}
                  onChange={(e) => setEnteredAgentCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  maxLength={6}
                  className="font-mono text-lg tracking-wider text-center"
                />
              </div>

              <Button 
                onClick={handleVerifyAgent} 
                className="w-full"
                disabled={enteredAgentCode.length !== 6}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Verify Agent
              </Button>
            </div>
          )}

          {/* Step: Consent */}
          {step === 'consent' && (
            <div className="space-y-4">
              <Alert className="bg-green-500/10 border-green-500/30">
                <Check className="w-4 h-4" />
                <AlertTitle>Agent Verified!</AlertTitle>
                <AlertDescription className="text-xs">
                  Confirm you allow the agent to guide you with their cursor.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 p-3 bg-muted rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Agent can point at elements on your screen</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-destructive" />
                  <span>Agent CANNOT click, type, or control anything</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <span>AI monitors and will alert you of any issues</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-orange-500" />
                  <span>Session is recorded with watermark</span>
                </div>
              </div>

              <Button onClick={handleGiveConsent} className="w-full">
                <Shield className="w-4 h-4 mr-2" />
                I Consent - Start Session
              </Button>
            </div>
          )}

          {/* Step: Active Session */}
          {step === 'active' && session && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                  Session Active
                </Badge>
                <Badge variant="outline">
                  AI Risk: {session.ai_risk_score || 0}
                </Badge>
              </div>

              <Alert>
                <Bot className="w-4 h-4" />
                <AlertTitle>AI Monitoring Active</AlertTitle>
                <AlertDescription className="text-xs">
                  You'll be notified immediately if anything unusual is detected.
                </AlertDescription>
              </Alert>

              <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Connection</span>
                  <span className="text-green-500">Secure</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Dual Verified</span>
                  <Check className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Recording</span>
                  <Badge variant="secondary" className="text-xs">Watermarked</Badge>
                </div>
              </div>

              <Button 
                variant="destructive" 
                onClick={endSession}
                className="w-full"
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

export default SafeAssistUser;
