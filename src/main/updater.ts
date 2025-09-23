import axios from "axios";
import { app, dialog, shell } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Logger } from "./logger";

// GitHub repository information
const REPO_OWNER = "Baka-Course-Platform";
const REPO_NAME = "Baka-Course-Platform";
const GITHUB_API_BASE = "https://api.github.com";

// Current application version
const CURRENT_VERSION = app.getVersion();

// Update check interval (24 hours)
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

// Update error codes
export const UPDATE_ERROR_CODES = {
  NO_SUITABLE_FILE: "NO_SUITABLE_FILE",
  UNKNOWN_CHECK_ERROR: "UNKNOWN_CHECK_ERROR",
  DOWNLOAD_TIMEOUT: "DOWNLOAD_TIMEOUT",
  FILE_SIZE_MISMATCH: "FILE_SIZE_MISMATCH",
  FILE_WRITE_ERROR: "FILE_WRITE_ERROR",
  DOWNLOAD_STREAM_ERROR: "DOWNLOAD_STREAM_ERROR",
  UNKNOWN_DOWNLOAD_ERROR: "UNKNOWN_DOWNLOAD_ERROR",
  UNSUPPORTED_PLATFORM: "UNSUPPORTED_PLATFORM",
  UNKNOWN_INSTALL_ERROR: "UNKNOWN_INSTALL_ERROR",
} as const;

// Update state interfaces
export interface UpdateInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  publishedAt: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  updateInfo?: UpdateInfo;
  error?: string;
  errorCode?: string;
}

// Get platform-specific file extension
function getPlatformFileExtension(): string {
  const platform = os.platform();
  switch (platform) {
    case "win32":
      return ".exe";
    case "darwin":
      return ".dmg";
    case "linux":
      return ".AppImage";
    default:
      return "";
  }
}

// Get platform-specific architecture
function getPlatformArch(): string {
  const arch = os.arch();
  const platform = os.platform();
  
  if (platform === "darwin") {
    return arch === "arm64" ? "arm64" : "x64";
  } else if (platform === "win32") {
    return arch === "x64" ? "x64" : "ia32";
  } else {
    return "x64";
  }
}

// Compare version numbers
function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split(".").map(Number);
  const v2Parts = version2.split(".").map(Number);
  
  const maxLength = Math.max(v1Parts.length, v2Parts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}

// Check if there are new versions available
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    Logger.info("Starting update check...");
    Logger.debug(`Request URL: ${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
    Logger.info(`Current version: ${CURRENT_VERSION}`);
    
    // Get the latest release version
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      {
        timeout: 10000,
        headers: {
          "User-Agent": "Smart-Course-Platform-Updater",
          "Accept": "application/vnd.github.v3+json",
        },
      }
    );

    const release = response.data;
    const latestVersion = release.tag_name.replace(/^v/, ""); // Remove v prefix

    Logger.info(`Version comparison: current=${CURRENT_VERSION}, latest=${latestVersion}`);

    // Compare versions
    const versionComparison = compareVersions(latestVersion, CURRENT_VERSION);
    Logger.debug(`Version comparison result: ${versionComparison} (positive means update available)`);
    
    if (versionComparison <= 0) {
      Logger.info("Already using the latest version");
      return { 
        hasUpdate: false, 
        currentVersion: CURRENT_VERSION,
        latestVersion: latestVersion
      };
    }
    
    Logger.info("New version found!");

    // Find the appropriate download file for the current platform
    const platform = os.platform();
    const arch = getPlatformArch();
    const expectedExtension = getPlatformFileExtension();

    let asset = null;

    // Find the corresponding resource file based on platform and architecture
    if (platform === "darwin") {
      // macOS: Find .dmg file
      asset = release.assets.find((a: any) => {
        const name = a.name.toLowerCase();
        if (!name.endsWith(expectedExtension.toLowerCase())) {
          return false;
        }
        return arch === "arm64" ? name.includes("arm64") : name.includes("x64");
      });
    } else if (platform === "win32") {
      // Windows: Find .exe file
      asset = release.assets.find((a: any) => {
        const name = a.name.toLowerCase();
        if (!name.endsWith(expectedExtension.toLowerCase())) {
          return false;
        }
        return arch === "x64" ? name.includes("x64") : name.includes("ia32");
      });
    } else if (platform === "linux") {
      // Linux: Find .AppImage file
      asset = release.assets.find((a: any) =>
        a.name.toLowerCase().endsWith(expectedExtension.toLowerCase())
      );
    }

    if (!asset) {
      return {
        hasUpdate: true,
        currentVersion: CURRENT_VERSION,
        latestVersion: latestVersion,
        error: "No suitable update file found for current platform",
        errorCode: UPDATE_ERROR_CODES.NO_SUITABLE_FILE,
      };
    }

    const updateInfo: UpdateInfo = {
      version: latestVersion,
      releaseNotes: release.body || "No release notes available",
      downloadUrl: asset.browser_download_url,
      fileName: asset.name,
      fileSize: asset.size,
      publishedAt: release.published_at,
    };

    return {
      hasUpdate: true,
      currentVersion: CURRENT_VERSION,
      latestVersion: latestVersion,
      updateInfo,
    };
  } catch (error) {
    Logger.error("Update check failed", error);
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      error: error instanceof Error ? error.message : "Unknown error occurred during update check",
      errorCode: UPDATE_ERROR_CODES.UNKNOWN_CHECK_ERROR,
    };
  }
}

// Download update file
export async function downloadUpdate(
  updateInfo: UpdateInfo,
  onProgress?: (progress: { percent: number; downloaded: number; total: number }) => void
): Promise<{ success: boolean; filePath?: string; error?: string; errorCode?: string }> {
  try {
    Logger.info(`Starting download: ${updateInfo.fileName}`);
    Logger.debug(`Download URL: ${Logger.sanitizeUrl(updateInfo.downloadUrl)}`);
    Logger.info(`File size: ${(updateInfo.fileSize / 1024 / 1024).toFixed(1)} MB`);
    
    // Create download directory
    const downloadDir = path.join(os.tmpdir(), "smart-course-platform-updates");
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    const filePath = path.join(downloadDir, updateInfo.fileName);
    
    // Send download start event
    await notifyRendererWindows("update-download", {
      type: DOWNLOAD_STATUS_TYPES.STARTED,
      fileName: updateInfo.fileName,
      fileSize: updateInfo.fileSize
    });
    
    // Download file
    Logger.info("Starting file download...");
    
    const response = await axios.get(updateInfo.downloadUrl, {
      responseType: "stream",
      timeout: 30000, // 30 second connection timeout
      headers: {
        "User-Agent": "Smart-Course-Platform-Updater/1.0",
        "Accept": "*/*",
      },
    });

    const writer = fs.createWriteStream(filePath);
    const totalSize = updateInfo.fileSize;
    let downloadedSize = 0;
    let lastProgressTime = Date.now();
    let timeoutId: NodeJS.Timeout | null = null;

    // Set download timeout (5 minutes)
    const resetTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        Logger.error("Download timeout - no progress update in 5 minutes");
        writer.destroy();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }, 300000); // 5 minute timeout
    };

    // Listen to download progress
    response.data.on("data", (chunk: Buffer) => {
      downloadedSize += chunk.length;
      const percent = Math.round((downloadedSize / totalSize) * 100);
      const now = Date.now();

      // Output progress every 5% or every 10 seconds
      if (percent % 5 === 0 || now - lastProgressTime > 10000) {
        Logger.info(`Download progress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
        lastProgressTime = now;
      }
      
      // Send progress update event
      import("electron").then(({ BrowserWindow }) => {
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach((window) => {
          window.webContents.send("update-download", {
            type: DOWNLOAD_STATUS_TYPES.PROGRESS,
            percent,
            downloaded: downloadedSize,
            total: totalSize,
            downloadedMB: (downloadedSize / 1024 / 1024).toFixed(1),
            totalMB: (totalSize / 1024 / 1024).toFixed(1)
          });
        });
      });
      
      if (onProgress) {
        onProgress({ percent, downloaded: downloadedSize, total: totalSize });
      }
      
      // Reset timeout timer
      resetTimeout();
    });

    response.data.pipe(writer);

    return new Promise((resolve) => {
      // Initial timeout setup
      resetTimeout();

      writer.on("finish", () => {
        if (timeoutId) clearTimeout(timeoutId);
        Logger.info(`Update file download completed: ${filePath}`);

        // Verify file size
        const stats = fs.statSync(filePath);
        if (stats.size !== totalSize) {
          Logger.warn(`File size mismatch: expected ${totalSize}, actual ${stats.size}`);
          fs.unlinkSync(filePath);
          resolve({
            success: false,
            error: "File size mismatch, download may be incomplete",
            errorCode: UPDATE_ERROR_CODES.FILE_SIZE_MISMATCH,
          });
          return;
        }
        
        // Send download completed event
        import("electron").then(({ BrowserWindow }) => {
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach((window) => {
            window.webContents.send("update-download", {
              type: DOWNLOAD_STATUS_TYPES.COMPLETED,
              filePath,
              fileName: updateInfo.fileName
            });
          });
        });
        
        resolve({ success: true, filePath });
      });

      writer.on("error", (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        Logger.error("File write failed", error);

        // Clean up file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // Send download failed event
        import("electron").then(({ BrowserWindow }) => {
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach((window) => {
            window.webContents.send("update-download", {
              type: DOWNLOAD_STATUS_TYPES.ERROR,
              error: error.message,
              errorCode: UPDATE_ERROR_CODES.FILE_WRITE_ERROR
            });
          });
        });

        resolve({
          success: false,
          error: `File write failed: ${error.message}`,
          errorCode: UPDATE_ERROR_CODES.FILE_WRITE_ERROR,
        });
      });
      
      // Listen to response errors
      response.data.on("error", (error: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        Logger.error("Download stream error", error);

        // Clean up file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // Send download failed event
        import("electron").then(({ BrowserWindow }) => {
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach((window) => {
            window.webContents.send("update-download", {
              type: DOWNLOAD_STATUS_TYPES.ERROR,
              error: error.message,
              errorCode: UPDATE_ERROR_CODES.DOWNLOAD_STREAM_ERROR
            });
          });
        });

        resolve({
          success: false,
          error: `Download stream error: ${error.message}`,
          errorCode: UPDATE_ERROR_CODES.DOWNLOAD_STREAM_ERROR,
        });
      });
    });
  } catch (error) {
    Logger.error("Download update failed", error);

    // Send download error event
    import("electron").then(({ BrowserWindow }) => {
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        window.webContents.send("update-download", {
          type: DOWNLOAD_STATUS_TYPES.ERROR,
          error: error instanceof Error ? error.message : "Unknown error occurred during update download",
          errorCode: UPDATE_ERROR_CODES.UNKNOWN_DOWNLOAD_ERROR
        });
      });
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred during update download",
      errorCode: UPDATE_ERROR_CODES.UNKNOWN_DOWNLOAD_ERROR,
    };
  }
}

// Install update
export async function installUpdate(filePath: string): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  try {
    const platform = os.platform();
    const { spawn } = await import("child_process");

    switch (platform) {
      case "darwin":
        // macOS: Open .dmg file
        await shell.openPath(filePath);
        return { success: true };

      case "win32":
        // Windows: Run .exe installer
        const winInstaller = spawn(filePath, ["/S"], { detached: true, stdio: "ignore" });
        winInstaller.unref();
        return { success: true };

      case "linux":
        // Linux: Add execute permission to AppImage and run
        fs.chmodSync(filePath, "755");
        const linuxInstaller = spawn(filePath, [], { detached: true, stdio: "ignore" });
        linuxInstaller.unref();
        return { success: true };

      default:
        return {
          success: false,
          error: "Unsupported operating system",
          errorCode: UPDATE_ERROR_CODES.UNSUPPORTED_PLATFORM,
        };
    }
  } catch (error) {
    Logger.error("Update installation failed", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred during update installation",
      errorCode: UPDATE_ERROR_CODES.UNKNOWN_INSTALL_ERROR,
    };
  }
}

// Show update dialog
export async function showUpdateDialog(updateInfo: UpdateInfo): Promise<boolean> {
  const fileSizeMB = (updateInfo.fileSize / 1024 / 1024).toFixed(1);
  const publishDate = new Date(updateInfo.publishedAt).toLocaleString();

  const result = await dialog.showMessageBox({
    type: "info",
    title: "Update Available",
    message: `New version ${updateInfo.version} available`,
    detail: `Current version: ${CURRENT_VERSION}\n\nRelease notes:\n${updateInfo.releaseNotes}\n\nFile size: ${fileSizeMB} MB\nPublished: ${publishDate}`,
    buttons: ["Update Now", "Remind Later", "Skip Version"],
    defaultId: 0,
    cancelId: 1,
  });

  return result.response === 0; // 0 = Update Now
}

// Auto check for updates (called on app startup)
export async function autoCheckForUpdates(): Promise<void> {
  try {
    // Check last check time
    const lastCheckTime = getLastUpdateCheckTime();
    const now = Date.now();

    // Skip check if less than 24 hours since last check
    if (lastCheckTime && (now - lastCheckTime) < UPDATE_CHECK_INTERVAL) {
      Logger.info("Skipping auto update check (checked less than 24 hours ago)");
      return;
    }

    Logger.info("Starting auto update check...");
    const result = await checkForUpdates();
    
    if (result.hasUpdate && result.updateInfo) {
      Logger.info(`New version found: ${result.updateInfo.version}`);
      // Send event to renderer process to show update notification
      await notifyRendererWindows("update-status", {
        type: UPDATE_STATUS_TYPES.AVAILABLE,
        updateInfo: result.updateInfo,
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion
      });
    } else if (result.error) {
      Logger.error("Auto update check failed", result.error);
      // Send error information to renderer process
      await notifyRendererWindows("update-status", {
        type: UPDATE_STATUS_TYPES.ERROR,
        error: result.error,
        errorCode: result.errorCode,
        currentVersion: result.currentVersion
      });
    } else {
      Logger.info(`Already using the latest version (${result.currentVersion})`);
      // Send latest version information to renderer process
      await notifyRendererWindows("update-status", {
        type: UPDATE_STATUS_TYPES.UP_TO_DATE,
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion
      });
    }
    
    // Update last check time
    setLastUpdateCheckTime(now);
  } catch (error) {
    Logger.error("Auto update check exception", error);
  }
}

// Update status types
export const UPDATE_STATUS_TYPES = {
  CHECKING: "checking",
  AVAILABLE: "available",
  UP_TO_DATE: "up-to-date",
  ERROR: "error",
} as const;

export const DOWNLOAD_STATUS_TYPES = {
  STARTED: "started",
  PROGRESS: "progress",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

// Helper function to notify all renderer windows
async function notifyRendererWindows(channel: string, data: any): Promise<void> {
  const { BrowserWindow } = await import("electron");
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach((window) => {
    window.webContents.send(channel, data);
  });
}

// Get last update check time
function getLastUpdateCheckTime(): number | null {
  try {
    const dataPath = path.join(app.getPath("userData"), "update-check.json");
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
      return data.lastCheckTime || null;
    }
  } catch (error) {
    Logger.error("Failed to read update check time", error);
  }
  return null;
}

// Set last update check time
function setLastUpdateCheckTime(timestamp: number): void {
  try {
    const dataPath = path.join(app.getPath("userData"), "update-check.json");
    const data = { lastCheckTime: timestamp };
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    Logger.error("Failed to save update check time", error);
  }
}
