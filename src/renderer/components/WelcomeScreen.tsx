import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { FileText, FolderOpen, Settings as SettingsIcon, AlertCircle, Play } from 'lucide-react';
import { DEMO_SCREENPLAY, getDemoCharacters, getDemoScenes } from '../../data/demo-screenplay';

export default function WelcomeScreen() {
  const {
    createProject,
    openProject,
    globalSettings,
    setIsSettingsOpen,
    showNewProjectModal,
    setShowNewProjectModal,
    setShowOpenProjectModal
  } = useAppStore();

  const [projectName, setProjectName] = useState('');

  const handleCreateProject = async () => {
    if (!projectName) {
      alert('Please enter a project name');
      return;
    }

    const folder = await window.api.file.selectFolder();
    if (folder) {
      try {
        await createProject(projectName, folder);
        setShowNewProjectModal(false);
        setProjectName('');
      } catch (error) {
        alert('Failed to create project: ' + error);
      }
    }
  };

  const handleOpenProject = async () => {
    const folder = await window.api.file.selectFolder();
    if (folder) {
      try {
        await openProject(folder);
        setShowOpenProjectModal(false);
      } catch (error) {
        alert('Failed to open project: ' + error);
      }
    }
  };

  const handleOpenRecent = async (path: string) => {
    try {
      await openProject(path);
    } catch (error) {
      alert('Failed to open project: ' + error);
    }
  };

  const handleLoadDemo = async () => {
    try {
      console.log('[Demo] Starting demo load...');

      // Create a demo project
      const folder = await window.api.file.selectFolder();
      if (!folder) {
        console.log('[Demo] User cancelled folder selection');
        return;
      }

      console.log('[Demo] Creating project in:', folder);

      // Create the project first
      await createProject('Demo Screenplay', folder);

      console.log('[Demo] Project created, waiting for initialization...');

      // Wait a bit for project to be fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear existing database to prevent duplication
      console.log('[Demo] Clearing existing database...');
      await window.api.db.clearDatabase();

      // Get fresh state reference
      const store = useAppStore.getState();

      console.log('[Demo] Setting screenplay content, length:', DEMO_SCREENPLAY.length);

      // Set demo content WITHOUT saving yet (to avoid auto-extraction)
      store.setScreenplayContent(DEMO_SCREENPLAY);

      console.log('[Demo] Adding characters FIRST...');

      // Pre-populate characters BEFORE saving screenplay
      const demoCharacters = getDemoCharacters();
      for (const char of demoCharacters) {
        try {
          await window.api.db.saveCharacter(char as any);
        } catch (error) {
          console.error('Failed to save demo character:', error);
        }
      }

      console.log('[Demo] Adding scenes...');

      // Pre-populate scenes
      const demoScenes = getDemoScenes();
      for (const scene of demoScenes) {
        try {
          await window.api.db.saveScene(scene);
        } catch (error) {
          console.error('Failed to save demo scene:', error);
        }
      }

      // LOAD DATA INTO STORE BEFORE SAVING SCREENPLAY
      // This prevents saveScreenplay from seeing them as "new" and duplicating them
      await store.loadCharacters();
      await store.loadScenes();

      console.log('[Demo] NOW saving screenplay (characters already exist)...');

      // NOW save the screenplay - auto-extraction will find existing characters and skip them
      await store.saveScreenplay();

      console.log('[Demo] Screenplay saved, waiting...');

      // Wait for save to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('[Demo] Reloading all data...');

      // Add demo storyline
      const demoStoryline = {
        id: 'demo-storyline',
        act: 1,
        plotPoints: [
          {
            id: 'plot-1',
            name: 'Opening Image',
            description: 'Anna struggling with writer\'s block in the coffee shop',
            timestamp: Date.now(),
          },
          {
            id: 'plot-2',
            name: 'Catalyst',
            description: 'Barista offers wisdom about the creative process',
            timestamp: Date.now(),
          },
          {
            id: 'plot-3',
            name: 'Breakthrough',
            description: 'Anna has a creative breakthrough at home',
            timestamp: Date.now(),
          },
          {
            id: 'plot-4',
            name: 'Resolution',
            description: 'Anna walks through the rain with her completed screenplay',
            timestamp: Date.now(),
          },
        ],
        themes: ['Creative Process', 'Perseverance', 'Self-Doubt', 'Breakthrough'],
        narrativeStructure: 'A compact three-act structure following a writer\'s journey from struggle to completion. The story uses meta-narrative elements, with the screenplay being written mirroring the creative process itself.',
      };

      try {
        await window.api.db.saveStoryline(demoStoryline);
      } catch (error) {
        console.error('Failed to save demo storyline:', error);
      }

      // Reload all data to populate panels
      await store.loadCharacters();
      await store.loadScenes();
      await store.loadStoryline();
      await store.loadScreenplay();

      console.log('[Demo] Demo loaded successfully!');

      setShowNewProjectModal(false);
    } catch (error) {
      console.error('Demo load error:', error);
      alert('Failed to load demo: ' + error);
    }
  };

  // Deduplicate recent projects
  const recentProjects = Array.from(new Set(globalSettings?.recentProjects || []));
  const hasApiKey = globalSettings?.openaiApiKey && globalSettings.openaiApiKey.length > 0;

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-2xl w-full mx-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-primary-700">
            Screenplay AI
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Professional screenplay writing powered by artificial intelligence
          </p>
        </div>

        {!hasApiKey && (
          <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                Please configure your OpenAI API key in settings to use AI features.
              </p>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="mt-2 text-sm text-primary-600 dark:text-primary-400 underline hover:no-underline"
              >
                Open Settings
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="p-8 bg-white dark:bg-dark-surface border-2 border-gray-200 dark:border-dark-border rounded-xl hover:border-primary-500 dark:hover:border-primary-500 transition-colors group"
          >
            <FileText className="w-12 h-12 mx-auto mb-4 text-primary-500 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
            <div className="font-semibold text-lg mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
              New Project
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Start a fresh screenplay
            </div>
          </button>

          <button
            onClick={handleOpenProject}
            className="p-8 bg-white dark:bg-dark-surface border-2 border-gray-200 dark:border-dark-border rounded-xl hover:border-primary-500 dark:hover:border-primary-500 transition-colors group"
          >
            <FolderOpen className="w-12 h-12 mx-auto mb-4 text-primary-500 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
            <div className="font-semibold text-lg mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
              Open Project
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Continue working on a project
            </div>
          </button>

          <button
            onClick={handleLoadDemo}
            className="p-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl hover:border-green-500 dark:hover:border-green-500 transition-colors group"
          >
            <Play className="w-12 h-12 mx-auto mb-4 text-green-600 dark:text-green-400 group-hover:text-green-700 dark:group-hover:text-green-300" />
            <div className="font-semibold text-lg mb-2 text-green-900 dark:text-green-100 group-hover:text-green-700 dark:group-hover:text-green-300">
              Try Demo
            </div>
            <div className="text-sm text-green-700 dark:text-green-400">
              Explore with sample content
            </div>
          </button>
        </div>

        {recentProjects.length > 0 && (
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6">
            <h3 className="font-semibold mb-4">Recent Projects</h3>
            <div className="space-y-2">
              {recentProjects.slice(0, 5).map((path) => (
                <button
                  key={path}
                  onClick={() => handleOpenRecent(path)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                >
                  <div className="font-medium text-sm truncate">{path.split('/').pop()}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{path}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">New Project</h2>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Screenplay"
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewProjectModal(false);
                  setProjectName('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

