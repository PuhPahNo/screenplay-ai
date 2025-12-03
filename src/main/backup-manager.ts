import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const MAX_BACKUPS = 10;
const BACKUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export interface BackupInfo {
  filename: string;
  path: string;
  timestamp: number;
  size: number;
}

export class BackupManager {
  private backupDir: string;
  private projectName: string;
  private projectPath: string;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.projectName = path.basename(projectPath, path.extname(projectPath));
    
    // Create backup directory in app data folder
    const userDataPath = app.getPath('userData');
    this.backupDir = path.join(userDataPath, 'backups', this.projectName);
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of the current project
   */
  async createBackup(reason: string = 'auto'): Promise<BackupInfo> {
    const timestamp = Date.now();
    const filename = `${this.projectName}-${reason}-${timestamp}.screenplay`;
    const backupPath = path.join(this.backupDir, filename);
    
    // Copy the project file
    fs.copyFileSync(this.projectPath, backupPath);
    
    const stats = fs.statSync(backupPath);
    
    console.log(`[Backup] Created backup: ${filename}`);
    
    // Clean up old backups
    await this.cleanOldBackups();
    
    return {
      filename,
      path: backupPath,
      timestamp,
      size: stats.size,
    };
  }

  /**
   * List all backups for this project
   */
  async listBackups(): Promise<BackupInfo[]> {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }
    
    const files = fs.readdirSync(this.backupDir);
    const backups: BackupInfo[] = [];
    
    for (const filename of files) {
      if (filename.endsWith('.screenplay')) {
        const backupPath = path.join(this.backupDir, filename);
        const stats = fs.statSync(backupPath);
        
        // Extract timestamp from filename
        const match = filename.match(/-(\d+)\.screenplay$/);
        const timestamp = match ? parseInt(match[1], 10) : stats.mtimeMs;
        
        backups.push({
          filename,
          path: backupPath,
          timestamp,
          size: stats.size,
        });
      }
    }
    
    // Sort by timestamp descending (newest first)
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Restore a backup to the current project
   */
  async restoreBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }
    
    // Create a backup of current state before restoring
    await this.createBackup('pre-restore');
    
    // Copy backup over current project
    fs.copyFileSync(backupPath, this.projectPath);
    
    console.log(`[Backup] Restored from: ${path.basename(backupPath)}`);
  }

  /**
   * Delete old backups, keeping only the most recent MAX_BACKUPS
   */
  private async cleanOldBackups(): Promise<void> {
    const backups = await this.listBackups();
    
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      
      for (const backup of toDelete) {
        try {
          fs.unlinkSync(backup.path);
          console.log(`[Backup] Deleted old backup: ${backup.filename}`);
        } catch (error) {
          console.error(`[Backup] Failed to delete: ${backup.filename}`, error);
        }
      }
    }
  }

  /**
   * Start automatic periodic backups
   */
  startAutoBackup(): void {
    if (this.intervalId) {
      return; // Already running
    }
    
    console.log('[Backup] Starting auto-backup (every 30 minutes)');
    
    this.intervalId = setInterval(async () => {
      try {
        await this.createBackup('auto');
      } catch (error) {
        console.error('[Backup] Auto-backup failed:', error);
      }
    }, BACKUP_INTERVAL_MS);
  }

  /**
   * Stop automatic backups
   */
  stopAutoBackup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Backup] Stopped auto-backup');
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupPath: string): Promise<void> {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      console.log(`[Backup] Deleted: ${path.basename(backupPath)}`);
    }
  }

  /**
   * Get the backup directory path
   */
  getBackupDir(): string {
    return this.backupDir;
  }
}

