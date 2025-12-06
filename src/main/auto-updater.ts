import { dialog, BrowserWindow, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';

// Track if user chose auto-restart
let shouldAutoRestart = false;
let _downloadingVersion = '';
let _lastProgressNotification = 0;
let _isDownloading = false;

export function setupAutoUpdater(mainWindow: BrowserWindow | null) {
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  
  // IMPORTANT: Skip code signature verification for unsigned apps
  // This is required because we're not code-signing with an Apple Developer certificate
  // Without this, macOS will reject the update with "code has no resources but signature indicates they must be present"
  autoUpdater.forceDevUpdateConfig = true;
  
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

    dialog.showMessageBox(dialogOpts).then(async (result) => {
      if (result.response === 0 || result.response === 1) {
        shouldAutoRestart = result.response === 0;
        isDownloading = true;
        
        // Update window title to show downloading
        if (mainWindow) {
          mainWindow.setTitle(`Screenplay AI - Downloading v${info.version}...`);
          mainWindow.webContents.send('update-downloading', info.version);
        }
        
        // Show system notification that download started
        if (Notification.isSupported()) {
          new Notification({
            title: 'Downloading Update',
            body: `Downloading v${info.version}... Check the window title for progress.`,
          }).show();
        }
        
        console.log(`[AutoUpdater] Starting download (${shouldAutoRestart ? 'auto' : 'manual'} restart)...`);
        
        try {
          await autoUpdater.downloadUpdate();
        } catch (err: any) {
          console.error('[AutoUpdater] Download failed:', err);
          isDownloading = false;
          
          if (mainWindow) {
            mainWindow.setTitle('Screenplay AI');
          }
          
          dialog.showMessageBox({
            type: 'error',
            title: 'Download Failed',
            message: 'Could not download update',
            detail: err?.message || 'Please check your internet connection and try again.',
          });
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
    const percent = Math.round(progressObj.percent);
    const speedMB = (progressObj.bytesPerSecond / (1024 * 1024)).toFixed(1);
    const downloadedMB = (progressObj.transferred / (1024 * 1024)).toFixed(1);
    const totalMB = (progressObj.total / (1024 * 1024)).toFixed(1);
    
    // Log every 10%
    if (percent % 10 === 0 || percent === 1) {
      console.log(`[AutoUpdater] ▓▓▓ ${percent}% (${downloadedMB}/${totalMB} MB @ ${speedMB} MB/s)`);
    }
    
    // Send progress to renderer
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
      
      // Update window title with progress bar
      const progressBar = '█'.repeat(Math.floor(percent / 10)) + '░'.repeat(10 - Math.floor(percent / 10));
      mainWindow.setTitle(`Screenplay AI - Updating [${progressBar}] ${percent}%`);
    }
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] ✓ Download complete:', info.version);
    isDownloading = false;
    
    // Reset window title
    if (mainWindow) {
      mainWindow.setTitle('Screenplay AI - Update Ready!');
      mainWindow.webContents.send('update-downloaded', info);
    }
    
    // Show system notification
    if (Notification.isSupported()) {
      new Notification({
        title: 'Update Ready!',
        body: `v${info.version} downloaded. ${shouldAutoRestart ? 'Restarting...' : 'Restart to apply.'}`,
      }).show();
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
        setImmediate(() => {
          autoUpdater.quitAndInstall(false, true);
        });
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
          setImmediate(() => {
            autoUpdater.quitAndInstall(false, true);
          });
        } else {
          console.log('[AutoUpdater] User chose to restart later');
          if (mainWindow) {
            mainWindow.setTitle('Screenplay AI');
          }
        }
      });
    }
  });

  // Error
  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] ✗ Error:', err);
    shouldAutoRestart = false;
    isDownloading = false;
    
    // Reset window title
    if (mainWindow) {
      mainWindow.setTitle('Screenplay AI');
      mainWindow.webContents.send('update-error', err.message);
    }
    
    // Show system notification
    if (Notification.isSupported()) {
      new Notification({
        title: 'Update Failed',
        body: 'Could not download update. Check console for details.',
      }).show();
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

