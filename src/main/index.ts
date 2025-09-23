import { app, BrowserWindow, Menu, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import axios from "axios";
import { LoginCredentials, LoginResponse } from "../shared/types";
import { API_CONFIG } from "./constants";
import {
  currentSession,
  captchaSession,
  handleFetchCaptcha,
  handleLogin,
  handleStoreCredentials,
  handleGetStoredCredentials,
  handleIsLoggedIn,
  handleLogout,
  handleValidateStoredSession,
  getCurrentSession,
  getCredentialsPath,
} from "./auth";
import {
  loadCacheFromFile,
  saveCacheToFile,
  getCachedData,
  setCachedData,
  getCacheTimestamp,
  CACHE_DURATION,
  COURSE_CACHE_DURATION,
  clearCache,
} from "./cache";
import {
  requestQueue,
  authenticatedRequest,
  fetchCourseList,
  fetchHomeworkData,
  fetchHomeworkStreaming,
  fetchCourseDocuments,
  fetchHomeworkDetails,
  fetchScheduleData,
} from "./api";
import {
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  showUpdateDialog,
  autoCheckForUpdates,
  UpdateInfo,
} from "./updater";
import { Logger } from "./logger";

const isDev = process.env.NODE_ENV === "development";

// Configure axios defaults
axios.defaults.headers.common["User-Agent"] = API_CONFIG.USER_AGENT;
axios.defaults.timeout = API_CONFIG.TIMEOUT;

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    titleBarStyle: "default",
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  if (process.platform === "darwin") {
    const template = [
      {
        label: app.getName(),
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideothers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "File",
        submenu: [{ role: "close" }],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectall" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      {
        label: "Window",
        submenu: [{ role: "minimize" }, { role: "close" }],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template as any));
  }
}

app.whenReady().then(() => {
  createWindow();

  // Auto update check after 5 second delay to avoid affecting app startup speed
  setTimeout(() => {
    autoCheckForUpdates().catch((error) => {
      Logger.error("Auto update check failed", error);
    });
  }, 5000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC handlers for captcha and authentication
ipcMain.handle("fetch-captcha", handleFetchCaptcha);

ipcMain.handle(
  "login",
  async (event, credentials: LoginCredentials): Promise<LoginResponse> => {
    const result = await handleLogin(credentials);
    if (result.success && currentSession) {
      // Load user-specific cache after successful login
      loadCacheFromFile(currentSession.username);
    }
    return result;
  }
);

ipcMain.handle("logout", async () => {
  // Save current user's cache before logout
  if (currentSession) {
    saveCacheToFile(currentSession.username);
  }
  await handleLogout();
  clearCache();
});

ipcMain.handle("is-logged-in", handleIsLoggedIn);
ipcMain.handle("validate-stored-session", async () => {
  const isValid = await handleValidateStoredSession();
  if (currentSession) {
    loadCacheFromFile(currentSession.username);
  }
  return isValid;
});
ipcMain.handle("get-current-session", () => getCurrentSession());

// Credential storage handlers
ipcMain.handle("store-credentials", async (event, credentials) => {
  return await handleStoreCredentials(credentials);
});
ipcMain.handle("get-stored-credentials", async (_event) => {
  return await handleGetStoredCredentials();
});

ipcMain.handle("clear-stored-credentials", async () => {
  try {
    const credentialsPath = getCredentialsPath();
    await fs.promises.unlink(credentialsPath);
  } catch (error) {
    // File doesn't exist, which is fine
  }
});

// Course platform API handlers
ipcMain.handle("get-semester-info", async () => {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  return requestQueue.add(async () => {
    const url = `${API_CONFIG.BASE_URL}/back/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
    const data = await authenticatedRequest(url);

    if (data.result && data.result.length > 0) {
      return data.result[0].xqCode;
    }
    throw new Error("Failed to get semester info");
  });
});

// Track ongoing refresh operations to prevent duplicate requests
const ongoingRefreshes = new Set<string>();

// Background refresh function with retry logic
async function refreshCacheInBackground(
  cacheKey: string,
  refreshFunction: () => Promise<any>,
  retries = 2
) {
  // Prevent duplicate refreshes for the same cache key
  if (ongoingRefreshes.has(cacheKey)) {
    return;
  }

  ongoingRefreshes.add(cacheKey);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const freshData = await refreshFunction();
      setCachedData(cacheKey, freshData);
      saveCacheToFile(currentSession?.username);

      // Notify renderer of updated data
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        window.webContents.send("cache-updated", {
          key: cacheKey,
          data: freshData,
        });
      });

      return; // Success, exit retry loop
    } catch (error) {
      lastError = error as Error;
      console.error(
        `Background refresh attempt ${attempt + 1} failed for ${cacheKey}:`,
        error
      );

      if (attempt < retries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`All refresh attempts failed for ${cacheKey}:`, lastError);
  ongoingRefreshes.delete(cacheKey);
}

ipcMain.handle(
  "get-courses",
  async (event, options?: { skipCache?: boolean }) => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    const cacheKey = "courses";
    const _now = Date.now();

    // If skipCache is requested, fetch fresh data immediately
    if (options?.skipCache) {
      return requestQueue.add(async () => {
        const courseList = await fetchCourseList();
        // Update cache with fresh data
        setCachedData(cacheKey, courseList);
        saveCacheToFile(currentSession?.username);
        return { data: courseList, fromCache: false, age: 0 };
      });
    }

    // Always return cached data immediately if available
    const cachedData = getCachedData(cacheKey, COURSE_CACHE_DURATION);

    // Start background refresh if cache is stale or doesn't exist
    if (!cachedData) {
      refreshCacheInBackground(cacheKey, async () => {
        return requestQueue.add(async () => {
          return await fetchCourseList();
        });
      });
    }

    // Return cached data if available, otherwise wait for fresh data
    if (cachedData) {
      return { data: cachedData, fromCache: true, age: 0 };
    } else {
      // No cache, wait for fresh data
      return requestQueue.add(async () => {
        const courseList = await fetchCourseList();
        setCachedData(cacheKey, courseList);
        saveCacheToFile(currentSession?.username);
        return { data: courseList, fromCache: false, age: 0 };
      });
    }
  }
);

ipcMain.handle("refresh-courses", async () => {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  return requestQueue.add(async () => {
    const courseList = await fetchCourseList();
    setCachedData("courses", courseList);
    saveCacheToFile(currentSession?.username);
    return { data: courseList, fromCache: false, age: 0 };
  });
});

ipcMain.handle(
  "get-homework",
  async (event, courseId?: string, options?: { skipCache?: boolean }) => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    const cacheKey = courseId ? `homework_${courseId}` : "all_homework";

    // If skipCache is requested, fetch fresh data immediately
    if (options?.skipCache) {
      return requestQueue.add(async () => {
        const data = await fetchHomeworkData(courseId);
        setCachedData(cacheKey, data);
        saveCacheToFile(currentSession?.username);
        return { data, fromCache: false, age: 0 };
      });
    }

    const cachedData = getCachedData(cacheKey, CACHE_DURATION);
    const cacheTimestamp = getCacheTimestamp(cacheKey);
    const age = Date.now() - cacheTimestamp;

    // If we have cached data, return it immediately without background refresh
    if (cachedData) {
      return { data: cachedData, fromCache: true, age };
    }

    // No cache, fetch fresh data
    return requestQueue.add(async () => {
      const data = await fetchHomeworkData(courseId);
      setCachedData(cacheKey, data);
      saveCacheToFile(currentSession?.username);
      return { data, fromCache: false, age: 0 };
    });
  }
);

ipcMain.handle("refresh-homework", async (event, courseId?: string) => {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  const cacheKey = courseId ? `homework_${courseId}` : "all_homework";

  return requestQueue.add(async () => {
    const data = await fetchHomeworkData(courseId);
    setCachedData(cacheKey, data);
    saveCacheToFile(currentSession?.username);
    return { data, fromCache: false, age: 0 };
  });
});

// Streaming homework handlers
ipcMain.handle("stream-homework", async (event, courseId?: string) => {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  const cacheKey = courseId ? `homework_${courseId}` : "all_homework";

  // Check cache first - if we have recent data, return it immediately
  const cachedData = getCachedData(cacheKey, CACHE_DURATION);
  if (cachedData) {
    // Send cached data immediately
    event.sender.send("homework-stream-chunk", {
      homework: cachedData,
      courseId: courseId || null,
      courseName: "Cached Data",
      type: "cached",
      isComplete: true,
      fromCache: true
    });

    return { data: cachedData, fromCache: true, age: 0 };
  }

  // No cache or expired - start streaming
  try {
    const generator = fetchHomeworkStreaming(courseId, (progress) => {
      // Send progress updates
      event.sender.send("homework-stream-progress", progress);
    });

    for await (const chunk of generator) {
      // Send each chunk as it arrives
      event.sender.send("homework-stream-chunk", {
        ...chunk,
        fromCache: false
      });
    }

    // Send completion signal
    event.sender.send("homework-stream-complete", { courseId });

    // Return final cached data
    const finalData = getCachedData(cacheKey, CACHE_DURATION);
    return { data: finalData || [], fromCache: false, age: 0 };

  } catch (error) {
    event.sender.send("homework-stream-error", {
      error: error instanceof Error ? error.message : "Streaming failed"
    });
    throw error;
  }
});

// Fetch homework details
ipcMain.handle(
  "get-homework-details",
  async (event, homeworkId: string, courseId: string, teacherId: string) => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    return requestQueue.add(async () => {
      try {
        const data = await fetchHomeworkDetails(
          homeworkId,
          courseId,
          teacherId
        );
        return { data, success: true };
      } catch (error) {
        console.error("Failed to fetch homework details:", error);
        throw error;
      }
    });
  }
);

// Download homework attachment
ipcMain.handle(
  "download-homework-attachment",
  async (event, attachmentUrl: string, fileName: string) => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    try {
      const fullUrl = attachmentUrl.startsWith("/")
        ? `${API_CONFIG.DOCS_BASE_URL}${attachmentUrl}`
        : attachmentUrl;

      console.log("Downloading homework attachment from URL:", fullUrl);

      // First, check the file size with a HEAD request
      const headResponse = await axios.head(fullUrl, {
        headers: {
          Cookie: captchaSession?.cookies.join("; ") || "",
          "User-Agent": API_CONFIG.USER_AGENT,
        },
        timeout: 10000,
      });

      const contentLength = parseInt(
        headResponse.headers["content-length"] || "0"
      );
      const maxFileSize = 50 * 1024 * 1024; // 50MB limit

      if (contentLength > maxFileSize) {
        return {
          success: false,
          error: `File too large: ${(contentLength / (1024 * 1024)).toFixed(
            1
          )}MB. Maximum allowed: ${maxFileSize / (1024 * 1024)}MB`,
        };
      }

      // For small files (<= 10MB), download directly
      if (contentLength <= 10 * 1024 * 1024) {
        const response = await axios.get(fullUrl, {
          responseType: "arraybuffer",
          headers: {
            Cookie: captchaSession?.cookies.join("; ") || "",
            "User-Agent": API_CONFIG.USER_AGENT,
          },
          timeout: 60000,
        });

        // Convert to base64 for transfer to renderer
        const buffer = Buffer.from(response.data);
        const base64 = buffer.toString("base64");
        const contentType =
          response.headers["content-type"] || "application/octet-stream";

        return {
          success: true,
          data: base64,
          contentType,
          fileName,
          fileSize: contentLength,
        };
      } else {
        // For larger files, use the Electron dialog to save directly to disk
        const { dialog } = await import("electron");

        const result = await dialog.showSaveDialog({
          defaultPath: fileName,
          filters: [{ name: "All Files", extensions: ["*"] }],
        });

        if (result.canceled || !result.filePath) {
          return {
            success: false,
            error: "Download canceled by user",
          };
        }

        // Stream download directly to file
        const fs = await import("fs");
        const response = await axios.get(fullUrl, {
          responseType: "stream",
          headers: {
            Cookie: captchaSession?.cookies.join("; ") || "",
            "User-Agent": API_CONFIG.USER_AGENT,
          },
          timeout: 120000, // 2 minute timeout for large files
        });

        const writer = fs.createWriteStream(result.filePath);
        response.data.pipe(writer);

        return new Promise((resolve) => {
          writer.on("finish", () => {
            resolve({
              success: true,
              savedToFile: true,
              filePath: result.filePath,
              fileName,
              fileSize: contentLength,
            });
          });

          writer.on("error", (error) => {
            resolve({
              success: false,
              error: `Failed to save file: ${error.message}`,
            });
          });
        });
      }
    } catch (error) {
      console.error("Failed to download homework attachment:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Download failed",
      };
    }
  }
);

// Fetch course image as base64 data URL
ipcMain.handle(
  "fetch-course-image",
  async (event, imagePath: string): Promise<string | null> => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    if (!imagePath) {
      return null;
    }

    try {
      // If imagePath starts with /, it's a relative path from the server
      const imageUrl = imagePath.startsWith("/")
        ? `${API_CONFIG.DOCS_BASE_URL}${imagePath}`
        : imagePath;

      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        headers: {
          Cookie: captchaSession?.cookies.join("; ") || "",
          "User-Agent": API_CONFIG.USER_AGENT,
        },
        timeout: 10000, // 10 second timeout for images
      });

      // Convert to base64 data URL
      const buffer = Buffer.from(response.data);
      const contentType = response.headers["content-type"] || "image/jpeg";
      const base64 = buffer.toString("base64");
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      console.error("Failed to fetch course image:", error);
      return null;
    }
  }
);

// Fetch course documents
ipcMain.handle(
  "get-course-documents",
  async (event, courseCode: string, options?: { skipCache?: boolean }) => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    const cacheKey = `documents_${courseCode}`;
    const cachedData = getCachedData(cacheKey, CACHE_DURATION);

    // Use cached data if available and not expired (unless skipCache is true)
    if (!options?.skipCache && cachedData) {
      return { data: cachedData, fromCache: true, age: 0 };
    }

    return requestQueue.add(async () => {
      try {
        const sanitizedDocuments = await fetchCourseDocuments(courseCode);

        // Update cache with sanitized data
        setCachedData(cacheKey, sanitizedDocuments);
        saveCacheToFile(currentSession?.username);

        return { data: sanitizedDocuments, fromCache: false, age: 0 };
      } catch (error) {
        console.error("Failed to fetch course documents:", error);
        throw error;
      }
    });
  }
);

// Download course document with size limit and streaming
ipcMain.handle(
  "download-course-document",
  async (event, documentUrl: string, fileName: string) => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    try {
      const fullUrl = documentUrl.startsWith("/")
        ? `${API_CONFIG.DOCS_BASE_URL}${documentUrl}`
        : documentUrl;

      console.log("Downloading document from URL:", fullUrl);

      // First, check the file size with a HEAD request
      const headResponse = await axios.head(fullUrl, {
        headers: {
          Cookie: captchaSession?.cookies.join("; ") || "",
          "User-Agent": API_CONFIG.USER_AGENT,
        },
        timeout: 10000,
      });

      const contentLength = parseInt(
        headResponse.headers["content-length"] || "0"
      );
      const maxFileSize = 50 * 1024 * 1024; // 50MB limit

      if (contentLength > maxFileSize) {
        return {
          success: false,
          error: `File too large: ${(contentLength / (1024 * 1024)).toFixed(
            1
          )}MB. Maximum allowed: ${maxFileSize / (1024 * 1024)}MB`,
        };
      }

      // For small files (<= 10MB), download directly
      if (contentLength <= 10 * 1024 * 1024) {
        const response = await axios.get(fullUrl, {
          responseType: "arraybuffer",
          headers: {
            Cookie: captchaSession?.cookies.join("; ") || "",
            "User-Agent": API_CONFIG.USER_AGENT,
          },
          timeout: 60000,
        });

        // Convert to base64 for transfer to renderer
        const buffer = Buffer.from(response.data);
        const base64 = buffer.toString("base64");
        const contentType =
          response.headers["content-type"] || "application/octet-stream";

        return {
          success: true,
          data: base64,
          contentType,
          fileName,
          fileSize: contentLength,
        };
      } else {
        // For larger files, use the Electron dialog to save directly to disk
        const { dialog } = await import("electron");
        const _path = await import("path");

        const result = await dialog.showSaveDialog({
          defaultPath: fileName,
          filters: [{ name: "All Files", extensions: ["*"] }],
        });

        if (result.canceled || !result.filePath) {
          return {
            success: false,
            error: "Download canceled by user",
          };
        }

        // Stream download directly to file
        const fs = await import("fs");
        const response = await axios.get(fullUrl, {
          responseType: "stream",
          headers: {
            Cookie: captchaSession?.cookies.join("; ") || "",
            "User-Agent": API_CONFIG.USER_AGENT,
          },
          timeout: 120000, // 2 minute timeout for large files
        });

        const writer = fs.createWriteStream(result.filePath);
        response.data.pipe(writer);

        return new Promise((resolve) => {
          writer.on("finish", () => {
            resolve({
              success: true,
              savedToFile: true,
              filePath: result.filePath,
              fileName,
              fileSize: contentLength,
            });
          });

          writer.on("error", (error) => {
            resolve({
              success: false,
              error: `Failed to save file: ${error.message}`,
            });
          });
        });
      }
    } catch (error) {
      console.error("Failed to download document:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Download failed",
      };
    }
  }
);

// Schedule handlers
ipcMain.handle(
  "get-schedule",
  async (event, options?: { skipCache?: boolean }) => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    const cacheKey = "schedule";

    // If skipCache is requested, fetch fresh data immediately
    if (options?.skipCache) {
      return requestQueue.add(async () => {
        const scheduleData = await fetchScheduleData(true);
        // Update cache with fresh data
        setCachedData(cacheKey, scheduleData);
        saveCacheToFile(currentSession?.username);
        return scheduleData;
      });
    }

    // Always return cached data immediately if available
    const cachedData = getCachedData(cacheKey, COURSE_CACHE_DURATION);

    // Start background refresh if cache is stale or doesn't exist
    if (!cachedData) {
      refreshCacheInBackground(cacheKey, async () => {
        return requestQueue.add(async () => {
          return await fetchScheduleData(false);
        });
      });
    }

    // Return cached data if available, otherwise wait for fresh data
    if (cachedData) {
      return cachedData;
    } else {
      // No cache, wait for fresh data
      return requestQueue.add(async () => {
        const scheduleData = await fetchScheduleData(false);
        setCachedData(cacheKey, scheduleData);
        saveCacheToFile(currentSession?.username);
        return scheduleData;
      });
    }
  }
);

ipcMain.handle("refresh-schedule", async () => {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  return requestQueue.add(async () => {
    const scheduleData = await fetchScheduleData(true);
    setCachedData("schedule", scheduleData);
    saveCacheToFile(currentSession?.username);
    return scheduleData;
  });
});

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

export function notifyRendererAboutUpdate(updateInfo: UpdateInfo) {
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach((window) => {
    window.webContents.send("update-available", updateInfo);
  });
}
