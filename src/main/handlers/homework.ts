import { ipcMain } from "electron";
import axios from "axios";
import { currentSession, captchaSession } from "../auth";
import {
  getCachedData,
  setCachedData,
  saveCacheToFile,
  getCacheTimestamp,
  CACHE_DURATION,
} from "../cache";
import {
  requestQueue,
  fetchHomeworkData,
  fetchHomeworkStreaming,
  fetchHomeworkDetails,
} from "../api";
import { API_CONFIG } from "../constants";

export function setupHomeworkHandlers() {
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

    // Clear existing cache for this key
    setCachedData(cacheKey, null);

    // Signal renderer to clear display and start streaming fresh data
    try {
      // Signal renderer to clear display
      event.sender.send("homework-refresh-start", { courseId });

      const generator = fetchHomeworkStreaming(
        courseId,
        (progress) => {
          // Send progress updates
          event.sender.send("homework-stream-progress", progress);
        },
        false
      ); // false = allow caching of the fresh data

      for await (const chunk of generator) {
        // Send each chunk as it arrives
        event.sender.send("homework-stream-chunk", {
          ...chunk,
          fromCache: false,
        });
      }

      // Send completion signal
      event.sender.send("homework-stream-complete", { courseId });

      return { data: [], fromCache: false, age: 0 };
    } catch (error) {
      event.sender.send("homework-stream-error", {
        error: error instanceof Error ? error.message : "Streaming failed",
      });
      throw error;
    }
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
        fromCache: true,
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
          fromCache: false,
        });
      }

      // Send completion signal
      event.sender.send("homework-stream-complete", { courseId });

      // Return final cached data
      const finalData = getCachedData(cacheKey, CACHE_DURATION);
      return { data: finalData || [], fromCache: false, age: 0 };
    } catch (error) {
      event.sender.send("homework-stream-error", {
        error: error instanceof Error ? error.message : "Streaming failed",
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
}