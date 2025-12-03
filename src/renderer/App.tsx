import { useEffect, useState } from 'react';
import { useAppStore } from './store/app-store';
import WelcomeScreen from './components/WelcomeScreen';
import Editor from './components/Editor';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import AnalyzePromptModal from './components/AnalyzePromptModal';
import VersionHistory from './components/VersionHistory';

function App() {
  const { 
    currentProject, 
    isSettingsOpen, 
    showExportModal, 
    showAnalyzePrompt, 
    setShowExportModal, 
    loadGlobalSettings,
    updateState,
    setUpdateState
  } = useAppStore();
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  useEffect(() => {
    // Load global settings on startup
    loadGlobalSettings();

    // Listen for auto-updater events
    window.api.on('update-downloading', (version: string) => {
      setUpdateState({ status: 'downloading', version });
    });

    window.api.on('update-progress', (progress: any) => {
      setUpdateState({ status: 'downloading', progress });
    });

    window.api.on('update-downloaded', (info: any) => {
      setUpdateState({ status: 'downloaded', version: info.version });
    });

    window.api.on('update-error', (error: string) => {
      setUpdateState({ status: 'error', error });
    });

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

    window.api.on('menu:save-as', async () => {
      const newPath = await window.api.project.saveAs();
      if (newPath) {
        alert(`Project saved to: ${newPath}`);
      }
    });

    window.api.on('menu:version-history', () => {
      setShowVersionHistory(true);
    });

    window.api.on('menu:create-version', async () => {
      const message = prompt('Enter a version message (e.g., "Completed Act 1"):');
      if (message) {
        try {
          await window.api.version.create(message);
          alert('Version created successfully!');
        } catch (error) {
          alert('Failed to create version');
        }
      }
    });

    window.api.on('menu:export', async (format: string) => {
      try {
        const outputPath = await window.api.export.showSaveDialog(format);
        if (outputPath) {
          if (format === 'fountain') {
            await window.api.export.fountain(outputPath);
          } else if (format === 'pdf') {
            await window.api.export.pdf(outputPath);
          } else if (format === 'fdx') {
            await window.api.export.fdx(outputPath);
          } else if (format === 'txt') {
            await window.api.export.txt(outputPath);
          }
          alert(`Exported successfully to: ${outputPath}`);
        }
      } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed');
      }
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
      window.api.off('update-downloading', () => { });
      window.api.off('update-progress', () => { });
      window.api.off('update-downloaded', () => { });
      window.api.off('update-error', () => { });
      window.api.off('menu:new-project', () => { });
      window.api.off('menu:open-project', () => { });
      window.api.off('menu:save', () => { });
      window.api.off('menu:save-as', () => { });
      window.api.off('menu:version-history', () => { });
      window.api.off('menu:create-version', () => { });
      window.api.off('menu:export', () => { });
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
      <VersionHistory isOpen={showVersionHistory} onClose={() => setShowVersionHistory(false)} />
      
      {/* Update Progress UI */}
      {updateState.status === 'downloading' && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 w-80">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-sm">Downloading Update...</span>
            <span className="text-xs text-gray-500">{updateState.progress?.percent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${updateState.progress?.percent}%` }}></div>
          </div>
          {updateState.progress && (
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>{((updateState.progress.transferred || 0) / (1024 * 1024)).toFixed(1)} MB / {((updateState.progress.total || 0) / (1024 * 1024)).toFixed(1)} MB</span>
              <span>{((updateState.progress.bytesPerSecond || 0) / (1024 * 1024)).toFixed(1)} MB/s</span>
            </div>
          )}
        </div>
      )}
      
      {updateState.status === 'downloaded' && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border-l-4 border-green-500 z-50 w-80">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-green-600 dark:text-green-400">Update Ready!</span>
            <p className="text-sm text-gray-600 dark:text-gray-300">Version {updateState.version} has been downloaded.</p>
            <p className="text-xs text-gray-500 italic">Restart to apply updates.</p>
          </div>
        </div>
      )}

      {updateState.status === 'error' && updateState.error && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border-l-4 border-red-500 z-50 w-80">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-red-600">Update Failed</span>
            <p className="text-sm text-gray-600 dark:text-gray-300">{updateState.error}</p>
            <button 
              onClick={() => setUpdateState({ status: 'idle', error: undefined })}
              className="text-xs text-gray-500 underline hover:text-gray-700 self-start"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

