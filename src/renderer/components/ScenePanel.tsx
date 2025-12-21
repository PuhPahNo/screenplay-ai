import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../store/app-store';
import { Film, Plus, ChevronRight, Search } from 'lucide-react';
import type { IndexedScene } from '../../screenplay/scene-indexer';

interface ScenePanelProps {
  onSceneClick?: (sceneStartLineIndex: number) => void;
}

/**
 * SceneCard - Displays a single scene in the sidebar
 * Uses IndexedScene from SceneIndexer for accurate line indices
 */
function SceneCard({ 
  scene, 
  onClick,
  isSelected,
}: { 
  scene: IndexedScene; 
  onClick: () => void;
  isSelected: boolean;
}) {
  const getTimeOfDayColor = (timeOfDay: string) => {
    const tod = timeOfDay.toLowerCase();
    if (tod.includes('day')) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (tod.includes('night')) return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    if (tod.includes('dawn') || tod.includes('dusk')) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  };

  return (
    <div
        onClick={onClick}
      className={`group relative bg-white dark:bg-dark-surface border rounded-lg p-3 transition-all duration-200 hover:shadow-md cursor-pointer ${
        isSelected 
          ? 'border-primary-500 dark:border-primary-400 shadow-md ring-2 ring-primary-200 dark:ring-primary-800' 
          : 'border-gray-200 dark:border-dark-border hover:border-primary-400 dark:hover:border-primary-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Scene Number - Large and Prominent */}
        <div className="flex-shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
            isSelected 
              ? 'bg-primary-500 dark:bg-primary-400' 
              : 'bg-primary-600 dark:bg-primary-700'
          }`}>
            <span className="text-lg font-bold text-white">
              {scene.number}
            </span>
          </div>
        </div>

        {/* Scene Info - Compact */}
        <div className="flex-1 min-w-0">
          {/* Scene Heading - Single Line */}
          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate mb-1">
            {scene.heading}
          </h4>

          {/* Metadata - Inline and Minimal */}
          <div className="flex items-center gap-2 text-xs">
            {scene.timeOfDay && (
              <span className={`px-2 py-0.5 rounded-full font-medium ${getTimeOfDayColor(scene.timeOfDay)}`}>
                {scene.timeOfDay}
              </span>
            )}
            
            {scene.characters.length > 0 && (
              <span className="text-gray-500 dark:text-gray-400">
                {scene.characters.length} {scene.characters.length === 1 ? 'character' : 'characters'}
              </span>
            )}
          </div>
        </div>

        {/* Navigation Arrow */}
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

/**
 * ScenePanel - Displays all scenes parsed from screenplay content
 * 
 * Uses parsedScenes from SceneIndexer (single source of truth) rather than
 * DB-backed scenes. Scene counts and navigation are deterministic and
 * always match what's in the screenplay text.
 */
export default function ScenePanel({ onSceneClick }: ScenePanelProps) {
  const { parsedScenes, screenplayContent, setScreenplayContent, saveScreenplay } = useAppStore();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newSceneHeading, setNewSceneHeading] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredScenes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parsedScenes;
    return parsedScenes.filter((scene) => {
      if (scene.heading.toLowerCase().includes(q)) return true;
      if (scene.location?.toLowerCase().includes(q)) return true;
      if (scene.timeOfDay?.toLowerCase().includes(q)) return true;
      if (scene.characters.some((c) => c.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [parsedScenes, searchQuery]);

  const handleSceneClick = useCallback((scene: IndexedScene) => {
    setSelectedSceneId(scene.id);
    if (onSceneClick) {
      console.log('[ScenePanel] Navigating to scene:', scene.number, 'at line index:', scene.startLineIndex);
      onSceneClick(scene.startLineIndex);
    }
  }, [onSceneClick]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const heading = newSceneHeading.trim();
    
    if (!heading) {
      setIsCreating(false);
      return;
    }

    console.log('[ScenePanel] Creating scene with heading:', heading);

    try {
      // Insert the new scene heading into the screenplay content
      // Add it at the end with proper formatting
      const formattedHeading = heading.toUpperCase();
      const newContent = `${screenplayContent.trimEnd()}\n\n${formattedHeading}\n\n`;
      
      setScreenplayContent(newContent);
      await saveScreenplay();

      // The store will automatically reindex scenes via setScreenplayContent
      // So parsedScenes will update with the new scene
      
      // Reset state
      setNewSceneHeading('');
      setIsCreating(false);
      
      console.log('[ScenePanel] Scene added to screenplay content');
    } catch (error) {
      console.error('[ScenePanel] Failed to create scene:', error);
    }
  };

  const handleCreateCancel = () => {
    setIsCreating(false);
    setNewSceneHeading('');
  };

  // Empty state
  if (parsedScenes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 p-6 rounded-2xl mb-6 inline-block">
            <Film className="w-16 h-16 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Scenes Yet
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Start writing your screenplay with scene headings and they'll appear here automatically.
          </p>
          <div className="bg-gray-100 dark:bg-dark-bg rounded-xl p-4 space-y-2">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Scene Heading Examples:
            </p>
            <code className="block text-xs font-mono text-primary-600 dark:text-primary-400 bg-white dark:bg-dark-surface px-3 py-2 rounded-lg">
              INT. COFFEE SHOP - DAY
            </code>
            <code className="block text-xs font-mono text-primary-600 dark:text-primary-400 bg-white dark:bg-dark-surface px-3 py-2 rounded-lg">
              EXT. CITY STREET - NIGHT
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Scenes ({filteredScenes.length}{searchQuery.trim() ? `/${parsedScenes.length}` : ''})
          </h3>
          <button
            onClick={() => setIsCreating(true)}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1.5 shadow-md"
            title="Add new scene"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Click to navigate to scene
        </p>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scenes..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* New Scene Input */}
      {isCreating && (
        <div className="p-4 bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
          <form onSubmit={handleCreateSubmit}>
            <input
              autoFocus
              type="text"
              value={newSceneHeading}
              onChange={(e) => setNewSceneHeading(e.target.value)}
              placeholder="INT. LOCATION - DAY"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-sm mb-2"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCreateCancel}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Scenes List - Simple list, no drag-and-drop since scene order is determined by screenplay text */}
      <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
          {filteredScenes.map((scene) => (
            <SceneCard
                  key={scene.id}
                  scene={scene}
              onClick={() => handleSceneClick(scene)}
              isSelected={selectedSceneId === scene.id}
                />
              ))}
            </div>
      </div>
    </div>
  );
}
