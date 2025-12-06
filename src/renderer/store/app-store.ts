import { create } from 'zustand';
import type {
  Project,
  Character,
  Scene,
  Storyline,
  AIMessage,
  GlobalSettings,
  ProjectSettings,
  AIContext,
  PendingEdit,
  Conversation
} from '../../shared/types';

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  progress?: {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
  };
  error?: string;
}

interface AppState {
  // Project state
  currentProject: Project | null;
  screenplayContent: string;
  characters: Character[];
  scenes: Scene[];
  storyline: Storyline | null;
  aiHistory: AIMessage[];

  // Conversation state
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoadingConversations: boolean;

  // Settings
  globalSettings: GlobalSettings | null;
  projectSettings: ProjectSettings | null;

  // UI state
  isSettingsOpen: boolean;
  showNewProjectModal: boolean;
  showOpenProjectModal: boolean;
  showExportModal: boolean;
  showAnalyzePrompt: boolean;
  isAIChatOpen: boolean;
  selectedCharacterId: string | null;
  selectedSceneId: string | null;
  activePanel: 'characters' | 'scenes' | 'storyline' | null;
  pendingEdit: PendingEdit | null;
  updateState: UpdateState;
  chatMode: 'ask' | 'agent';

  // Actions
  setCurrentProject: (project: Project | null) => void;
  setScreenplayContent: (content: string) => void;
  setCharacters: (characters: Character[]) => void;
  setScenes: (scenes: Scene[]) => void;
  setStoryline: (storyline: Storyline | null) => void;
  setAIHistory: (history: AIMessage[]) => void;

  setTheme: (theme: 'light' | 'dark') => void;
  setIsSettingsOpen: (open: boolean) => void;
  setShowNewProjectModal: (show: boolean) => void;
  setShowOpenProjectModal: (show: boolean) => void;
  setShowExportModal: (show: boolean) => void;
  setShowAnalyzePrompt: (show: boolean) => void;
  toggleAIChat: () => void;
  setChatMode: (mode: 'ask' | 'agent') => void;
  setSelectedCharacterId: (id: string | null) => void;
  setSelectedSceneId: (id: string | null) => void;
  setActivePanel: (panel: 'characters' | 'scenes' | 'storyline' | null) => void;
  setPendingEdit: (edit: PendingEdit | null) => void;
  setUpdateState: (state: Partial<UpdateState>) => void;
  applyEdit: () => Promise<void>;
  rejectEdit: () => void;

  // Async actions
  createProject: (name: string, path: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  closeProject: () => Promise<void>;
  saveScreenplay: () => Promise<void>;
  loadScreenplay: () => Promise<void>;

  loadCharacters: () => Promise<void>;
  saveCharacter: (character: Character) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;

  loadScenes: () => Promise<void>;
  loadStoryline: () => Promise<void>;

  sendAIMessage: (message: string) => Promise<void>;
  analyzeStoryline: () => Promise<void>;
  reloadData: () => Promise<void>;

  // Conversation actions
  loadConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;

  loadGlobalSettings: () => Promise<void>;
  saveGlobalSettings: (settings: Partial<GlobalSettings>) => Promise<void>;
  loadProjectSettings: () => Promise<void>;
  saveProjectSettings: (settings: Partial<ProjectSettings>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  currentProject: null,
  screenplayContent: '',
  characters: [],
  scenes: [],
  storyline: null,
  aiHistory: [],
  conversations: [],
  currentConversationId: null,
  isLoadingConversations: false,
  globalSettings: null,
  projectSettings: null,
  isSettingsOpen: false,
  showNewProjectModal: false,
  showOpenProjectModal: false,
  showExportModal: false,
  showAnalyzePrompt: false,
  isAIChatOpen: false,
  selectedCharacterId: null,
  selectedSceneId: null,
  activePanel: null,
  pendingEdit: null,
  updateState: { status: 'idle' },
  chatMode: 'agent', // Default to agent mode for actions

  // Setters
  setCurrentProject: (project) => set({ currentProject: project }),
  setScreenplayContent: (content) => set({ screenplayContent: content }),
  setCharacters: (characters) => set({ characters }),
  setScenes: (scenes) => set({ scenes }),
  setStoryline: (storyline) => set({ storyline }),
  setAIHistory: (aiHistory) => set({ aiHistory }),

  setTheme: (theme) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
  setShowOpenProjectModal: (show) => set({ showOpenProjectModal: show }),
  setShowExportModal: (show) => set({ showExportModal: show }),
  setShowAnalyzePrompt: (show) => set({ showAnalyzePrompt: show }),
  toggleAIChat: () => set((state) => ({ isAIChatOpen: !state.isAIChatOpen })),
  setChatMode: (mode) => set({ chatMode: mode }),
  setSelectedCharacterId: (id) => set({ selectedCharacterId: id }),
  setSelectedSceneId: (id) => set({ selectedSceneId: id }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setPendingEdit: (edit) => set({ pendingEdit: edit }),
  setUpdateState: (updateState) => set((state) => ({
    updateState: { ...state.updateState, ...updateState }
  })),

  applyEdit: async () => {
    const { pendingEdit, screenplayContent, saveScreenplay } = get();
    if (!pendingEdit) return;

    // Simple string replacement for now - can be made more robust
    const newContent = screenplayContent.replace(pendingEdit.original, pendingEdit.modified);

    set({
      screenplayContent: newContent,
      pendingEdit: null
    });

    await saveScreenplay();
  },

  rejectEdit: () => set({ pendingEdit: null }),

  // Async actions
  createProject: async (name, path) => {
    try {
      const project = await window.api.project.create(name, path);
      set({ currentProject: project, activePanel: 'scenes' });
      await get().loadScreenplay();
      await get().loadCharacters();
      await get().loadScenes();
      await get().loadStoryline();
      await get().loadProjectSettings();
      
      // New project starts with empty conversations
      await get().loadConversations();
      set({ currentConversationId: null, aiHistory: [] });
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  },

  openProject: async (path) => {
    try {
      const project = await window.api.project.open(path);
      set({ currentProject: project });
      await get().loadScreenplay();
      await get().loadCharacters();
      await get().loadScenes();
      await get().loadStoryline();
      await get().loadProjectSettings();
      
      // Load project-specific conversations and reset selection
      await get().loadConversations();
      set({ currentConversationId: null, aiHistory: [] });

      // Check if project has content but no extracted data
      const { characters, scenes, screenplayContent } = get();
      if (screenplayContent && screenplayContent.length > 100 &&
        characters.length === 0 && scenes.length === 0) {
        set({ showAnalyzePrompt: true });
      }
    } catch (error) {
      console.error('Failed to open project:', error);
      throw error;
    }
  },

  closeProject: async () => {
    try {
      await window.api.project.close();
      set({
        currentProject: null,
        screenplayContent: '',
        characters: [],
        scenes: [],
        storyline: null,
        aiHistory: [],
        conversations: [],
        currentConversationId: null,
        projectSettings: null,
      });
    } catch (error) {
      console.error('Failed to close project:', error);
      throw error;
    }
  },

  saveScreenplay: async () => {
    try {
      console.log('[Store] saveScreenplay called');
      const { screenplayContent } = get();
      console.log('[Store] Saving screenplay content, length:', screenplayContent.length, 'chars');
      await window.api.project.save(screenplayContent);
      console.log('[Store] Screenplay file saved successfully');

      // Re-parse and update database
      const parsed = await window.api.parse.fountain(screenplayContent);

      // Get current scenes to check for existing ones
      const currentScenes = get().scenes;
      console.log('[Store] Merging scenes. Current:', currentScenes.length, 'Parsed:', parsed.scenes.length);

      // INTELLIGENT MERGE: Match parsed scenes with existing scenes by Number OR Heading
      const mergedScenes = parsed.scenes.map(parsedScene => {
        // Find if we already have a scene with this number OR heading
        // We prioritize number, but fallback to heading if numbers might be misaligned
        const existingScene = currentScenes.find(s =>
          s.number === parsedScene.number ||
          (s.heading && parsedScene.heading && s.heading.toUpperCase() === parsedScene.heading.toUpperCase())
        );

        if (existingScene) {
          console.log(`[Store] Matched scene ${parsedScene.number} (ID: ${existingScene.id})`);
          // Keep the existing ID and metadata, just update the content/heading
          return {
            ...existingScene,
            heading: parsedScene.heading,
            content: parsedScene.content,
            startLine: parsedScene.startLine,
            endLine: parsedScene.endLine,
            characters: parsedScene.characters // Update characters present in scene
          };
        }
        console.log(`[Store] New scene detected: ${parsedScene.number} - ${parsedScene.heading}`);
        return parsedScene; // It's actually new
      });

      set({ scenes: mergedScenes });

      // Save these merged scenes (updating existing rows instead of creating duplicates)
      for (const scene of mergedScenes) {
        await window.api.db.saveScene(scene);
      }

      // DELETE STALE SCENES: Remove any scenes from DB that are no longer in the script
      // We fetch ALL scenes from DB to ensure we catch "ghost" duplicates that might not be in local state
      const allDbScenes = await window.api.db.getScenes();
      const mergedIds = new Set(mergedScenes.map(s => s.id));
      const scenesToDelete = allDbScenes.filter(s => !mergedIds.has(s.id));

      if (scenesToDelete.length > 0) {
        console.log(`[Store] Deleting ${scenesToDelete.length} stale scenes from DB`);
        for (const scene of scenesToDelete) {
          await window.api.db.deleteScene(scene.id);
        }
      }

      // Auto-extract and save characters (INTELLIGENT MERGE)
      for (const scene of mergedScenes) {
        for (const charName of scene.characters) {
          // Check by ID OR Name (case-insensitive)
          const existing = get().characters.find(c =>
            c.id === charName ||
            c.name.toUpperCase() === charName.toUpperCase()
          );

          if (!existing) {
            const newChar: Character = {
              id: charName,
              name: charName,
              description: '',
              arc: '',
              relationships: {},
              appearances: [scene.id],
            };
            await window.api.db.saveCharacter(newChar);
          } else {
            // Update appearances for existing character if needed
            if (!existing.appearances.includes(scene.id)) {
              const updatedChar = {
                ...existing,
                appearances: [...existing.appearances, scene.id]
              };
              await window.api.db.saveCharacter(updatedChar);
            }
          }
        }
      }

      await get().loadCharacters();
      console.log('[Store] saveScreenplay completed successfully');
    } catch (error) {
      console.error('[Store] Failed to save screenplay:', error);
      throw error;
    }
  },

  loadScreenplay: async () => {
    try {
      const content = await window.api.project.load();
      set({ screenplayContent: content });
    } catch (error) {
      console.error('Failed to load screenplay:', error);
      throw error;
    }
  },

  loadCharacters: async () => {
    try {
      const characters = await window.api.db.getCharacters();
      set({ characters });
    } catch (error) {
      console.error('Failed to load characters:', error);
    }
  },

  saveCharacter: async (character) => {
    try {
      await window.api.db.saveCharacter(character);
      await get().loadCharacters();
    } catch (error) {
      console.error('Failed to save character:', error);
      throw error;
    }
  },

  deleteCharacter: async (id) => {
    try {
      await window.api.db.deleteCharacter(id);
      await get().loadCharacters();
    } catch (error) {
      console.error('Failed to delete character:', error);
      throw error;
    }
  },

  loadScenes: async () => {
    try {
      const scenes = await window.api.db.getScenes();
      set({ scenes });
    } catch (error) {
      console.error('Failed to load scenes:', error);
    }
  },

  loadStoryline: async () => {
    try {
      const storyline = await window.api.db.getStoryline();
      set({ storyline });
    } catch (error) {
      console.error('Failed to load storyline:', error);
    }
  },

  sendAIMessage: async (message) => {
    try {
      const { screenplayContent, characters, scenes, storyline, currentConversationId, chatMode } = get();

      // Ensure we have a conversation
      let conversationId = currentConversationId;
      if (!conversationId) {
        const newConversation = await get().createConversation('New Chat');
        conversationId = newConversation.id;
      }

      // Get current conversation to check for existing summary
      const conversation = await window.api.db.getConversation(conversationId);

      // Only send last 10 messages to AI to reduce token usage and improve performance
      // Older context is summarized in conversationSummary
      const recentHistory = get().aiHistory.slice(-10);
      
      const context: AIContext = {
        characters,
        scenes,
        storyline: storyline || undefined,
        currentContent: screenplayContent,
        history: recentHistory, // Only recent messages, not full history
        conversationSummary: conversation?.contextSummary,
        chatMode, // Pass current mode to AI
      };
      
      // Debug: Log what we're sending
      console.log('[AppStore] Sending AI context:', {
        charactersCount: characters.length,
        characterNames: characters.map(c => c.name),
        scenesCount: scenes.length,
        sceneHeadings: scenes.map(s => s.heading),
        historyCount: recentHistory.length,
        totalHistoryCount: get().aiHistory.length,
        contentLength: screenplayContent?.length || 0,
        chatMode,
      });

      const userMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
        conversationId,
      };

      await window.api.db.saveAIMessage(userMessage);

      // Add user message to UI immediately (don't wait for AI response)
      set({ aiHistory: [...get().aiHistory, userMessage] });

      const response = await window.api.ai.chat(message, context);

      // Don't store full context - it causes exponential storage growth
      // Store only minimal metadata to avoid RangeError: Invalid string length
      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        // contextUsed intentionally omitted - storing full screenplay/history causes DB bloat
        conversationId,
        tokenUsage: response.tokenUsage,
      };

      await window.api.db.saveAIMessage(assistantMessage);

      // Reload history for current conversation
      const history = await window.api.db.getAIHistoryForConversation(conversationId);
      set({ aiHistory: history });

      // Update conversation title if it's the first message
      let conversations = get().conversations;
      const currentConv = conversations.find(c => c.id === conversationId);
      if (currentConv && currentConv.title === 'New Chat') {
        // Auto-generate title from first message (truncate to 30 chars)
        const autoTitle = message.length > 30 ? message.substring(0, 30) + '...' : message;
        await get().updateConversationTitle(conversationId, autoTitle);
      }

      // Reload conversations to update timestamps and token counts
      await get().loadConversations();
      
      // Check if summarization is needed (threshold: 180k tokens)
      // Get updated conversation with new token count
      const updatedConv = await window.api.db.getConversation(conversationId);
      if (updatedConv && updatedConv.totalTokensUsed && updatedConv.totalTokensUsed > 180000) {
        // Check if there's no pending edit before summarizing
        const { pendingEdit } = get();
        if (!pendingEdit) {
          console.log('[Store] Token threshold exceeded, summarizing conversation...');
          try {
            await window.api.ai.summarizeConversation(conversationId);
            console.log('[Store] Conversation summarized successfully');
            await get().loadConversations();
          } catch (error) {
            console.error('[Store] Failed to summarize conversation:', error);
            // Non-fatal error - continue without summarizing
          }
        } else {
          console.log('[Store] Skipping summarization - pending edit awaiting approval');
        }
      }
    } catch (error) {
      console.error('Failed to send AI message:', error);
      throw error;
    }
  },

  analyzeStoryline: async () => {
    try {
      const analysis = await window.api.ai.analyzeStoryline();
      console.log('Storyline analysis:', analysis);
      // Update storyline in database
      if (analysis) {
        await window.api.db.saveStoryline(analysis);
        await get().loadStoryline();
      }
    } catch (error) {
      console.error('Failed to analyze storyline:', error);
      throw error;
    }
  },

  reloadData: async () => {
    console.log('Reloading data from database...');
    await get().loadCharacters();
    await get().loadScenes();
    await get().loadStoryline();
  },

  loadGlobalSettings: async () => {
    try {
      const settings = await window.api.settings.getGlobal();
      set({ globalSettings: settings });

      // Apply theme
      if (settings.defaultTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (error) {
      console.error('Failed to load global settings:', error);
    }
  },

  saveGlobalSettings: async (settings) => {
    try {
      await window.api.settings.setGlobal(settings);
      await get().loadGlobalSettings();
    } catch (error) {
      console.error('Failed to save global settings:', error);
      throw error;
    }
  },

  loadProjectSettings: async () => {
    try {
      const settings = await window.api.settings.getProject();
      set({ projectSettings: settings });
    } catch (error) {
      console.error('Failed to load project settings:', error);
    }
  },

  saveProjectSettings: async (settings) => {
    try {
      await window.api.settings.setProject(settings);
      await get().loadProjectSettings();
    } catch (error) {
      console.error('Failed to save project settings:', error);
      throw error;
    }
  },

  // Conversation actions
  loadConversations: async () => {
    try {
      set({ isLoadingConversations: true });
      const conversations = await window.api.db.getConversations();
      set({ conversations, isLoadingConversations: false });
    } catch (error) {
      console.error('Failed to load conversations:', error);
      set({ isLoadingConversations: false });
    }
  },

  createConversation: async (title = 'New Chat') => {
    try {
      const conversation = await window.api.db.createConversation(title);
      await get().loadConversations();
      set({ currentConversationId: conversation.id, aiHistory: [] });
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  },

  deleteConversation: async (id) => {
    try {
      await window.api.db.deleteConversation(id);
      await get().loadConversations();
      
      // If we deleted the current conversation, select another or clear
      const { currentConversationId, conversations } = get();
      if (currentConversationId === id) {
        if (conversations.length > 0) {
          await get().selectConversation(conversations[0].id);
        } else {
          set({ currentConversationId: null, aiHistory: [] });
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  },

  selectConversation: async (id) => {
    try {
      set({ currentConversationId: id });
      const history = await window.api.db.getAIHistoryForConversation(id);
      set({ aiHistory: history });
    } catch (error) {
      console.error('Failed to select conversation:', error);
      throw error;
    }
  },

  updateConversationTitle: async (id, title) => {
    try {
      await window.api.db.updateConversation(id, title);
      await get().loadConversations();
    } catch (error) {
      console.error('Failed to update conversation title:', error);
      throw error;
    }
  },
}));

