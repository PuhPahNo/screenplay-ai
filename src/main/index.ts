import { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import { ProjectManager } from './project-manager';
import { DatabaseManager } from '../database/db-manager';
import { AIClient } from '../ai/openai-client';
import { FountainParser } from '../screenplay/fountain-parser';
import { setupAutoUpdater, checkForUpdatesManually } from './auto-updater';
import { BackupManager } from './backup-manager';
import { ExportManager } from './export-manager';
import Store from 'electron-store';
import type { SystemActions } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let projectManager: ProjectManager | null = null;
let dbManager: DatabaseManager | null = null;
let aiClient: AIClient | null = null;
let backupManager: BackupManager | null = null;
const exportManager = new ExportManager();
const store = new Store();

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'default' : 'default',
    backgroundColor: '#1a1a1a',
    title: 'Screenplay AI',
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Dev tools available via View menu or Cmd+Option+I
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template: any[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        {
          label: 'About Screenplay AI',
          click: () => {
            const appVersion = app.getVersion();
            const electronVersion = process.versions.electron;
            const platform = `${process.platform} (${process.arch})`;
            
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Screenplay AI',
              message: 'Screenplay AI',
              detail: `Version ${appVersion}\nElectron ${electronVersion}\nPlatform: ${platform}\n\nProfessional screenplay writing powered by AI.\n\nBuilt with Electron, React, and OpenAI.`,
            });
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu:new-project');
          },
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu:open-project');
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('menu:save');
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('menu:save-as');
          },
        },
        { type: 'separator' },
        {
          label: 'Version History...',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            mainWindow?.webContents.send('menu:version-history');
          },
        },
        {
          label: 'Create Version',
          click: () => {
            mainWindow?.webContents.send('menu:create-version');
          },
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as Fountain (.fountain)',
              click: () => {
                mainWindow?.webContents.send('menu:export', 'fountain');
              },
            },
            {
              label: 'Export as PDF',
              click: () => {
                mainWindow?.webContents.send('menu:export', 'pdf');
              },
            },
            {
              label: 'Export as Final Draft (.fdx)',
              click: () => {
                mainWindow?.webContents.send('menu:export', 'fdx');
              },
            },
            {
              label: 'Export as Plain Text (.txt)',
              click: () => {
                mainWindow?.webContents.send('menu:export', 'txt');
              },
            },
          ],
        },
        ...(!isMac ? [
          { type: 'separator' },
          { role: 'quit' },
        ] : []),
      ],
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
        ]),
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // AI menu
    {
      label: 'AI',
      submenu: [
        {
          label: 'Toggle AI Chat',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            mainWindow?.webContents.send('menu:toggle-ai-chat');
          },
        },
        {
          label: 'Analyze Storyline',
          click: () => {
            mainWindow?.webContents.send('menu:analyze-storyline');
          },
        },
      ],
    },
    // Settings menu
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.send('menu:open-settings');
          },
        },
      ],
    },
    // Window menu (macOS specific)
    ...(isMac ? [{
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' },
      ],
    }] : []),
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            checkForUpdatesManually();
          },
        },
        ...(!isMac ? [
          { type: 'separator' },
          {
            label: 'About Screenplay AI',
            click: () => {
              const appVersion = app.getVersion();
              const electronVersion = process.versions.electron;
              const platform = `${process.platform} (${process.arch})`;
              
              dialog.showMessageBox(mainWindow!, {
                type: 'info',
                title: 'About Screenplay AI',
                message: 'Screenplay AI',
                detail: `Version ${appVersion}\nElectron ${electronVersion}\nPlatform: ${platform}\n\nProfessional screenplay writing powered by AI.\n\nBuilt with Electron, React, and OpenAI.`,
              });
            },
          },
        ] : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  // Setup auto-updater
  if (!isDev) {
    setupAutoUpdater(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Project Management
ipcMain.handle('project:create', async (_, name: string, folderPath: string) => {
  const projectPath = path.join(folderPath, name);

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  const screenplayPath = path.join(projectPath, 'screenplay.fountain');
  const metaPath = path.join(projectPath, '.screenplay-ai');

  // Create initial screenplay file with starter template
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const initialContent = `Title: ${name}
Author: 
Draft: First Draft
Date: ${today}

===

/* 
  Welcome to your new screenplay!
  
  Fountain Format Quick Reference:
  -----------------------------------
  Scene Heading:  INT. COFFEE SHOP - DAY
  Action:         Jane walks into the bustling coffee shop.
  Character:      JANE
  Dialogue:       I'll have a double espresso, please.
  Parenthetical:  (smiling)
  
  Tips:
  - Scene headings start with INT. or EXT.
  - Character names are in ALL CAPS
  - Dialogue goes directly below character names
  - Use Cmd+S (or Ctrl+S) to save
  
  AI Features:
  - Click the AI button (bottom right) for writing assistance
  - Use the AI Chat to discuss characters and plot
  - Check "Scenes" tab to see your story structure
  
  Start writing your masterpiece below...
*/

`;
  fs.writeFileSync(screenplayPath, initialContent, 'utf-8');

  // Create metadata folder
  if (!fs.existsSync(metaPath)) {
    fs.mkdirSync(metaPath, { recursive: true });
  }

  // Initialize project manager
  projectManager = new ProjectManager(projectPath);

  // Initialize database
  const dbPath = path.join(metaPath, 'project.db');
  dbManager = new DatabaseManager(dbPath);

  // Decrypt and use stored API key
  const encryptedKey = store.get('openaiApiKey_encrypted', '') as string;
  let apiKey = '';

  if (encryptedKey && safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedKey, 'base64');
      apiKey = safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('[Main] Failed to decrypt API key:', error);
    }
  }

  if (apiKey && apiKey.length > 20) {
    const systemActions: SystemActions = {
      saveScreenplay: async () => {
        if (projectManager) {
          const content = await projectManager.loadScreenplay();
          await projectManager.saveScreenplay(content);
        }
      },
      exportScreenplay: async (format) => {
        if (projectManager) {
          const content = await projectManager.loadScreenplay();
          const basePath = projectManager['projectPath'] || app.getPath('documents');
          const exportPath = path.join(basePath, `screenplay.${format}`);
          if (format === 'pdf') {
            const { PDFExporter } = require('../export/pdf-exporter');
            await PDFExporter.export(content, exportPath);
          } else if (format === 'fdx') {
            const { FDXExporter } = require('../export/fdx-exporter');
            await FDXExporter.export(content, exportPath);
          }
        }
      },
      notifyUpdate: () => {
        mainWindow?.webContents.send('data:update');
      }
    };
    aiClient = new AIClient(apiKey, dbManager, systemActions);
    console.log('[Main] AI client initialized');
  } else {
    console.log('[Main] No valid API key. AI features disabled.');
  }

  const project = {
    id: Date.now().toString(),
    name,
    path: projectPath,
    lastOpened: Date.now(),
    createdAt: Date.now(),
  };

  // Save to recent projects
  const recent = (store.get('recentProjects', []) as string[]);
  recent.unshift(projectPath);
  store.set('recentProjects', recent.slice(0, 10));

  return project;
});

ipcMain.handle('project:open', async (_, projectPath: string) => {
  console.log('[Main] Opening project:', projectPath);
  
  if (!fs.existsSync(projectPath)) {
    throw new Error('Project not found');
  }

  projectManager = new ProjectManager(projectPath);

  const dbPath = path.join(projectPath, '.screenplay-ai', 'project.db');
  console.log('[Main] Initializing database:', dbPath);
  
  try {
    dbManager = new DatabaseManager(dbPath);
    console.log('[Main] Database initialized successfully');
  } catch (dbError) {
    console.error('[Main] Database initialization failed:', dbError);
    throw dbError;
  }

  // Decrypt and use stored API key
  const encryptedKey = store.get('openaiApiKey_encrypted', '') as string;
  let apiKey = '';

  if (encryptedKey && safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedKey, 'base64');
      apiKey = safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('[Main] Failed to decrypt API key:', error);
    }
  }

  if (apiKey && apiKey.length > 20) {
    const systemActions: SystemActions = {
      saveScreenplay: async () => {
        if (projectManager) {
          const content = await projectManager.loadScreenplay();
          await projectManager.saveScreenplay(content);
        }
      },
      exportScreenplay: async (format) => {
        if (projectManager) {
          const content = await projectManager.loadScreenplay();
          const basePath = projectManager['projectPath'] || app.getPath('documents');
          const exportPath = path.join(basePath, `screenplay.${format}`);
          if (format === 'pdf') {
            const { PDFExporter } = require('../export/pdf-exporter');
            await PDFExporter.export(content, exportPath);
          } else if (format === 'fdx') {
            const { FDXExporter } = require('../export/fdx-exporter');
            await FDXExporter.export(content, exportPath);
          }
        }
      },
      notifyUpdate: () => {
        mainWindow?.webContents.send('data:update');
      }
    };
    aiClient = new AIClient(apiKey, dbManager, systemActions);
    console.log('[Main] AI client initialized');
  } else {
    console.log('[Main] No valid API key. AI features disabled.');
  }

  const name = path.basename(projectPath);
  const project = {
    id: Date.now().toString(),
    name,
    path: projectPath,
    lastOpened: Date.now(),
    createdAt: Date.now(),
  };

  // Initialize backup manager and start auto-backup
  // Note: dbPath is already defined above
  backupManager = new BackupManager(dbPath);
  backupManager.startAutoBackup();

  // Update recent projects
  const recent = (store.get('recentProjects', []) as string[]);
  const filtered = recent.filter(p => p !== projectPath);
  filtered.unshift(projectPath);
  store.set('recentProjects', filtered.slice(0, 10));

  return project;
});

ipcMain.handle('project:close', async () => {
  // Stop auto-backup when closing project
  if (backupManager) {
    backupManager.stopAutoBackup();
    backupManager = null;
  }
  projectManager = null;
  dbManager = null;
  aiClient = null;
});

ipcMain.handle('project:save', async (_, content: string) => {
  if (!projectManager) throw new Error('No project open');
  await projectManager.saveScreenplay(content);

  // Parse and update database
  if (dbManager) {
    const parsed = FountainParser.parse(content);
    for (const scene of parsed.scenes) {
      await dbManager.saveScene(scene);
    }
  }
});

ipcMain.handle('project:load', async () => {
  if (!projectManager) throw new Error('No project open');
  return await projectManager.loadScreenplay();
});

// Database Operations
ipcMain.handle('db:getCharacters', async () => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getCharacters();
});

ipcMain.handle('db:getCharacter', async (_, id: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getCharacter(id);
});

ipcMain.handle('db:saveCharacter', async (_, character: any) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.saveCharacter(character);
});

ipcMain.handle('db:deleteCharacter', async (_, id: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.deleteCharacter(id);
});

ipcMain.handle('db:getScenes', async () => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getScenes();
});

ipcMain.handle('db:getScene', async (_, id: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getScene(id);
});

ipcMain.handle('db:saveScene', async (_, scene: any) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.saveScene(scene);
});

ipcMain.handle('db:deleteScene', async (_, id: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.deleteScene(id);
});

ipcMain.handle('db:getStoryline', async () => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getStoryline();
});

ipcMain.handle('db:saveStoryline', async (_, storyline: any) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.saveStoryline(storyline);
});

ipcMain.handle('db:getAIHistory', async () => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getAIHistory();
});

ipcMain.handle('db:saveAIMessage', async (_, message: any) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.saveAIMessage(message);
});

ipcMain.handle('db:clearDatabase', async () => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.clearDatabase();
});

// Conversation Operations
ipcMain.handle('db:getConversations', async () => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getConversations();
});

ipcMain.handle('db:createConversation', async (_, title: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.createConversation(title);
});

ipcMain.handle('db:updateConversation', async (_, id: string, title: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.updateConversation(id, title);
});

ipcMain.handle('db:deleteConversation', async (_, id: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.deleteConversation(id);
});

ipcMain.handle('db:getAIHistoryForConversation', async (_, conversationId: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getAIHistoryForConversation(conversationId);
});

// AI Operations
ipcMain.handle('ai:chat', async (_, message: string, context: any) => {
  if (!aiClient) throw new Error('AI client not initialized');
  return await aiClient.chat(message, context);
});

ipcMain.handle('ai:generateDialogue', async (_, character: string, context: string) => {
  if (!aiClient) throw new Error('AI client not initialized');
  return await aiClient.generateDialogue(character, context);
});

ipcMain.handle('ai:expandScene', async (_, outline: string) => {
  if (!aiClient) throw new Error('AI client not initialized');
  return await aiClient.expandScene(outline);
});

ipcMain.handle('ai:analyzeStoryline', async () => {
  if (!aiClient) throw new Error('AI client not initialized');
  return await aiClient.analyzeStoryline();
});

// Get single conversation
ipcMain.handle('db:getConversation', async (_, id: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getConversation(id);
});

// Get database schema version
ipcMain.handle('db:getSchemaVersion', async () => {
  if (!dbManager) return 0;
  return dbManager.getSchemaVersion();
});

// Check if database was upgraded from old version
ipcMain.handle('db:isOldDatabase', async () => {
  if (!dbManager) return false;
  return dbManager.isOldDatabase();
});

// Save conversation summary
ipcMain.handle('db:saveConversationSummary', async (_, id: string, summary: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.saveConversationSummary(id, summary);
});

// Summarize conversation
ipcMain.handle('ai:summarizeConversation', async (_, conversationId: string) => {
  if (!dbManager) throw new Error('No database open');
  if (!globalSettings?.openaiApiKey) throw new Error('OpenAI API key not configured');
  
  const { ContextSummarizer } = await import('../ai/context-summarizer');
  const summarizer = new ContextSummarizer(globalSettings.openaiApiKey);
  
  const messages = await dbManager.getAIHistoryForConversation(conversationId);
  const result = await summarizer.summarize(messages);
  
  // Save the summary to the conversation
  await dbManager.saveConversationSummary(conversationId, result.summary);
  
  return result;
});

// Settings
ipcMain.handle('settings:getGlobal', async () => {
  const encryptedKey = store.get('openaiApiKey_encrypted', '') as string;
  let decryptedKey = '';

  if (encryptedKey && safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedKey, 'base64');
      decryptedKey = safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('[Main] Failed to decrypt API key:', error);
    }
  }

  return {
    openaiApiKey: decryptedKey,
    defaultTheme: store.get('defaultTheme', 'dark') as 'light' | 'dark',
    recentProjects: store.get('recentProjects', []) as string[],
    defaultExportFormat: store.get('defaultExportFormat', 'pdf') as 'pdf' | 'fdx' | 'fountain',
  };
});

ipcMain.handle('settings:setGlobal', async (_, settings: any) => {
  // Encrypt API key before storing
  if (settings.openaiApiKey !== undefined) {
    if (settings.openaiApiKey && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(settings.openaiApiKey);
      const base64 = encrypted.toString('base64');
      store.set('openaiApiKey_encrypted', base64);
      console.log('[Main] API key encrypted and stored');
    } else {
      store.delete('openaiApiKey_encrypted');
      console.log('[Main] API key cleared');
    }
    delete settings.openaiApiKey; // Don't store plain text
  }

  // Store other settings
  for (const [key, value] of Object.entries(settings)) {
    store.set(key, value);
  }

  // Reinitialize AI client with decrypted key
  const encryptedKey = store.get('openaiApiKey_encrypted', '') as string;
  if (encryptedKey && dbManager && safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedKey, 'base64');
      const decryptedKey = safeStorage.decryptString(buffer);
      if (decryptedKey.length > 20) {
        // Re-create system actions for re-init
        const systemActions: SystemActions = {
          saveScreenplay: async () => {
            if (projectManager) {
              const content = await projectManager.loadScreenplay();
              await projectManager.saveScreenplay(content);
            }
          },
          exportScreenplay: async (format) => {
            if (projectManager) {
              const content = await projectManager.loadScreenplay();
              // Use project path if available, otherwise default to docs
              const basePath = projectManager['projectPath'] || app.getPath('documents');
              const exportPath = path.join(basePath, `screenplay.${format}`);
              if (format === 'pdf') {
                const { PDFExporter } = require('../export/pdf-exporter');
                await PDFExporter.export(content, exportPath);
              } else if (format === 'fdx') {
                const { FDXExporter } = require('../export/fdx-exporter');
                await FDXExporter.export(content, exportPath);
              }
            }
          },
          notifyUpdate: () => {
            mainWindow?.webContents.send('data:update');
          }
        };
        aiClient = new AIClient(decryptedKey, dbManager, systemActions);
        console.log('[Main] AI client reinitialized with decrypted key');
      }
    } catch (error) {
      console.error('[Main] Failed to decrypt API key:', error);
    }
  }
});

ipcMain.handle('settings:getProject', async () => {
  if (!projectManager) throw new Error('No project open');
  return await projectManager.getSettings();
});

ipcMain.handle('settings:setProject', async (_, settings: any) => {
  if (!projectManager) throw new Error('No project open');
  return await projectManager.saveSettings(settings);
});

// File Operations
ipcMain.handle('file:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('file:exportPDF', async (_, content: string, exportPath: string) => {
  const { PDFExporter } = require('../export/pdf-exporter');
  await PDFExporter.export(content, exportPath);
});

ipcMain.handle('file:exportFDX', async (_, content: string, exportPath: string) => {
  const { FDXExporter } = require('../export/fdx-exporter');
  await FDXExporter.export(content, exportPath);
});

ipcMain.handle('file:saveDialog', async (_, defaultPath: string, filters: any[]) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath,
    filters,
  });

  return result.canceled ? null : result.filePath;
});

// Parsing
ipcMain.handle('parse:fountain', async (_, content: string) => {
  return FountainParser.parse(content);
});

// ============================================
// VERSION CONTROL
// ============================================

ipcMain.handle('version:create', async (_, message: string) => {
  if (!dbManager) throw new Error('No database open');
  
  // Also create a backup when creating a version
  if (backupManager) {
    await backupManager.createBackup('version');
  }
  
  return await dbManager.createVersion(message);
});

ipcMain.handle('version:list', async () => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getVersions();
});

ipcMain.handle('version:get', async (_, id: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getVersion(id);
});

ipcMain.handle('version:restore', async (_, id: string) => {
  if (!dbManager) throw new Error('No database open');
  
  // Create backup before restore
  if (backupManager) {
    await backupManager.createBackup('pre-restore');
  }
  
  return await dbManager.restoreVersion(id);
});

ipcMain.handle('version:delete', async (_, id: string) => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.deleteVersion(id);
});

ipcMain.handle('version:count', async () => {
  if (!dbManager) throw new Error('No database open');
  return await dbManager.getVersionCount();
});

// ============================================
// BACKUP SYSTEM
// ============================================

ipcMain.handle('backup:create', async (_, reason?: string) => {
  if (!backupManager) throw new Error('No project open');
  return await backupManager.createBackup(reason || 'manual');
});

ipcMain.handle('backup:list', async () => {
  if (!backupManager) throw new Error('No project open');
  return await backupManager.listBackups();
});

ipcMain.handle('backup:restore', async (_, backupPath: string) => {
  if (!backupManager) throw new Error('No project open');
  return await backupManager.restoreBackup(backupPath);
});

ipcMain.handle('backup:delete', async (_, backupPath: string) => {
  if (!backupManager) throw new Error('No project open');
  return await backupManager.deleteBackup(backupPath);
});

ipcMain.handle('backup:getDir', async () => {
  if (!backupManager) return null;
  return backupManager.getBackupDir();
});

// ============================================
// EXPORT SYSTEM
// ============================================

ipcMain.handle('export:fountain', async (_, outputPath: string, options?: any) => {
  if (!dbManager) throw new Error('No database open');
  
  const scenes = await dbManager.getScenes();
  const characters = await dbManager.getCharacters();
  
  await exportManager.exportToFountain(scenes, characters, outputPath, options);
  return outputPath;
});

ipcMain.handle('export:pdf', async (_, outputPath: string, options?: any) => {
  if (!dbManager) throw new Error('No database open');
  
  const scenes = await dbManager.getScenes();
  const characters = await dbManager.getCharacters();
  
  await exportManager.exportToPDF(scenes, characters, outputPath, options);
  return outputPath;
});

ipcMain.handle('export:fdx', async (_, outputPath: string, options?: any) => {
  if (!dbManager) throw new Error('No database open');
  
  const scenes = await dbManager.getScenes();
  const characters = await dbManager.getCharacters();
  
  await exportManager.exportToFinalDraft(scenes, characters, outputPath, options);
  return outputPath;
});

ipcMain.handle('export:txt', async (_, outputPath: string, options?: any) => {
  if (!dbManager) throw new Error('No database open');
  
  const scenes = await dbManager.getScenes();
  const characters = await dbManager.getCharacters();
  
  await exportManager.exportToText(scenes, characters, outputPath, options);
  return outputPath;
});

ipcMain.handle('export:showSaveDialog', async (_, format: string, defaultName?: string) => {
  const filters: { name: string; extensions: string[] }[] = [];
  
  switch (format) {
    case 'fountain':
      filters.push({ name: 'Fountain', extensions: ['fountain'] });
      break;
    case 'pdf':
      filters.push({ name: 'PDF', extensions: ['pdf'] });
      break;
    case 'fdx':
      filters.push({ name: 'Final Draft', extensions: ['fdx'] });
      break;
    case 'txt':
      filters.push({ name: 'Text', extensions: ['txt'] });
      break;
  }
  
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: defaultName || `screenplay.${format}`,
    filters,
  });
  
  return result.canceled ? null : result.filePath;
});

// ============================================
// SAVE AS
// ============================================

ipcMain.handle('project:saveAs', async () => {
  if (!projectManager) throw new Error('No project open');
  
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: 'screenplay.screenplay',
    filters: [{ name: 'Screenplay', extensions: ['screenplay'] }],
  });
  
  if (result.canceled || !result.filePath) return null;
  
  // Copy current project to new location
  const currentPath = projectManager['projectPath'];
  fs.copyFileSync(currentPath, result.filePath);
  
  return result.filePath;
});

