import { ipcMain } from "electron";
import axios from "axios";
import { currentSession, captchaSession, handleSessionExpired } from "../auth";
import {
  requestQueue,
  fetchCourseDocuments,
  fetchDocumentsStreaming,
} from "../api";
import { API_CONFIG as APP_CONFIG } from "../constants";
import NodeCache from "node-cache";
import { CourseDocument } from "../../shared/types";

const CACHE_TTL = 30 * 60;

// Download task tracking
interface DownloadTask {
  id: string;
  fileName: string;
  status: "pending" | "downloading" | "completed" | "failed";
  progress: number;
  totalSize: number;
  downloadedSize: number;
  error?: string;
  filePath?: string;
}

const downloadTasks: Map<string, DownloadTask> = new Map();

// Active request tracking to prevent race conditions
const generateResponseId = () =>
  `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const cachedDocuments = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: CACHE_TTL / 2,
});
export function setupDocumentHandlers() {
  // Streaming document handlers
  ipcMain.handle(
    "stream-documents",
    async (event, courseId?: string, options = {}) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const { requestId } = options;
      // Use the requestId passed from renderer, or generate one if not provided
      const responseId = requestId || generateResponseId();

      const cacheKey = courseId
        ? `documents_${currentSession.username}_${courseId}`
        : `all_documents_${currentSession.username}`;

      // Check cache first - if we have recent data, return it immediately
      const cachedData = cachedDocuments.get(cacheKey);
      if (cachedData) {
        // Only send if this is still the current request
        event.sender.send("document-stream-chunk", {
          documents: cachedData,
          courseId: courseId,
          courseName: "Cached Data",
          type: "cached",
          fromCache: true,
          responseId,
        });

        event.sender.send("document-stream-complete", {
          courseId,
          responseId,
        });
        return { data: cachedData, fromCache: true, age: 0 };
      }

      // No cache, expired, or forced refresh - start streaming
      try {
        const generator = fetchDocumentsStreaming(courseId, (progress) => {
          event.sender.send("document-stream-progress", {
            ...progress,
            responseId,
          });
        });

        let finalData: CourseDocument[] = [];
        for await (const chunk of generator) {
          event.sender.send("document-stream-chunk", {
            ...chunk,
            fromCache: false,
            responseId,
          });
          finalData = finalData.concat(chunk.documents);
        }

        event.sender.send("document-stream-complete", {
          courseId,
          responseId,
        });

        cachedDocuments.set(cacheKey, finalData);
        return { data: finalData || [], fromCache: false, age: 0 };
      } catch (error) {
        event.sender.send("document-stream-error", {
          error: error instanceof Error ? error.message : "Streaming failed",
          responseId,
        });
        throw error;
      }
    }
  );

  // Refresh documents using streaming
  ipcMain.handle(
    "refresh-documents",
    async (event, courseId?: string, options = {}) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const { requestId } = options;
      const responseId = requestId || generateResponseId();

      const cacheKey = courseId
        ? `documents_${currentSession.username}_${courseId}`
        : "all_documents";

      // Signal renderer to clear display and start streaming fresh data
      try {
        // Signal renderer to clear display
        event.sender.send("document-refresh-start", { courseId, responseId });

        const generator = fetchDocumentsStreaming(courseId, (progress) => {
          event.sender.send("document-stream-progress", {
            ...progress,
            responseId,
          });
        }); // false = allow caching of the fresh data

        let finalData: CourseDocument[] = [];
        for await (const chunk of generator) {
          event.sender.send("document-stream-chunk", {
            ...chunk,
            fromCache: false,
            responseId,
          });
          finalData = finalData.concat(chunk.documents);
        }

        event.sender.send("document-stream-complete", {
          courseId,
          responseId,
        });

        cachedDocuments.set(cacheKey, finalData);
        return { data: finalData, fromCache: false, age: 0 };
      } catch (error) {
        event.sender.send("document-stream-error", {
          error: error instanceof Error ? error.message : "Streaming failed",
          responseId,
        });
        throw error;
      }
    }
  );

  // Fetch course image as base64 data URL
  ipcMain.handle(
    "fetch-course-image",
    async (event, imagePath: string): Promise<string | null> => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      if (!imagePath) {
        return null;
      }

      try {
        // If imagePath starts with /, it's a relative path from the server
        const imageUrl = imagePath.startsWith("/")
          ? `${APP_CONFIG.BASE_URL}${imagePath}`
          : imagePath;

        // so we use axios
        const response = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          headers: {
            Cookie: captchaSession?.cookies.join("; ") || "",
            ...APP_CONFIG.HEADERS,
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
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const cacheKey = `documents_${currentSession.username}_${courseCode}`;
      const cachedData = cachedDocuments.get(cacheKey);

      // Use cached data if available and not expired (unless skipCache is true)
      if (!options?.skipCache && cachedData) {
        return { data: cachedData, fromCache: true, age: 0 };
      }

      return requestQueue.add(async () => {
        try {
          const sanitizedDocuments = await fetchCourseDocuments(courseCode);

          // Update cache with sanitized data
          cachedDocuments.set(cacheKey, sanitizedDocuments);

          return { data: sanitizedDocuments, fromCache: false, age: 0 };
        } catch (error) {
          console.error("Failed to fetch course documents:", error);
          throw error;
        }
      });
    }
  );

  // Download course document with progress tracking
  ipcMain.handle(
    "download-course-document",
    async (event, documentUrl: string, fileName: string, taskId?: string) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const downloadId = taskId || `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        const fullUrl = documentUrl.startsWith("/")
          ? `${APP_CONFIG.BASE_URL}${documentUrl}`
          : documentUrl;

        console.log("Downloading document from URL:", fullUrl);

        // First, check the file size with a HEAD request
        const headResponse = await axios.head(fullUrl, {
          headers: {
            Cookie: captchaSession?.cookies.join("; ") || "",
            ...APP_CONFIG.HEADERS,
          },
          timeout: 10000,
        });

        const contentLength = parseInt(
          headResponse.headers["content-length"] || "0"
        );

        // Create download task
        const task: DownloadTask = {
          id: downloadId,
          fileName,
          status: "downloading",
          progress: 0,
          totalSize: contentLength,
          downloadedSize: 0,
        };
        downloadTasks.set(downloadId, task);
        event.sender.send("download-task-update", task);

        // For small files (<= 10MB), download directly
        if (contentLength <= 10 * 1024 * 1024) {
          const response = await axios.get(fullUrl, {
            responseType: "arraybuffer",
            headers: {
              Cookie: captchaSession?.cookies.join("; ") || "",
              ...APP_CONFIG.HEADERS,
            },
            timeout: 60000,
            onDownloadProgress: (progressEvent) => {
              const downloaded = progressEvent.loaded;
              const total = progressEvent.total || contentLength;
              const progress = Math.round((downloaded / total) * 100);
              
              task.downloadedSize = downloaded;
              task.progress = progress;
              downloadTasks.set(downloadId, task);
              event.sender.send("download-task-update", task);
            },
          });

          // Convert to base64 for transfer to renderer
          const buffer = Buffer.from(response.data);
          const base64 = buffer.toString("base64");
          const contentType =
            response.headers["content-type"] || "application/octet-stream";

          task.status = "completed";
          task.progress = 100;
          downloadTasks.set(downloadId, task);
          event.sender.send("download-task-update", task);

          return {
            success: true,
            data: base64,
            contentType,
            fileName,
            fileSize: contentLength,
            taskId: downloadId,
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
            task.status = "failed";
            task.error = "Download canceled by user";
            downloadTasks.set(downloadId, task);
            event.sender.send("download-task-update", task);
            
            return {
              success: false,
              error: "Download canceled by user",
              taskId: downloadId,
            };
          }

          // Stream download directly to file
          const fs = await import("fs");
          const response = await axios.get(fullUrl, {
            responseType: "stream",
            headers: {
              Cookie: captchaSession?.cookies.join("; ") || "",
              ...APP_CONFIG.HEADERS,
            },
            timeout: 120000, // 2 minute timeout for large files
            onDownloadProgress: (progressEvent) => {
              const downloaded = progressEvent.loaded;
              const total = progressEvent.total || contentLength;
              const progress = Math.round((downloaded / total) * 100);
              
              task.downloadedSize = downloaded;
              task.progress = progress;
              downloadTasks.set(downloadId, task);
              event.sender.send("download-task-update", task);
            },
          });

          const writer = fs.createWriteStream(result.filePath);
          response.data.pipe(writer);

          return new Promise((resolve) => {
            writer.on("finish", () => {
              task.status = "completed";
              task.progress = 100;
              task.filePath = result.filePath;
              downloadTasks.set(downloadId, task);
              event.sender.send("download-task-update", task);

              resolve({
                success: true,
                savedToFile: true,
                filePath: result.filePath,
                fileName,
                fileSize: contentLength,
                taskId: downloadId,
              });
            });

            writer.on("error", (error) => {
              task.status = "failed";
              task.error = error.message;
              downloadTasks.set(downloadId, task);
              event.sender.send("download-task-update", task);

              resolve({
                success: false,
                error: `Failed to save file: ${error.message}`,
                taskId: downloadId,
              });
            });
          });
        }
      } catch (error) {
        console.error("Failed to download document:", error);
        
        const task = downloadTasks.get(downloadId);
        if (task) {
          task.status = "failed";
          task.error = error instanceof Error ? error.message : "Download failed";
          downloadTasks.set(downloadId, task);
          event.sender.send("download-task-update", task);
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : "Download failed",
          taskId: downloadId,
        };
      }
    }
  );

  // Batch download documents
  ipcMain.handle(
    "batch-download-documents",
    async (event, documents: Array<{ url: string; fileName: string; fileExtension: string }>) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const { dialog } = await import("electron");
      
      // Ask user to select download directory
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Select download directory",
      });

      if (result.canceled || !result.filePaths[0]) {
        return {
          success: false,
          error: "Download canceled by user",
        };
      }

      const downloadDir = result.filePaths[0];
      const batchId = `batch_${Date.now()}`;
      const results = [];

      for (const doc of documents) {
        const taskId = `${batchId}_${doc.fileName}`;
        const fullFileName = `${doc.fileName}.${doc.fileExtension}`;
        const path = await import("path");
        const filePath = path.join(downloadDir, fullFileName);
        
        try {
          const fullUrl = doc.url.startsWith("/")
            ? `${APP_CONFIG.BASE_URL}${doc.url}`
            : doc.url;

          const task: DownloadTask = {
            id: taskId,
            fileName: fullFileName,
            status: "downloading",
            progress: 0,
            totalSize: 0,
            downloadedSize: 0,
          };
          downloadTasks.set(taskId, task);
          event.sender.send("download-task-update", task);

          const response = await axios.get(fullUrl, {
            responseType: "stream",
            headers: {
              Cookie: captchaSession?.cookies.join("; ") || "",
              ...APP_CONFIG.HEADERS,
            },
            timeout: 120000,
            onDownloadProgress: (progressEvent) => {
              const downloaded = progressEvent.loaded;
              const total = progressEvent.total || 0;
              const progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
              
              task.totalSize = total;
              task.downloadedSize = downloaded;
              task.progress = progress;
              downloadTasks.set(taskId, task);
              event.sender.send("download-task-update", task);
            },
          });

          const fs = await import("fs");
          const writer = fs.createWriteStream(filePath);
          response.data.pipe(writer);

          await new Promise<void>((resolve, reject) => {
            writer.on("finish", () => {
              task.status = "completed";
              task.progress = 100;
              task.filePath = filePath;
              downloadTasks.set(taskId, task);
              event.sender.send("download-task-update", task);
              resolve();
            });

            writer.on("error", (error) => {
              task.status = "failed";
              task.error = error.message;
              downloadTasks.set(taskId, task);
              event.sender.send("download-task-update", task);
              reject(error);
            });
          });

          results.push({ fileName: fullFileName, success: true, filePath });
        } catch (error) {
          const task = downloadTasks.get(taskId);
          if (task) {
            task.status = "failed";
            task.error = error instanceof Error ? error.message : "Download failed";
            downloadTasks.set(taskId, task);
            event.sender.send("download-task-update", task);
          }
          
          results.push({
            fileName: fullFileName,
            success: false,
            error: error instanceof Error ? error.message : "Download failed",
          });
        }
      }

      return { batchId, results, downloadDir };
    }
  );

  // Get download tasks status
  ipcMain.handle("get-download-tasks", async () => {
    return Array.from(downloadTasks.values());
  });

  // Clear completed download tasks
  ipcMain.handle("clear-download-tasks", async (event, taskIds?: string[]) => {
    if (taskIds) {
      taskIds.forEach((id) => downloadTasks.delete(id));
    } else {
      // Clear only completed and failed tasks
      for (const [id, task] of downloadTasks.entries()) {
        if (task.status === "completed" || task.status === "failed") {
          downloadTasks.delete(id);
        }
      }
    }
    return true;
  });
}
