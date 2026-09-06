/**
 * ACTION LOGGER HOOK
 * Universal button action logging for Software Vala Enterprise Platform
 * Every button click = 1 DB action minimum
 * 
 * DEBUG FIX: Enhanced with retry logic, fail-safe, and complete traceability
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type ActionType = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'PROCESS' | 'NAVIGATE';
export type ActionResult = 'success' | 'failure' | 'retry' | 'blocked';

interface LogActionParams {
  buttonId: string;
  moduleName: string;
  actionType: ActionType;
  actionResult: ActionResult;
  responseTimeMs?: number | undefined;
  errorMessage?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

interface UseActionLoggerReturn {
  logAction: (params: LogActionParams) => Promise<void>;
  logButtonClick: (buttonId: string, moduleName: string, actionType: ActionType) => () => Promise<{ 
    complete: (result: ActionResult, error?: string) => Promise<void>;
    startTime: number;
  }>;
}

export function useActionLogger(): UseActionLoggerReturn {
  const logAction = useCallback(async (params: LogActionParams) => {
    const maxRetries = 2;
    let retryCount = 0;
    
    const attemptLog = async (): Promise<void> => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const insertData = {
          user_id: user?.id || null,
          button_id: params.buttonId,
          module_name: params.moduleName,
          action_type: params.actionType,
          action_result: params.actionResult,
          response_time_ms: params.responseTimeMs || null,
          error_message: params.errorMessage || null,
          metadata: (params.metadata || null) as Json,
          user_agent: navigator.userAgent,
        };

        const { error } = await supabase.from('action_logs').insert(insertData);
        
        if (error) {
          throw error;
        }
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          // Retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryCount * 100));
          return attemptLog();
        }
        // Never break the app, but never fail silently either.
        console.error('[ActionLogger] Failed to log action after retries:', error);
        const { toast } = await import('@/hooks/use-toast');
        toast({
          title: 'Audit log failed',
          description: `Action "${params.buttonId}" could not be recorded.`,
          variant: 'destructive',
        });
      }
    };
    
    await attemptLog();
  }, []);

  const logButtonClick = useCallback((buttonId: string, moduleName: string, actionType: ActionType) => {
    return async () => {
      const startTime = performance.now();
      
      return {
        startTime,
        complete: async (result: ActionResult, error?: string) => {
          const responseTimeMs = Math.round(performance.now() - startTime);
          await logAction({
            buttonId,
            moduleName,
            actionType,
            actionResult: result,
            responseTimeMs,
            errorMessage: error,
          });
        }
      };
    };
  }, [logAction]);

  return { logAction, logButtonClick };
}

/**
 * Higher-order function to wrap any button action with logging
 * DEBUG FIX: Added proper error handling and retry logic
 */
export function withActionLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  buttonId: string,
  moduleName: string,
  actionType: ActionType
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const startTime = performance.now();
    let result: ActionResult = 'success';
    let errorMessage: string | undefined;
    
    try {
      const response = await fn(...args);
      return response as ReturnType<T>;
    } catch (error) {
      result = 'failure';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const responseTimeMs = Math.round(performance.now() - startTime);
      
      // Log asynchronously without blocking - with retry
      const logWithRetry = async (retries = 2) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const insertData = {
            user_id: user?.id || null,
            button_id: buttonId,
            module_name: moduleName,
            action_type: actionType,
            action_result: result,
            response_time_ms: responseTimeMs,
            error_message: errorMessage || null,
            user_agent: navigator.userAgent,
          };
          
          const { error } = await supabase.from('action_logs').insert(insertData);
          if (error && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
            return logWithRetry(retries - 1);
          }
        } catch (err) {
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
            return logWithRetry(retries - 1);
          }
          console.error('[ActionLogger] HOF logging failed:', err);
        }
      };
      
      logWithRetry();
    }
  };
}

export default useActionLogger;
