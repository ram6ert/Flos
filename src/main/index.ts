import { app, BrowserWindow, Menu, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import axios from "axios";
import { LoginCredentials, LoginResponse } from "./types";
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
  fetchHomeworkDetails,
  fetchScheduleData,
} from "./api";

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

// Initialize cache on startup
loadCacheFromFile();

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
ipcMain.handle("validate-stored-session", handleValidateStoredSession);
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

    // If we have cached data, return it immediately
    if (cachedData) {
      // Only start background refresh if cache is getting stale (older than 10 minutes)
      const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes
      if (age > STALE_THRESHOLD) {
        refreshCacheInBackground(cacheKey, async () => {
          return await requestQueue.add(async () => {
            return await fetchHomeworkData(courseId);
          });
        });
      }
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
    const _now = Date.now();
    const cachedData = getCachedData(cacheKey, CACHE_DURATION);

    // Use cached data if available and not expired (unless skipCache is true)
    if (!options?.skipCache && cachedData) {
      return { data: cachedData, fromCache: true, age: 0 };
    }

    return requestQueue.add(async () => {
      try {
        // Get semester info first to get xqCode
        const semesterUrl = `${API_CONFIG.BASE_URL}/back/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
        const semesterData = await authenticatedRequest(semesterUrl);

        if (!semesterData.result || semesterData.result.length === 0) {
          throw new Error("Failed to get semester info");
        }

        const xqCode = semesterData.result[0].xqCode;

        // Get course list to find the full course details
        const courseList = await fetchCourseList();
        const course = courseList.find((c: any) => c.course_num === courseCode);

        if (!course) {
          throw new Error(`Course not found: ${courseCode}`);
        }

        // Construct xkhId using course information
        const xkhId = course.fz_id || `${xqCode}-${courseCode}`;

        // Construct the course documents URL
        const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/courseResource.shtml?method=stuQueryUploadResourceForCourseList&courseId=${courseCode}&cId=${courseCode}&xkhId=${xkhId}&xqCode=${xqCode}&docType=1&up_id=0&searchName=`;

        const data = await authenticatedRequest(url, true); // Use session ID

        if (data) {
          if (Array.isArray(data.resList)) {
            // Update cache
            setCachedData(cacheKey, data.resList);
            saveCacheToFile(currentSession?.username);
            return { data: data.resList, fromCache: false, age: 0 };
          } else {
            return { data: [], fromCache: false, age: 0 }; // No documents
          }
        }

        throw new Error(
          `Invalid response format. Expected 'resList' property but got: ${Object.keys(
            data || {}
          ).join(", ")}`
        );
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
        const scheduleData = await fetchScheduleData("2021112401", true);
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
          return await fetchScheduleData("2021112401", false);
        });
      });
    }

    // Return cached data if available, otherwise wait for fresh data
    if (cachedData) {
      return cachedData;
    } else {
      // No cache, wait for fresh data
      return requestQueue.add(async () => {
        const scheduleData = await fetchScheduleData("2021112401", false);
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
    const scheduleData = await fetchScheduleData("2021112401", true);
    setCachedData("schedule", scheduleData);
    saveCacheToFile(currentSession?.username);
    return scheduleData;
  });
});
