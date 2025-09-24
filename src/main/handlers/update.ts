import { ipcMain, BrowserWindow, app } from "electron";
import {
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  showUpdateDialog,
  UpdateInfo,
} from "../updater";
import { Logger } from "../logger";

export function setupUpdateHandlers() {
  // Update-related IPC handlers
  ipcMain.handle("check-for-updates", async () => {
    try {
      // Send update check start notification
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        window.webContents.send("update-status", {
          type: "checking",
          currentVersion: app.getVersion(),
        });
      });

      const result = await checkForUpdates();

      // Send feedback to renderer process
      allWindows.forEach((window) => {
        if (result.hasUpdate && result.updateInfo) {
          // Update available
          window.webContents.send("update-status", {
            type: "available",
            updateInfo: result.updateInfo,
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
          });
        } else if (result.error) {
          // Check failed
          window.webContents.send("update-status", {
            type: "error",
            error: result.error,
            errorCode: result.errorCode,
            currentVersion: result.currentVersion,
          });
        } else {
          // Already latest version
          window.webContents.send("update-status", {
            type: "up-to-date",
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
          });
        }
      });

      return result;
    } catch (error) {
      Logger.error("Update check failed", error);
      const errorResult = {
        hasUpdate: false,
        currentVersion: app.getVersion(),
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred during update check",
      };

      // Send error feedback to renderer process
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        window.webContents.send("update-status", {
          type: "error",
          error: errorResult.error,
          errorCode: "UNKNOWN_CHECK_ERROR",
          currentVersion: errorResult.currentVersion,
        });
      });

      return errorResult;
    }
  });

  ipcMain.handle("download-update", async (event, updateInfo: UpdateInfo) => {
    try {
      return await downloadUpdate(updateInfo);
    } catch (error) {
      Logger.error("Download update failed", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred during update download",
      };
    }
  });

  ipcMain.handle("install-update", async (event, filePath: string) => {
    try {
      const result = await installUpdate(filePath);
      if (result.success) {
        // Exit app after successful installation
        setTimeout(() => {
          app.quit();
        }, 1000);
      }
      return result;
    } catch (error) {
      Logger.error("Install update failed", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred during update installation",
      };
    }
  });

  ipcMain.handle("show-update-dialog", async (event, updateInfo: UpdateInfo) => {
    try {
      return await showUpdateDialog(updateInfo);
    } catch (error) {
      Logger.error("Show update dialog failed", error);
      return false;
    }
  });
}

export function notifyRendererAboutUpdate(updateInfo: UpdateInfo) {
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach((window) => {
    window.webContents.send("update-available", updateInfo);
  });
}