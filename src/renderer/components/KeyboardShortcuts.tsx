import { useEffect } from 'react';
import { useAppStore } from '../store/app-store';

function useKeyboardShortcuts() {
  const {
    saveScreenplay,
    toggleAIChat,
    setShowExportModal,
    setIsSettingsOpen,
    analyzeStoryline,
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + S: Save
      if (modifier && e.key === 's') {
        e.preventDefault();
        saveScreenplay();
      }

      // Cmd/Ctrl + Shift + A: Toggle AI Chat
      if (modifier && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        toggleAIChat();
      }

      // Cmd/Ctrl + E: Export
      if (modifier && e.key === 'e') {
        e.preventDefault();
        setShowExportModal(true);
      }

      // Cmd/Ctrl + ,: Settings
      if (modifier && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }

      // Cmd/Ctrl + Shift + L: Analyze Storyline
      if (modifier && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        analyzeStoryline();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveScreenplay, toggleAIChat, setShowExportModal, setIsSettingsOpen, analyzeStoryline]);
}

export default function KeyboardShortcuts() {
  useKeyboardShortcuts();
  return null;
}

