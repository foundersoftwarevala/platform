/**
 * SUPPORT CHATBOT DASHBOARD
 * User-friendly, production-ready SaaS interface
 */

import React from 'react';
import type { ChatbotSection } from './types';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Plus, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CBOverview } from './screens/CBOverview';
import { CBChatbotManagement } from './screens/CBChatbotManagement';
import { CBLiveChatInbox } from './screens/CBLiveChatInbox';
import { CBBotTraining } from './screens/CBBotTraining';
import { CBAutomationRules } from './screens/CBAutomationRules';
import { CBMultiLanguage } from './screens/CBMultiLanguage';
import { CBAndroidIntegration } from './screens/CBAndroidIntegration';
import { CBAnalyticsLogs } from './screens/CBAnalyticsLogs';

export const SupportChatbotDashboard: React.FC = () => {
  const { section } = useSearch({ from: '/support-chatbot' });
  const activeSection = (section ?? 'overview') as ChatbotSection;
  const navigate = useNavigate();

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <CBOverview />;
      case 'chatbots':
        return <CBChatbotManagement />;
      case 'live-chat':
        return <CBLiveChatInbox />;
      case 'training':
        return <CBBotTraining />;
      case 'automation':
        return <CBAutomationRules />;
      case 'languages':
        return <CBMultiLanguage />;
      case 'android':
        return <CBAndroidIntegration />;
      case 'analytics':
        return <CBAnalyticsLogs />;
      default:
        return <CBOverview />;
    }
  };

  return (
    <div className="flex min-h-full w-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => {
                navigate({ to: '/support-chatbot', search: { section: 'chatbots' } });
                toast.success('New chatbot draft created — opening chatbot management');
              }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-primary/25"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chatbot
            </button>
            <button
              onClick={() => {
                navigate({ to: '/support-chatbot', search: { section: 'training' } });
                toast.info('Chatbot guide: upload knowledge, train, then publish to a channel.');
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Help
            </button>
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
