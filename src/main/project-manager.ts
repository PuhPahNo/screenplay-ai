import fs from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import type { ProjectSettings } from '../shared/types';

export class ProjectManager {
  private projectPath: string;
  private screenplayPath: string;
  private metaPath: string;
  private settingsPath: string;
  private watcher: chokidar.FSWatcher | null = null;

  private isSaving: boolean = false;

  constructor(projectPath: string) {
    this.projectPath = projectPath;

    // Default path
    const defaultPath = path.join(projectPath, 'screenplay.fountain');
    this.screenplayPath = defaultPath;

    // Check if default exists, if not look for others
    if (!existsSync(defaultPath)) {
      try {
        // Use synchronous fs for constructor initialization
        const files = readdirSync(projectPath);
        // Find first .fountain file that isn't a hidden file
        const fountainFile = files.find(f => f.endsWith('.fountain') && !f.startsWith('.'));

        if (fountainFile) {
          this.screenplayPath = path.join(projectPath, fountainFile);
          console.log(`[ProjectManager] Found existing screenplay: ${fountainFile}`);
        }
      } catch (error) {
        console.warn('[ProjectManager] Error scanning directory for fountain files:', error);
      }
    }

    this.metaPath = path.join(projectPath, '.screenplay-ai');
    this.settingsPath = path.join(this.metaPath, 'settings.json');

    this.initializeWatcher();
  }

  private initializeWatcher() {
    this.watcher = chokidar.watch(this.screenplayPath, {
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('change', () => {
      // Ignore changes triggered by our own save
      if (this.isSaving) return;

      // Notify renderer of external changes
      console.log('Screenplay file changed externally');
    });
  }

  async saveScreenplay(content: string): Promise<void> {
    this.isSaving = true;
    try {
      await fs.writeFile(this.screenplayPath, content, 'utf-8');
    } finally {
      // Reset flag after a short delay to allow watcher event to fire
      setTimeout(() => {
        this.isSaving = false;
      }, 100);
    }
  }

  async loadScreenplay(): Promise<string> {
    try {
      return await fs.readFile(this.screenplayPath, 'utf-8');
    } catch (error) {
      // Return empty screenplay if file doesn't exist
      return '';
    }
  }

  async getSettings(): Promise<ProjectSettings> {
    try {
      const content = await fs.readFile(this.settingsPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Return default settings if file doesn't exist
      return {
        aiModel: 'gpt-5-mini',
        theme: 'dark',
        autoSave: true,
        characterNamingConvention: 'uppercase',
      };
    }
  }

  async saveSettings(settings: Partial<ProjectSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };

    // Ensure meta directory exists
    try {
      await fs.access(this.metaPath);
    } catch {
      await fs.mkdir(this.metaPath, { recursive: true });
    }

    await fs.writeFile(this.settingsPath, JSON.stringify(updated, null, 2), 'utf-8');
  }

  destroy() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}

