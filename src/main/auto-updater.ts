import { dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

export function setupAutoUpdater() {
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
      buttons: ['Download', 'Later'],
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: 'Would you like to download it now? The app will update when you restart.',
    };

    dialog.showMessageBox(dialogOpts).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  // Update not available
  autoUpdater.on('update-not-available', () => {
    console.log('No updates available');
  });

  // Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download speed: ${progressObj.bytesPerSecond}`);
    console.log(`Downloaded ${progressObj.percent}%`);
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    const dialogOpts = {
      type: 'info' as const,
      buttons: ['Restart', 'Later'],
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'The update will be installed when you restart the application. Restart now?',
    };

    dialog.showMessageBox(dialogOpts).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  // Error
  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });
}

export function checkForUpdatesManually() {
  autoUpdater.checkForUpdates();
}

