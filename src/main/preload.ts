import { contextBridge, ipcRenderer } from 'electron';
import type { WindowAPI } from '../shared/types';

const api: WindowAPI = {
  project: {
    create: (name: string, path: string) => ipcRenderer.invoke('project:create', name, path),
    open: (path: string) => ipcRenderer.invoke('project:open', path),
    close: () => ipcRenderer.invoke('project:close'),
    save: (content: string) => ipcRenderer.invoke('project:save', content),
    load: () => ipcRenderer.invoke('project:load'),
  },
  
  db: {
    getCharacters: () => ipcRenderer.invoke('db:getCharacters'),
    getCharacter: (id: string) => ipcRenderer.invoke('db:getCharacter', id),
    saveCharacter: (character) => ipcRenderer.invoke('db:saveCharacter', character),
    deleteCharacter: (id: string) => ipcRenderer.invoke('db:deleteCharacter', id),
    getScenes: () => ipcRenderer.invoke('db:getScenes'),
    getScene: (id: string) => ipcRenderer.invoke('db:getScene', id),
    saveScene: (scene) => ipcRenderer.invoke('db:saveScene', scene),
    deleteScene: (id: string) => ipcRenderer.invoke('db:deleteScene', id),
    getStoryline: () => ipcRenderer.invoke('db:getStoryline'),
    saveStoryline: (storyline) => ipcRenderer.invoke('db:saveStoryline', storyline),
    getAIHistory: () => ipcRenderer.invoke('db:getAIHistory'),
    getAIHistoryForConversation: (conversationId: string) => 
      ipcRenderer.invoke('db:getAIHistoryForConversation', conversationId),
    saveAIMessage: (message) => ipcRenderer.invoke('db:saveAIMessage', message),
    clearDatabase: () => ipcRenderer.invoke('db:clearDatabase'),
    
    // Conversation methods
    getConversations: () => ipcRenderer.invoke('db:getConversations'),
    createConversation: (title: string) => ipcRenderer.invoke('db:createConversation', title),
    updateConversation: (id: string, title: string) => 
      ipcRenderer.invoke('db:updateConversation', id, title),
    deleteConversation: (id: string) => ipcRenderer.invoke('db:deleteConversation', id),
  },
  
  ai: {
    chat: (message: string, context) => ipcRenderer.invoke('ai:chat', message, context),
    generateDialogue: (character: string, context: string) => 
      ipcRenderer.invoke('ai:generateDialogue', character, context),
    expandScene: (outline: string) => ipcRenderer.invoke('ai:expandScene', outline),
    analyzeStoryline: () => ipcRenderer.invoke('ai:analyzeStoryline'),
  },
  
  settings: {
    getGlobal: () => ipcRenderer.invoke('settings:getGlobal'),
    setGlobal: (settings) => ipcRenderer.invoke('settings:setGlobal', settings),
    getProject: () => ipcRenderer.invoke('settings:getProject'),
    setProject: (settings) => ipcRenderer.invoke('settings:setProject', settings),
  },
  
  file: {
    selectFolder: () => ipcRenderer.invoke('file:selectFolder'),
    exportPDF: (content: string, path: string) => ipcRenderer.invoke('file:exportPDF', content, path),
  },
  
  parse: {
    fountain: (content: string) => ipcRenderer.invoke('parse:fountain', content),
  },
  
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  },
  
  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
};

contextBridge.exposeInMainWorld('api', api);

