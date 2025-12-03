// Core Types
export interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
  createdAt: number;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  arc: string;

  // Comprehensive character fields
  age?: number | string;
  occupation?: string;
  physicalAppearance?: string;
  personality?: string;
  goals?: string;
  fears?: string;
  backstory?: string;
  relationships: Record<string, string>;
  customAttributes?: Record<string, string>; // User-defined fields
  appearances: string[]; // Scene IDs
  notes?: string;
  imageUrl?: string; // Optional character portrait
}

export interface Scene {
  id: string;
  number: number;
  heading: string;
  location: string;
  timeOfDay: string;
  summary: string;
  characters: string[]; // Character IDs
  startLine: number;
  endLine: number;
  content: string;
  order?: number; // Manual scene ordering
  duration?: string; // Estimated scene duration
  tags?: string[]; // Scene tags/categories
}

export interface Storyline {
  id: string;
  act: number;
  plotPoints: PlotPoint[];
  themes: string[];
  narrativeStructure: string;
}

export interface PlotPoint {
  id: string;
  name: string;
  description: string;
  sceneId?: string;
  timestamp: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  content: string;
  tokenUsage: TokenUsage;
}

export interface SummarizationResult {
  summary: string;
  originalMessageCount: number;
  preservedMessageCount: number;
}

// Version control types
export interface Version {
  id: string;
  message: string;
  content: string;
  createdAt: number;
  scenesSnapshot: Scene[];
  charactersSnapshot: Character[];
}

export interface VersionSummary {
  id: string;
  message: string;
  createdAt: number;
  contentLength: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  contextUsed?: AIContext;
  conversationId?: string;
  tokenUsage?: TokenUsage;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  contextSummary?: string;
  totalTokensUsed?: number;
}

export interface AIContext {
  characters: Character[];
  scenes: Scene[];
  storyline?: Storyline;
  currentContent: string;
  history?: AIMessage[];
  conversationSummary?: string;
  chatMode?: 'ask' | 'agent';
}

export interface PendingEdit {
  original: string;
  modified: string;
  description: string;
}

export interface SystemActions {
  saveScreenplay: () => Promise<void>;
  exportScreenplay: (format: 'pdf' | 'fdx') => Promise<void>;
  notifyUpdate: () => void;
  previewUpdate: (edit: PendingEdit) => void;
}

export interface ProjectSettings {
  aiModel: string;
  theme: 'light' | 'dark';
  autoSave: boolean;
  characterNamingConvention: 'uppercase' | 'titlecase';
}

export interface GlobalSettings {
  openaiApiKey: string;
  defaultTheme: 'light' | 'dark';
  recentProjects: string[];
  defaultExportFormat: 'pdf' | 'fdx' | 'fountain';
}

// IPC Channel Types
export interface IpcChannels {
  // Project Management
  'project:create': (name: string, path: string) => Promise<Project>;
  'project:open': (path: string) => Promise<Project>;
  'project:close': () => Promise<void>;
  'project:save': (content: string) => Promise<void>;
  'project:load': () => Promise<string>;

  // Database Operations
  'db:getCharacters': () => Promise<Character[]>;
  'db:getCharacter': (id: string) => Promise<Character | null>;
  'db:saveCharacter': (character: Character) => Promise<void>;
  'db:deleteCharacter': (id: string) => Promise<void>;

  'db:getScenes': () => Promise<Scene[]>;
  'db:getScene': (id: string) => Promise<Scene | null>;
  'db:saveScene': (scene: Scene) => Promise<void>;

  'db:getStoryline': () => Promise<Storyline | null>;
  'db:saveStoryline': (storyline: Storyline) => Promise<void>;

  'db:getAIHistory': () => Promise<AIMessage[]>;
  'db:getAIHistoryForConversation': (conversationId: string) => Promise<AIMessage[]>;
  'db:saveAIMessage': (message: AIMessage) => Promise<void>;

  // Conversation Operations
  'db:getConversations': () => Promise<Conversation[]>;
  'db:createConversation': (title: string) => Promise<Conversation>;
  'db:updateConversation': (id: string, title: string) => Promise<void>;
  'db:deleteConversation': (id: string) => Promise<void>;

  // AI Operations
  'ai:chat': (message: string, context: AIContext) => Promise<ChatResponse>;
  'ai:generateDialogue': (character: string, context: string) => Promise<string>;
  'ai:expandScene': (outline: string) => Promise<string>;
  'ai:analyzeStoryline': () => Promise<any>;

  // Settings
  'settings:getGlobal': () => Promise<GlobalSettings>;
  'settings:setGlobal': (settings: Partial<GlobalSettings>) => Promise<void>;
  'settings:getProject': () => Promise<ProjectSettings>;
  'settings:setProject': (settings: Partial<ProjectSettings>) => Promise<void>;

  // File Operations
  'file:selectFolder': () => Promise<string | null>;
  'file:exportPDF': (content: string, path: string) => Promise<void>;

  // Parsing
  'parse:fountain': (content: string) => Promise<ParsedScreenplay>;

  // Editor Operations
  'editor:previewUpdate': (edit: PendingEdit) => void;
}

export interface ParsedScreenplay {
  scenes: Scene[];
  characters: Set<string>;
  title?: string;
  author?: string;
}

// Backup info type
export interface BackupInfo {
  filename: string;
  path: string;
  timestamp: number;
  size: number;
}

// Export options type
export interface ExportOptions {
  title?: string;
  author?: string;
  includeSceneNumbers?: boolean;
  includeCharacterList?: boolean;
}

// Window API exposed to renderer
export interface WindowAPI {
  project: {
    create: (name: string, path: string) => Promise<Project>;
    open: (path: string) => Promise<Project>;
    close: () => Promise<void>;
    save: (content: string) => Promise<void>;
    load: () => Promise<string>;
    saveAs: () => Promise<string | null>;
  };

  db: {
    getCharacters: () => Promise<Character[]>;
    getCharacter: (id: string) => Promise<Character | null>;
    saveCharacter: (character: Character) => Promise<void>;
    deleteCharacter: (id: string) => Promise<void>;
    getScenes: () => Promise<Scene[]>;
    getScene: (id: string) => Promise<Scene | null>;
    saveScene: (scene: Scene) => Promise<void>;
    deleteScene: (id: string) => Promise<void>;
    getStoryline: () => Promise<Storyline | null>;
    saveStoryline: (storyline: Storyline) => Promise<void>;
    getAIHistory: () => Promise<AIMessage[]>;
    getAIHistoryForConversation: (conversationId: string) => Promise<AIMessage[]>;
    saveAIMessage: (message: AIMessage) => Promise<void>;
    clearDatabase: () => Promise<void>;
    
    // Conversation methods
    getConversations: () => Promise<Conversation[]>;
    getConversation: (id: string) => Promise<Conversation | null>;
    createConversation: (title: string) => Promise<Conversation>;
    updateConversation: (id: string, title: string) => Promise<void>;
    deleteConversation: (id: string) => Promise<void>;
    saveConversationSummary: (id: string, summary: string) => Promise<void>;
    getSchemaVersion: () => Promise<number>;
    isOldDatabase: () => Promise<boolean>;
  };

  ai: {
    chat: (message: string, context: AIContext) => Promise<ChatResponse>;
    generateDialogue: (character: string, context: string) => Promise<string>;
    expandScene: (outline: string) => Promise<string>;
    analyzeStoryline: () => Promise<any>;
    summarizeConversation: (conversationId: string) => Promise<SummarizationResult>;
  };

  settings: {
    getGlobal: () => Promise<GlobalSettings>;
    setGlobal: (settings: Partial<GlobalSettings>) => Promise<void>;
    getProject: () => Promise<ProjectSettings>;
    setProject: (settings: Partial<ProjectSettings>) => Promise<void>;
  };

  file: {
    selectFolder: () => Promise<string | null>;
    exportPDF: (content: string, path: string) => Promise<void>;
  };

  parse: {
    fountain: (content: string) => Promise<ParsedScreenplay>;
  };

  // Version control
  version: {
    create: (message: string) => Promise<Version>;
    list: () => Promise<VersionSummary[]>;
    get: (id: string) => Promise<Version | null>;
    restore: (id: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
    count: () => Promise<number>;
  };

  // Backup system
  backup: {
    create: (reason?: string) => Promise<BackupInfo>;
    list: () => Promise<BackupInfo[]>;
    restore: (backupPath: string) => Promise<void>;
    delete: (backupPath: string) => Promise<void>;
    getDir: () => Promise<string | null>;
  };

  // Export system
  export: {
    fountain: (outputPath: string, options?: ExportOptions) => Promise<string>;
    pdf: (outputPath: string, options?: ExportOptions) => Promise<string>;
    fdx: (outputPath: string, options?: ExportOptions) => Promise<string>;
    txt: (outputPath: string, options?: ExportOptions) => Promise<string>;
    showSaveDialog: (format: string, defaultName?: string) => Promise<string | null>;
  };

  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;

  editor: {
    previewUpdate: (edit: PendingEdit) => void;
  };
}

// Screenplay Formatting Types
export type ElementType =
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'centered';

export interface FormattingState {
  currentElement: ElementType;
  isLocked: boolean;
}

declare global {
  interface Window {
    api: WindowAPI;
  }
}

