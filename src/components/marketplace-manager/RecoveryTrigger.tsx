/**
 * Marketplace Recovery Trigger - One-time setup component
 * Automatically runs recovery when accessed, then redirects
 */

import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@/lib/marketplace-manager/localFn';
import { recoverMarketplaceData } from '@/lib/marketplace.functions';

export function RecoveryTrigger() {
  const navigate = useNavigate();
  const recoveryFn = useServerFn(recoverMarketplaceData);

  useEffect(() => {
    (async () => {
      try {
        console.log('🚀 Triggering marketplace recovery...');
        const result = await (recoveryFn as any)();
        console.log('✅ Recovery result:', result);
        
        // Wait 1 second then redirect
        setTimeout(() => {
          navigate({ to: '/marketplace' });
        }, 1000);
      } catch (err) {
        console.error('❌ Recovery failed:', err);
        setTimeout(() => {
          navigate({ to: '/marketplace' });
        }, 2000);
      }
    })();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin mb-4">
          <svg className="h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Restoring Marketplace Data</h1>
        <p className="text-gray-600">This may take a moment...</p>
      </div>
    </div>
  );
}
