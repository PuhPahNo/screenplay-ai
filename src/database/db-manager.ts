import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { Character, Scene, Storyline, AIMessage, Conversation } from '../shared/types';

const SCHEMA = `
-- Characters table
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  arc TEXT,
  age TEXT,
  occupation TEXT,
  physical_appearance TEXT,
  personality TEXT,
  goals TEXT,
  fears TEXT,
  backstory TEXT,
  relationships TEXT,
  custom_attributes TEXT,
  appearances TEXT,
  notes TEXT,
  image_url TEXT
);

-- Scenes table
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  number INTEGER,
  heading TEXT,
  location TEXT,
  time_of_day TEXT,
  summary TEXT,
  characters TEXT,
  start_line INTEGER,
  end_line INTEGER,
  content TEXT,
  scene_order INTEGER,
  duration TEXT,
  tags TEXT
);

-- Storyline table
CREATE TABLE IF NOT EXISTS storyline (
  id TEXT PRIMARY KEY,
  act INTEGER,
  plot_points TEXT,
  themes TEXT,
  narrative_structure TEXT
);

-- AI Memory table
CREATE TABLE IF NOT EXISTS ai_memory (
  id TEXT PRIMARY KEY,
  timestamp INTEGER,
  context_type TEXT,
  content TEXT,
  embedding BLOB
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- AI History table (with conversation_id)
CREATE TABLE IF NOT EXISTS ai_history (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  context_used TEXT,
  conversation_id TEXT REFERENCES conversations(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scenes_number ON scenes(number);
CREATE INDEX IF NOT EXISTS idx_scenes_order ON scenes(scene_order);
CREATE INDEX IF NOT EXISTS idx_ai_history_timestamp ON ai_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_ai_history_conversation ON ai_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_context_type ON ai_memory(context_type);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
`;

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    // Create tables if they don't exist
    this.db.exec(SCHEMA);
    
    // Run migrations for existing databases
    this.runMigrations();
  }

  private runMigrations() {
    // Migration 1: Add conversation_id to ai_history if it doesn't exist
    const columns = this.db.prepare("PRAGMA table_info(ai_history)").all() as any[];
    const hasConversationId = columns.some(col => col.name === 'conversation_id');
    
    if (!hasConversationId) {
      console.log('[DB] Running migration: Adding conversation_id to ai_history');
      this.db.exec('ALTER TABLE ai_history ADD COLUMN conversation_id TEXT');
      
      // Migrate existing messages to a default conversation
      const existingMessages = this.db.prepare('SELECT id FROM ai_history WHERE conversation_id IS NULL').all();
      if (existingMessages.length > 0) {
        const defaultConversationId = 'conv-default-' + Date.now();
        const now = Date.now();
        
        // Create default conversation
        this.db.prepare(`
          INSERT INTO conversations (id, title, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `).run(defaultConversationId, 'Previous Conversation', now, now);
        
        // Update all existing messages
        this.db.prepare('UPDATE ai_history SET conversation_id = ? WHERE conversation_id IS NULL')
          .run(defaultConversationId);
        
        console.log(`[DB] Migrated ${existingMessages.length} messages to default conversation`);
      }
    }
  }

  // Character operations
  async getCharacters(): Promise<Character[]> {
    const rows = this.db.prepare('SELECT * FROM characters ORDER BY name').all();
    
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      arc: row.arc || '',
      age: row.age || undefined,
      occupation: row.occupation || undefined,
      physicalAppearance: row.physical_appearance || undefined,
      personality: row.personality || undefined,
      goals: row.goals || undefined,
      fears: row.fears || undefined,
      backstory: row.backstory || undefined,
      relationships: row.relationships ? JSON.parse(row.relationships) : {},
      customAttributes: row.custom_attributes ? JSON.parse(row.custom_attributes) : undefined,
      appearances: row.appearances ? JSON.parse(row.appearances) : [],
      notes: row.notes || undefined,
      imageUrl: row.image_url || undefined,
    }));
  }

  async getCharacter(id: string): Promise<Character | null> {
    const row = this.db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      arc: row.arc || '',
      age: row.age || undefined,
      occupation: row.occupation || undefined,
      physicalAppearance: row.physical_appearance || undefined,
      personality: row.personality || undefined,
      goals: row.goals || undefined,
      fears: row.fears || undefined,
      backstory: row.backstory || undefined,
      relationships: row.relationships ? JSON.parse(row.relationships) : {},
      customAttributes: row.custom_attributes ? JSON.parse(row.custom_attributes) : undefined,
      appearances: row.appearances ? JSON.parse(row.appearances) : [],
      notes: row.notes || undefined,
      imageUrl: row.image_url || undefined,
    };
  }

  async saveCharacter(character: Character): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO characters (
        id, name, description, arc, age, occupation, physical_appearance,
        personality, goals, fears, backstory, relationships, custom_attributes,
        appearances, notes, image_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      character.id,
      character.name,
      character.description,
      character.arc,
      character.age || null,
      character.occupation || null,
      character.physicalAppearance || null,
      character.personality || null,
      character.goals || null,
      character.fears || null,
      character.backstory || null,
      JSON.stringify(character.relationships),
      character.customAttributes ? JSON.stringify(character.customAttributes) : null,
      JSON.stringify(character.appearances),
      character.notes || null,
      character.imageUrl || null
    );
  }

  async deleteCharacter(id: string): Promise<void> {
    this.db.prepare('DELETE FROM characters WHERE id = ?').run(id);
  }

  // Scene operations
  async getScenes(): Promise<Scene[]> {
    const rows = this.db.prepare('SELECT * FROM scenes ORDER BY COALESCE(scene_order, number)').all();
    
    return rows.map((row: any) => ({
      id: row.id,
      number: row.number,
      heading: row.heading,
      location: row.location || '',
      timeOfDay: row.time_of_day || '',
      summary: row.summary || '',
      characters: row.characters ? JSON.parse(row.characters) : [],
      startLine: row.start_line,
      endLine: row.end_line,
      content: row.content || '',
      order: row.scene_order || undefined,
      duration: row.duration || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
    }));
  }

  async getScene(id: string): Promise<Scene | null> {
    const row = this.db.prepare('SELECT * FROM scenes WHERE id = ?').get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      number: row.number,
      heading: row.heading,
      location: row.location || '',
      timeOfDay: row.time_of_day || '',
      summary: row.summary || '',
      characters: row.characters ? JSON.parse(row.characters) : [],
      startLine: row.start_line,
      endLine: row.end_line,
      content: row.content || '',
      order: row.scene_order || undefined,
      duration: row.duration || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
    };
  }

  async saveScene(scene: Scene): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO scenes 
      (id, number, heading, location, time_of_day, summary, characters, start_line, end_line, content, scene_order, duration, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      scene.id,
      scene.number,
      scene.heading,
      scene.location,
      scene.timeOfDay,
      scene.summary,
      JSON.stringify(scene.characters),
      scene.startLine,
      scene.endLine,
      scene.content,
      scene.order || null,
      scene.duration || null,
      scene.tags ? JSON.stringify(scene.tags) : null
    );
  }

  async deleteScene(id: string): Promise<void> {
    this.db.prepare('DELETE FROM scenes WHERE id = ?').run(id);
  }

  // Storyline operations
  async getStoryline(): Promise<Storyline | null> {
    const row = this.db.prepare('SELECT * FROM storyline LIMIT 1').get() as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      act: row.act,
      plotPoints: row.plot_points ? JSON.parse(row.plot_points) : [],
      themes: row.themes ? JSON.parse(row.themes) : [],
      narrativeStructure: row.narrative_structure || '',
    };
  }

  async saveStoryline(storyline: Storyline): Promise<void> {
    // Clear existing storyline
    this.db.prepare('DELETE FROM storyline').run();
    
    const stmt = this.db.prepare(`
      INSERT INTO storyline (id, act, plot_points, themes, narrative_structure)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      storyline.id,
      storyline.act,
      JSON.stringify(storyline.plotPoints),
      JSON.stringify(storyline.themes),
      storyline.narrativeStructure
    );
  }

  // Conversation operations
  async getConversations(): Promise<Conversation[]> {
    const rows = this.db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all();
    
    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createConversation(title: string): Promise<Conversation> {
    const id = 'conv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const now = Date.now();
    
    this.db.prepare(`
      INSERT INTO conversations (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(id, title, now, now);
    
    return { id, title, createdAt: now, updatedAt: now };
  }

  async updateConversation(id: string, title: string): Promise<void> {
    this.db.prepare(`
      UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?
    `).run(title, Date.now(), id);
  }

  async deleteConversation(id: string): Promise<void> {
    // Delete all messages in the conversation first
    this.db.prepare('DELETE FROM ai_history WHERE conversation_id = ?').run(id);
    // Then delete the conversation
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }

  async updateConversationTimestamp(id: string): Promise<void> {
    this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(Date.now(), id);
  }

  // AI History operations
  async getAIHistory(): Promise<AIMessage[]> {
    const rows = this.db.prepare('SELECT * FROM ai_history ORDER BY timestamp').all();
    
    return rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      contextUsed: row.context_used ? JSON.parse(row.context_used) : undefined,
      conversationId: row.conversation_id || undefined,
    }));
  }

  async getAIHistoryForConversation(conversationId: string): Promise<AIMessage[]> {
    const rows = this.db.prepare(
      'SELECT * FROM ai_history WHERE conversation_id = ? ORDER BY timestamp'
    ).all(conversationId);
    
    return rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      contextUsed: row.context_used ? JSON.parse(row.context_used) : undefined,
      conversationId: row.conversation_id,
    }));
  }

  async saveAIMessage(message: AIMessage): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO ai_history (id, role, content, timestamp, context_used, conversation_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      message.id,
      message.role,
      message.content,
      message.timestamp,
      message.contextUsed ? JSON.stringify(message.contextUsed) : null,
      message.conversationId || null
    );
    
    // Update conversation timestamp
    if (message.conversationId) {
      this.updateConversationTimestamp(message.conversationId);
    }
  }

  // AI Memory operations
  async saveAIMemory(id: string, contextType: string, content: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_memory (id, timestamp, context_type, content)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, Date.now(), contextType, content);
  }

  async getAIMemory(contextType?: string): Promise<any[]> {
    let query = 'SELECT * FROM ai_memory';
    let params: any[] = [];
    
    if (contextType) {
      query += ' WHERE context_type = ?';
      params.push(contextType);
    }
    
    query += ' ORDER BY timestamp DESC';
    
    return this.db.prepare(query).all(...params);
  }

  async clearDatabase(): Promise<void> {
    this.db.prepare('DELETE FROM characters').run();
    this.db.prepare('DELETE FROM scenes').run();
    this.db.prepare('DELETE FROM storyline').run();
    this.db.prepare('DELETE FROM ai_history').run();
    this.db.prepare('DELETE FROM ai_memory').run();
    this.db.prepare('DELETE FROM conversations').run();
  }

  close() {
    this.db.close();
  }
}

