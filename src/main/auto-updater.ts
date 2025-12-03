import { dialog, BrowserWindow, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';

// Track if user chose auto-restart
let shouldAutoRestart = false;
let downloadingVersion = '';
let lastProgressNotification = 0;

export function setupAutoUpdater(mainWindow: BrowserWindow | null) {
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Enable more detailed logging
  autoUpdater.logger = {
    info: (message: any) => console.log('[AutoUpdater]', message),
    warn: (message: any) => console.warn('[AutoUpdater]', message),
    error: (message: any) => console.error('[AutoUpdater]', message),
    debug: (message: any) => console.log('[AutoUpdater DEBUG]', message),
  };

  // Check for updates on startup (after 10 seconds)
  setTimeout(() => {
    console.log('[AutoUpdater] Checking for updates on startup...');
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[AutoUpdater] Startup check failed:', err);
    });
  }, 10000);

  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[AutoUpdater] Periodic check failed:', err);
    });
  }, 4 * 60 * 60 * 1000);

  // Update available
  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    downloadingVersion = info.version;
    
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
        
        // Show downloading notification
        dialog.showMessageBox({
          type: 'info',
          buttons: [],
          title: 'Downloading Update',
          message: `Downloading v${info.version}...`,
          detail: 'This may take a few minutes. The app will restart automatically when complete.',
          noLink: true,
        });
        
        console.log('[AutoUpdater] Starting download (auto-restart)...');
        autoUpdater.downloadUpdate().catch(err => {
          console.error('[AutoUpdater] Download failed:', err);
        });
        
        // Notify the renderer about the download
        if (mainWindow) {
          mainWindow.webContents.send('update-downloading', info.version);
        }
      } else if (result.response === 1) {
        // Download only - ask before restart
        shouldAutoRestart = false;
        
        // Show downloading notification  
        dialog.showMessageBox({
          type: 'info',
          buttons: [],
          title: 'Downloading Update',
          message: `Downloading v${info.version}...`,
          detail: 'This may take a few minutes. You will be notified when complete.',
          noLink: true,
        });
        
        console.log('[AutoUpdater] Starting download (manual restart)...');
        autoUpdater.downloadUpdate().catch(err => {
          console.error('[AutoUpdater] Download failed:', err);
        });
        
        if (mainWindow) {
          mainWindow.webContents.send('update-downloading', info.version);
        }
      }
      // response === 2: Not Now - do nothing
    });
  });

  // Update not available
  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] No updates available. Current:', info.version);
  });

  // Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = progressObj.percent.toFixed(1);
    const speedMB = (progressObj.bytesPerSecond / (1024 * 1024)).toFixed(2);
    const downloadedMB = (progressObj.transferred / (1024 * 1024)).toFixed(1);
    const totalMB = (progressObj.total / (1024 * 1024)).toFixed(1);
    
    console.log(`[AutoUpdater] Download: ${percent}% (${downloadedMB}/${totalMB} MB at ${speedMB} MB/s)`);
    
    // Send progress to renderer
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
      
      // Update window title with progress
      const originalTitle = mainWindow.getTitle().replace(/ - Downloading.*$/, '');
      mainWindow.setTitle(`${originalTitle} - Downloading ${percent}%`);
    }
    
    // Show system notification every 25%
    const now = Date.now();
    if (now - lastProgressNotification > 5000 && Math.floor(progressObj.percent / 25) > Math.floor((progressObj.percent - 1) / 25)) {
      lastProgressNotification = now;
      if (Notification.isSupported()) {
        new Notification({
          title: 'Update Downloading',
          body: `${percent}% complete (${downloadedMB}/${totalMB} MB)`,
          silent: true,
        }).show();
      }
    }
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Download complete:', info.version);
    
    // Reset window title
    if (mainWindow) {
      const originalTitle = mainWindow.getTitle().replace(/ - Downloading.*$/, '');
      mainWindow.setTitle(originalTitle);
    }
    
    if (shouldAutoRestart) {
      // Auto-restart: brief notification then restart
      dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart Now'],
        title: 'Update Ready!',
        message: `Version ${info.version} downloaded successfully!`,
        detail: 'Click to restart and apply the update.',
      }).then(() => {
        console.log('[AutoUpdater] Quitting and installing...');
        autoUpdater.quitAndInstall(false, true);
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
          console.log('[AutoUpdater] User chose restart now');
          autoUpdater.quitAndInstall(false, true);
        } else {
          console.log('[AutoUpdater] User chose to restart later');
        }
      });
    }
  });

  // Error
  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err);
    shouldAutoRestart = false;
    
    // Reset window title
    if (mainWindow) {
      const originalTitle = mainWindow.getTitle().replace(/ - Downloading.*$/, '');
      mainWindow.setTitle(originalTitle);
    }
    
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Error',
      message: 'Failed to download update',
      detail: `${err.message || 'Unknown error'}\n\nPlease check your internet connection and try again.`,
    });
  });
}

export function checkForUpdatesManually() {
  console.log('[AutoUpdater] Manual update check triggered');
  autoUpdater.checkForUpdates().then(result => {
    if (result) {
      console.log('[AutoUpdater] Check result:', result.updateInfo?.version || 'No update info');
    }
  }).catch(err => {
    console.error('[AutoUpdater] Manual check failed:', err);
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Check Failed',
      message: 'Could not check for updates',
      detail: err.message || 'Please check your internet connection.',
    });
  });
}

