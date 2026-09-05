import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX, AlertTriangle, ArrowLeft, Lock } from 'lucide-react';
import { useDemoManagerAccess } from '@/hooks/useDemoManagerAccess';
import { useNavigate } from "@/hooks/useNavigate";
import { motion } from 'framer-motion';

interface DemoAccessGateProps {
  children: ReactNode;
  requireEdit?: boolean;
  fallbackMessage?: string;
}

export function DemoAccessGate({ 
  children, 
  requireEdit = false,
  fallbackMessage = "You don't have permission to access demo management features."
}: DemoAccessGateProps) {
  const { isDemoManager, canAccessDemos, isLoading } = useDemoManagerAccess();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // If edit access is required, only demo_manager can proceed
  if (requireEdit && !isDemoManager) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center min-h-[400px] p-4"
      >
        <Card className="max-w-md w-full bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-xl font-bold text-destructive">Demo Manager Only</h3>
            <p className="text-muted-foreground">
              Demo submission, editing, and management actions are restricted to the Demo Manager role only.
            </p>
            <div className="p-3 rounded bg-destructive/10 text-sm text-destructive/80">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Auto-submit, auto-register, and auto-adjust features are exclusively available to Demo Managers.
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // If view access is needed but user can't even view
  if (!canAccessDemos) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center min-h-[400px] p-4"
      >
        <Card className="max-w-md w-full bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-xl font-bold text-destructive">Access Denied</h3>
            <p className="text-muted-foreground">{fallbackMessage}</p>
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return <>{children}</>;
}

// Higher-order component for wrapping demo edit actions
export function withDemoManagerOnly<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function DemoManagerProtected(props: P) {
    return (
      <DemoAccessGate requireEdit>
        <WrappedComponent {...props} />
      </DemoAccessGate>
    );
  };
}
