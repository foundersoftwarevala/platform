/**
 * Internal Support AI Manager - Page Entry Point
 * Enterprise-grade, AI-first, Zero-friction Support System
 */

import React, { useEffect } from 'react';
import { InternalSupportAIContainer } from '@/components/internal-support-ai/InternalSupportAIContainer';


const InternalSupportAI: React.FC = () => {
  

  // Prevent right-click, copy, paste
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+C, Ctrl+V, Ctrl+X, PrintScreen
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x')) ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return <InternalSupportAIContainer />;
};

export default InternalSupportAI;
