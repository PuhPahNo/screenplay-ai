import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../store/app-store';
import { Check, X, AlertCircle, Upload, Users, Film, BarChart3, Save, MessageSquare, Sparkles } from 'lucide-react';
import ScreenplayEditor, { type ScreenplayEditorHandle, type EditorStatus } from './ScreenplayEditor';
import FormattingToolbar from './FormattingToolbar';
import AIChat from './AIChat';
import CharacterPanel from './CharacterPanel';
import ScenePanel from './ScenePanel';
import StorylinePanel from './StorylinePanel';
import AgenticAssistant from './AgenticAssistant';
import { CleanupReviewModal, type CleanupSuggestion } from './CleanupReviewModal';
import type { ElementType } from '../../shared/types';

export default function Editor() {
  console.log('[Editor] Component rendering');

  const {
    currentProject,
    screenplayContent,
    setScreenplayContent,
    saveScreenplay,
    isAIChatOpen,
    activePanel,
    setActivePanel,
    globalSettings,
    pendingEdit,
    applyEdit,
    rejectEdit,
    characters,
    scenes,
    loadCharacters,
    loadScenes,
  } = useAppStore();

  console.log('[Editor] Project:', currentProject?.name, 'Content length:', screenplayContent?.length);

  const editorRef = useRef<ScreenplayEditorHandle>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentElement, setCurrentElement] = useState<ElementType>('action');
  const [isFormatLocked, setIsFormatLocked] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [editorStatus, setEditorStatus] = useState<EditorStatus>({
    elementType: 'action',
    lineNumber: 1,
    pageNumber: 1,
    totalPages: 1,
  });

  // Panel sizes
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(384);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(200, Math.min(600, e.clientX));
        setLeftPanelWidth(newWidth);
      }
      if (isResizingRight) {
        const newWidth = Math.max(250, Math.min(600, window.innerWidth - e.clientX));
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
      document.body.style.cursor = 'default';
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  const handleEditorChange = (value: string) => {
    setScreenplayContent(value);
  };

  const handleToggleLock = () => {
    setIsFormatLocked(!isFormatLocked);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveScreenplay();
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyzeScreenplay = async () => {
    if (!globalSettings?.openaiApiKey) {
      alert('Please configure your OpenAI API key in Settings before analyzing.');
      return;
    }

    try {
      setIsSaving(true);
      // First save the current content
      await saveScreenplay();

      // Parse and extract characters/scenes
      const parsed = await window.api.parse.fountain(screenplayContent);

      // Save parsed data to database
      for (const scene of parsed.scenes) {
        await window.api.db.saveScene(scene);
      }

      for (const scene of parsed.scenes) {
        for (const charName of scene.characters) {
          const existing = useAppStore.getState().characters.find(c =>
            c.id === charName || c.name.toUpperCase() === charName.toUpperCase()
          );

          if (!existing) {
            const newChar = {
              id: charName,
              name: charName,
              description: '',
              arc: '',
              relationships: {},
              appearances: [scene.id],
            };
            await window.api.db.saveCharacter(newChar);
          }
        }
      }

      // Reload data
      await useAppStore.getState().loadCharacters();
      await useAppStore.getState().loadScenes();

      alert(`Analysis complete! Found ${parsed.scenes.length} scenes and extracted characters.`);
    } catch (error) {
      console.error('Failed to analyze screenplay:', error);
      alert('Failed to analyze screenplay: ' + error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSceneClick = useCallback((sceneStartLine: number) => {
    if (editorRef.current) {
      editorRef.current.scrollToLine(sceneStartLine);
    }
  }, []);

  // Handle cleanup suggestions
  const handleApplyCleanup = async (suggestions: CleanupSuggestion[]) => {
    console.log('[Cleanup] Starting cleanup with', suggestions.length, 'suggestions');
    
    // Get fresh data from the store to avoid stale closures
    const currentCharacters = useAppStore.getState().characters;
    const currentScenes = useAppStore.getState().scenes;
    
    console.log('[Cleanup] Current characters:', currentCharacters.map(c => c.name));
    console.log('[Cleanup] Current scenes:', currentScenes.length);
    
    let deletedCount = 0;
    let mergedCount = 0;
    let addedCount = 0;
    
    for (const suggestion of suggestions) {
      console.log('[Cleanup] Processing:', suggestion.type, suggestion.category, suggestion.items);
      
      if (suggestion.category === 'character') {
        if (suggestion.type === 'delete') {
          // Delete each character in the items list
          for (const charName of suggestion.items) {
            // Case-insensitive matching
            const char = currentCharacters.find(c => 
              c.name.toUpperCase().trim() === charName.toUpperCase().trim()
            );
            if (char) {
              console.log('[Cleanup] Deleting character:', char.name, 'ID:', char.id);
              await window.api.db.deleteCharacter(char.id);
              deletedCount++;
            } else {
              console.warn('[Cleanup] Character not found:', charName);
            }
          }
        } else if (suggestion.type === 'merge' && suggestion.targetName) {
          // Keep the target, delete the rest
          const targetChar = currentCharacters.find(c => 
            c.name.toUpperCase().trim() === suggestion.targetName!.toUpperCase().trim()
          );
          
          if (!targetChar) {
            console.warn('[Cleanup] Target character not found:', suggestion.targetName);
            continue;
          }
          
          console.log('[Cleanup] Merging into:', targetChar.name);
          
          for (const charName of suggestion.items) {
            if (charName.toUpperCase().trim() !== suggestion.targetName.toUpperCase().trim()) {
              const char = currentCharacters.find(c => 
                c.name.toUpperCase().trim() === charName.toUpperCase().trim()
              );
              if (char) {
                // Merge appearances into target
                const mergedAppearances = [...new Set([
                  ...targetChar.appearances,
                  ...char.appearances
                ])];
                await window.api.db.saveCharacter({
                  ...targetChar,
                  appearances: mergedAppearances,
                });
                console.log('[Cleanup] Deleting merged character:', char.name);
                await window.api.db.deleteCharacter(char.id);
                mergedCount++;
              }
            }
          }
        } else if (suggestion.type === 'add') {
          // Add new character detected by AI
          for (const charName of suggestion.items) {
            console.log('[Cleanup] Adding new character:', charName);
            const newCharacter = {
              id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: charName.toUpperCase(),
              description: 'AI-detected character',
              appearances: [],
              dialogueCount: 0,
              firstAppearance: 0,
              arc: '',
              age: '',
              occupation: '',
              personality: '',
              backstory: '',
              goals: '',
              role: '',
            };
            await window.api.db.saveCharacter(newCharacter);
            addedCount++;
          }
        }
      } else if (suggestion.category === 'scene') {
        if (suggestion.type === 'delete') {
          // Delete scenes by extracting ID from the label
          for (const sceneLabel of suggestion.items) {
            const match = sceneLabel.match(/Scene (\d+):/);
            if (match) {
              const sceneNum = parseInt(match[1], 10);
              const scene = currentScenes.find(s => s.number === sceneNum);
              if (scene) {
                console.log('[Cleanup] Deleting scene:', scene.number, scene.heading);
                await window.api.db.deleteScene(scene.id);
                deletedCount++;
              } else {
                console.warn('[Cleanup] Scene not found:', sceneNum);
              }
            }
          }
        } else if (suggestion.type === 'add') {
          // Add new scene detected by AI
          for (const sceneHeading of suggestion.items) {
            console.log('[Cleanup] Adding new scene:', sceneHeading);
            const newScene = {
              id: `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              number: currentScenes.length + 1 + addedCount,
              heading: sceneHeading.toUpperCase(),
              content: '',
              startLine: 0,
              endLine: 0,
              characters: [],
              summary: '',
              mood: '',
              notes: '',
            };
            await window.api.db.saveScene(newScene);
            addedCount++;
          }
        }
      }
    }

    console.log('[Cleanup] Completed. Deleted:', deletedCount, 'Merged:', mergedCount, 'Added:', addedCount);

    // Reload data after cleanup
    await loadCharacters();
    await loadScenes();
  };

  // Handle "Sync All from AI" - completely replace database with LLM analysis
  const handleSyncFromLLM = async (analysis: {
    characters: Array<{ name: string; normalizedName: string; dialogueCount: number; firstAppearance: number }>;
    scenes: Array<{ number: number; heading: string; location: string; timeOfDay: string; lineNumber: number }>;
  }) => {
    console.log('[Cleanup] Syncing all data from LLM analysis...');
    
    // Get fresh data
    const currentCharacters = useAppStore.getState().characters;
    const currentScenes = useAppStore.getState().scenes;
    
    // Delete all existing characters
    for (const char of currentCharacters) {
      await window.api.db.deleteCharacter(char.id);
    }
    
    // Delete all existing scenes
    for (const scene of currentScenes) {
      await window.api.db.deleteScene(scene.id);
    }
    
    // Add all characters from LLM
    for (const llmChar of analysis.characters) {
      const newCharacter = {
        id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: llmChar.normalizedName.toUpperCase(),
        description: 'AI-detected character',
        appearances: [],
        dialogueCount: llmChar.dialogueCount,
        firstAppearance: llmChar.firstAppearance,
        arc: '',
        age: '',
        occupation: '',
        personality: '',
        backstory: '',
        goals: '',
        role: '',
      };
      await window.api.db.saveCharacter(newCharacter);
    }
    
    // Add all scenes from LLM
    for (const llmScene of analysis.scenes) {
      const newScene = {
        id: `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        number: llmScene.number,
        heading: llmScene.heading.toUpperCase(),
        content: '',
        startLine: llmScene.lineNumber,
        endLine: llmScene.lineNumber,
        characters: [],
        summary: '',
        mood: '',
        notes: '',
      };
      await window.api.db.saveScene(newScene);
    }
    
    console.log('[Cleanup] Sync complete. Added', analysis.characters.length, 'characters and', analysis.scenes.length, 'scenes');
    
    // Reload data
    await loadCharacters();
    await loadScenes();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenplayContent]);

  const theme = globalSettings?.defaultTheme || 'dark';

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header - Distinct from content areas */}
      <div className="h-14 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-dark-surface dark:to-dark-bg border-b-2 border-gray-300 dark:border-dark-border flex items-center justify-between px-6 shadow-md">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{currentProject?.name}</h2>
          {isSaving && (
            <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-full border border-primary-200 dark:border-primary-800">
              Saving...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePanel(activePanel === 'characters' ? null : 'characters')}
            title="Manage your screenplay characters and their relationships"
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 border ${activePanel === 'characters'
                ? 'bg-purple-600 text-white border-purple-700 shadow-lg shadow-purple-600/40'
                : 'bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-300 border-gray-300 dark:border-dark-border hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md'
              }`}
          >
            <Users className="w-4 h-4" />
            <span>Characters</span>
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'scenes' ? null : 'scenes')}
            title="View and organize your scenes with drag-and-drop"
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 border ${activePanel === 'scenes'
                ? 'bg-primary-600 text-white border-primary-700 shadow-lg shadow-primary-600/40'
                : 'bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-300 border-gray-300 dark:border-dark-border hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md'
              }`}
          >
            <Film className="w-4 h-4" />
            <span>Scenes</span>
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'storyline' ? null : 'storyline')}
            title="Analyze story structure and plot points"
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 border ${activePanel === 'storyline'
                ? 'bg-blue-600 text-white border-blue-700 shadow-lg shadow-blue-600/40'
                : 'bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-300 border-gray-300 dark:border-dark-border hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
              }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Storyline</span>
          </button>
          <div className="w-px h-8 bg-gray-300 dark:bg-dark-border mx-3" />
          <button
            onClick={() => useAppStore.getState().toggleAIChat()}
            title="AI Assistant (Cmd/Ctrl+K)"
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 border ${isAIChatOpen
                ? 'bg-blue-600 text-white border-blue-700 shadow-lg shadow-blue-600/40'
                : 'bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-300 border-gray-300 dark:border-dark-border hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
              }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Chat</span>
          </button>
          <button
            onClick={handleAnalyzeScreenplay}
            disabled={!screenplayContent || !globalSettings?.openaiApiKey || isSaving}
            title={!globalSettings?.openaiApiKey ? "Configure API key in Settings first" : "Parse screenplay to extract characters and scenes"}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 border ${!screenplayContent || !globalSettings?.openaiApiKey || isSaving
                ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                : 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700 shadow-md'
              }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analyze</span>
          </button>
          <button
            onClick={() => setShowCleanupModal(true)}
            disabled={characters.length === 0 && scenes.length === 0}
            title="Clean up duplicate or incorrectly detected characters and scenes"
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 border ${characters.length === 0 && scenes.length === 0
                ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                : 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700 shadow-md'
              }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Clean Up</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            title="Save screenplay (Cmd+S)"
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 border border-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          <button
            onClick={() => useAppStore.getState().setShowExportModal(true)}
            title="Export to PDF, Final Draft, or Fountain"
            className="px-4 py-2 text-sm font-medium bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-lg transition-all duration-200 hover:shadow-md flex items-center gap-2 border border-gray-300 dark:border-dark-border"
          >
            <Upload className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Pending Edit Banner */}
      {pendingEdit && (
        <div className="bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800 p-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-800 rounded-full">
              <AlertCircle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                AI Suggested Change
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {pendingEdit.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={rejectEdit}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg flex items-center gap-2 transition-colors"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={applyEdit}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              Accept Change
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-dark-bg relative">
        {/* Side Panel */}
        {activePanel && (
          <>
            <div
              className="flex-shrink-0 border-r border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface overflow-y-auto shadow-sm"
              style={{ width: leftPanelWidth }}
            >
              {activePanel === 'characters' && <CharacterPanel />}
              {activePanel === 'scenes' && <ScenePanel onSceneClick={handleSceneClick} />}
              {activePanel === 'storyline' && <StorylinePanel />}
            </div>
            {/* Resize Handle Left */}
            <div
              className="w-1 hover:bg-primary-500 cursor-col-resize transition-colors bg-gray-200 dark:bg-dark-border z-10"
              onMouseDown={() => setIsResizingLeft(true)}
            />
          </>
        )}

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
          {/* Diff Overlay */}
          {pendingEdit && (
            <div className="absolute inset-0 z-20 bg-white/95 dark:bg-dark-bg/95 p-8 overflow-y-auto font-mono text-sm leading-relaxed backdrop-blur-sm">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30">
                  <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">Original</h4>
                  <pre className="whitespace-pre-wrap text-red-800 dark:text-red-300">{pendingEdit.original}</pre>
                </div>
                <div className="flex justify-center">
                  <div className="h-8 w-px bg-gray-300 dark:bg-gray-700"></div>
                </div>
                <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-900/30">
                  <h4 className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">Proposed Change</h4>
                  <pre className="whitespace-pre-wrap text-green-800 dark:text-green-300">{pendingEdit.modified}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Formatting Toolbar */}
          <FormattingToolbar
            currentElement={currentElement}
            isLocked={isFormatLocked}
            onElementChange={(type) => {
              // Use applyFormat to actually change the current line's formatting
              editorRef.current?.applyFormat(type);
            }}
            onToggleLock={handleToggleLock}
          />

          {/* Screenplay Editor */}
          <div className="flex-1 overflow-hidden">
            <ScreenplayEditor
              ref={editorRef}
              value={screenplayContent}
              onChange={handleEditorChange}
              currentElement={currentElement}
              isFormatLocked={isFormatLocked}
              onCurrentElementChange={setCurrentElement}
              onSave={handleSave}
              onStatusChange={setEditorStatus}
              theme={theme}
            />
          </div>

          {/* Status Bar */}
          <div className="editor-status-bar">
            <div className="status-bar-left">
              <span className={`status-element-type ${editorStatus.elementType}`}>
                {editorStatus.elementType.replace('-', ' ')}
              </span>
              <span>Line {editorStatus.lineNumber}</span>
            </div>
            <div className="status-bar-right">
              <span>Page {editorStatus.pageNumber} of {editorStatus.totalPages}</span>
            </div>
          </div>
        </div>

        {/* AI Chat */}
        {isAIChatOpen && (
          <>
            {/* Resize Handle Right */}
            <div
              className="w-1 hover:bg-primary-500 cursor-col-resize transition-colors bg-gray-200 dark:bg-dark-border z-10"
              onMouseDown={() => setIsResizingRight(true)}
            />
            <div
              className="flex-shrink-0 border-l border-gray-200 dark:border-dark-border shadow-sm bg-white dark:bg-dark-surface"
              style={{ width: rightPanelWidth }}
            >
              <AIChat />
            </div>
          </>
        )}
      </div>

      {/* Agentic AI Assistant */}
      <AgenticAssistant />

      {/* Cleanup Modal */}
      <CleanupReviewModal
        isOpen={showCleanupModal}
        onClose={() => setShowCleanupModal(false)}
        characters={characters}
        scenes={scenes}
        screenplayContent={screenplayContent}
        onApplyCleanup={handleApplyCleanup}
        onSyncFromLLM={handleSyncFromLLM}
      />
    </div>
  );
}
