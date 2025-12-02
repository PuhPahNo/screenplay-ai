import { dialog, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

// Track if user chose auto-restart
let shouldAutoRestart = false;

export function setupAutoUpdater(mainWindow: BrowserWindow | null) {
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Check for updates on startup (after 10 seconds)
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 10000);

  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);

  // Update available
  autoUpdater.on('update-available', (info) => {
    const dialogOpts = {
      type: 'info' as const,
      buttons: ['Download & Restart', 'Download (restart later)', 'Not Now'],
      defaultId: 0,
      cancelId: 2,
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: 'Choose "Download & Restart" for a seamless update experience.',
    };

    dialog.showMessageBox(dialogOpts).then((result) => {
      if (result.response === 0) {
        // Download & Restart - auto-restart when download completes
        shouldAutoRestart = true;
        autoUpdater.downloadUpdate();
        
        // Notify the renderer about the download
        if (mainWindow) {
          mainWindow.webContents.send('update-downloading', info.version);
        }
      } else if (result.response === 1) {
        // Download only - ask before restart
        shouldAutoRestart = false;
        autoUpdater.downloadUpdate();
        
        if (mainWindow) {
          mainWindow.webContents.send('update-downloading', info.version);
        }
      }
      // response === 2: Not Now - do nothing
    });
  });

  // Update not available
  autoUpdater.on('update-not-available', () => {
    console.log('No updates available');
  });

  // Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download speed: ${progressObj.bytesPerSecond}`);
    console.log(`Downloaded ${progressObj.percent.toFixed(1)}%`);
    
    // Send progress to renderer
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
    }
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    if (shouldAutoRestart) {
      // Auto-restart: brief notification then restart
      dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        title: 'Restarting...',
        message: 'Update downloaded!',
        detail: 'The app will restart in a moment to apply the update.',
      }).then(() => {
        // Small delay so user sees the message
        setTimeout(() => {
          autoUpdater.quitAndInstall(false, true);
        }, 500);
      });
    } else {
      // Manual restart: ask user
      const dialogOpts = {
        type: 'info' as const,
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'Restart the app to apply the update.',
      };

      dialog.showMessageBox(dialogOpts).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    }
  });

  // Error
  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    shouldAutoRestart = false;
    
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Error',
      message: 'Failed to download update',
      detail: err.message || 'Please try again later.',
    });
  });
}

export function checkForUpdatesManually() {
  autoUpdater.checkForUpdates();
}

