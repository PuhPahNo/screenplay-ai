import { useState, useEffect } from 'react';
import { useAppStore } from '../store/app-store';
import { Sun, Moon } from 'lucide-react';

export default function SettingsModal() {
  const { globalSettings, saveGlobalSettings, setIsSettingsOpen } = useAppStore();
  
  const [apiKey, setApiKey] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'fdx' | 'fountain'>('pdf');

  useEffect(() => {
    if (globalSettings) {
      setApiKey(globalSettings.openaiApiKey || '');
      setTheme(globalSettings.defaultTheme || 'dark');
      setExportFormat(globalSettings.defaultExportFormat || 'pdf');
    }
  }, [globalSettings]);

  const handleSave = async () => {
    try {
      await saveGlobalSettings({
        openaiApiKey: apiKey,
        defaultTheme: theme,
        defaultExportFormat: exportFormat,
      });
      setIsSettingsOpen(false);
    } catch (error) {
      alert('Failed to save settings: ' + error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-surface rounded-xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Settings</h2>

        <div className="space-y-6">
          {/* OpenAI API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Get your API key from{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 underline"
              >
                platform.openai.com
              </a>
              . Your key is encrypted and stored securely using your system's keychain.
            </p>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setTheme('light');
                  document.documentElement.classList.remove('dark');
                }}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                  theme === 'light'
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-dark-border'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
              <button
                onClick={() => {
                  setTheme('dark');
                  document.documentElement.classList.add('dark');
                }}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                  theme === 'dark'
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-dark-border'
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
            </div>
          </div>

          {/* Default Export Format */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Default Export Format
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="pdf">PDF</option>
              <option value="fountain">Fountain</option>
              <option value="fdx">Final Draft (FDX)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

