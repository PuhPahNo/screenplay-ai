import { useEffect } from 'react';
import { useAppStore } from './store/app-store';
import WelcomeScreen from './components/WelcomeScreen';
import Editor from './components/Editor';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import AnalyzePromptModal from './components/AnalyzePromptModal';

function App() {
  const { currentProject, isSettingsOpen, showExportModal, showAnalyzePrompt, setShowExportModal, loadGlobalSettings } = useAppStore();

  useEffect(() => {
    // Load global settings on startup
    loadGlobalSettings();

    // Listen for menu events
    window.api.on('menu:new-project', () => {
      useAppStore.getState().setShowNewProjectModal(true);
    });

    window.api.on('menu:open-project', () => {
      useAppStore.getState().setShowOpenProjectModal(true);
    });

    window.api.on('menu:save', () => {
      useAppStore.getState().saveScreenplay();
    });

    window.api.on('menu:toggle-ai-chat', () => {
      useAppStore.getState().toggleAIChat();
    });

    window.api.on('menu:analyze-storyline', () => {
      useAppStore.getState().analyzeStoryline();
    });

    window.api.on('menu:export-pdf', () => {
      useAppStore.getState().setShowExportModal(true);
    });

    window.api.on('menu:open-settings', () => {
      useAppStore.getState().setIsSettingsOpen(true);
    });

    window.api.on('data:update', () => {
      console.log('[App] Received data update signal');
      useAppStore.getState().reloadData();
    });

    return () => {
      window.api.off('menu:new-project', () => { });
      window.api.off('menu:open-project', () => { });
      window.api.off('menu:save', () => { });
      window.api.off('menu:toggle-ai-chat', () => { });
      window.api.off('menu:analyze-storyline', () => { });
      window.api.off('menu:open-settings', () => { });
      window.api.off('data:update', () => { });
    };
  }, []);

  useEffect(() => {
    // Apply theme
    const theme = useAppStore.getState().globalSettings?.defaultTheme || 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  console.log('[App] Rendering - currentProject:', currentProject?.name || 'none');

  return (
    <div className="w-full h-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text">
      <KeyboardShortcuts />
      {!currentProject ? (
        <>
          {console.log('[App] Showing WelcomeScreen')}
          <WelcomeScreen />
        </>
      ) : (
        <>
          {console.log('[App] Showing Editor for project:', currentProject.name)}
          <Editor />
        </>
      )}
      {isSettingsOpen && <SettingsModal />}
      {showExportModal && <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />}
      {showAnalyzePrompt && <AnalyzePromptModal />}
    </div>
  );
}

export default App;

