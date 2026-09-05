/**
 * SUPPORT CHATBOT WIREFRAME
 * Low-fidelity enterprise SaaS dashboard
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { SCDashboard } from './screens/SCDashboard';
import { SCChatbotList } from './screens/SCChatbotList';
import { SCLiveChatInbox } from './screens/SCLiveChatInbox';
import { SCBotTraining } from './screens/SCBotTraining';
import { SCAutomationRules } from './screens/SCAutomationRules';
import { SCLanguages } from './screens/SCLanguages';
import { SCAnalytics } from './screens/SCAnalytics';
import { SCLogs } from './screens/SCLogs';
import { SCSettings } from './screens/SCSettings';

export type ChatbotScreen = 
  | 'dashboard'
  | 'chatbots'
  | 'live-chats'
  | 'training'
  | 'automation'
  | 'languages'
  | 'analytics'
  | 'logs'
  | 'settings';

interface SupportChatbotWireframeProps {
  onBack?: () => void;
}

export const SupportChatbotWireframe: React.FC<SupportChatbotWireframeProps> = ({ onBack }) => {
  const { section } = useSearch({ from: '/support-chatbot-blueprint' });
  const activeScreen = (section ?? 'dashboard') as ChatbotScreen;
  const navigate = useNavigate();
  const goTo = (screen: ChatbotScreen) =>
    navigate({ to: '/support-chatbot-blueprint', search: { section: screen } });

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <SCDashboard onNavigate={goTo} />;
      case 'chatbots':
        return <SCChatbotList />;
      case 'live-chats':
        return <SCLiveChatInbox />;
      case 'training':
        return <SCBotTraining />;
      case 'automation':
        return <SCAutomationRules />;
      case 'languages':
        return <SCLanguages />;
      case 'analytics':
        return <SCAnalytics />;
      case 'logs':
        return <SCLogs />;
      case 'settings':
        return <SCSettings />;
      default:
        return <SCDashboard onNavigate={goTo} />;
    }
  };

  return (
    <div className="flex min-h-full w-full">
      <div className="flex-1 flex flex-col min-w-0">

        <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-auto px-4 py-6 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScreen}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default SupportChatbotWireframe;
