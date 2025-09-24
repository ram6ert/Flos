import { ipcMain } from "electron";
import axios from "axios";
import { currentSession, captchaSession } from "../auth";
import {
  getCachedData,
  setCachedData,
  saveCacheToFile,
  CACHE_DURATION,
} from "../cache";
import {
  requestQueue,
  fetchCourseDocuments,
  fetchDocumentsStreaming,
} from "../api";
import { API_CONFIG } from "../constants";

export function setupDocumentHandlers() {
  // Streaming document handlers
  ipcMain.handle(
    "stream-documents",
    async (event, courseId?: string, options = {}) => {
      if (!currentSession) {
        throw new Error("Not logged in");
      }

      const { forceRefresh = false } = options;
      const cacheKey = courseId ? `documents_${courseId}` : "all_documents";

      // Check cache first - if we have recent data and not forcing refresh, return it immediately
      if (!forceRefresh) {
        const cachedData = getCachedData(cacheKey, CACHE_DURATION);
        if (cachedData) {
          // Send cached data immediately
          event.sender.send("document-stream-chunk", {
            documents: cachedData,
            courseId: courseId,
            courseName: "Cached Data",
            type: "cached",
            isComplete: true,
            fromCache: true,
          });

          return { data: cachedData, fromCache: true, age: 0 };
        }
      }

      // No cache, expired, or forced refresh - start streaming
      try {
        const generator = fetchDocumentsStreaming(courseId, (progress) => {
          // Send progress updates
          event.sender.send("document-stream-progress", progress);
        });

        for await (const chunk of generator) {
          // Send each chunk as it arrives
          event.sender.send("document-stream-chunk", {
            ...chunk,
            fromCache: false,
          });
        }

        // Send completion signal
        event.sender.send("document-stream-complete", { courseId });

        // Return final cached data
        const finalData = getCachedData(cacheKey, CACHE_DURATION);
        return { data: finalData || [], fromCache: false, age: 0 };
      } catch (error) {
        event.sender.send("document-stream-error", {
          error: error instanceof Error ? error.message : "Streaming failed",
        });
        throw error;
      }
    }
  );

  // Refresh documents using streaming
  ipcMain.handle("refresh-documents", async (event, courseId?: string) => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    const cacheKey = courseId ? `documents_${courseId}` : "all_documents";

    // Clear existing cache for this key
    setCachedData(cacheKey, null);

    // Signal renderer to clear display and start streaming fresh data
    try {
      // Signal renderer to clear display
      event.sender.send("document-refresh-start", { courseId });

      const generator = fetchDocumentsStreaming(
        courseId,
        (progress) => {
          // Send progress updates
          event.sender.send("document-stream-progress", progress);
        },
        false
      ); // false = allow caching of the fresh data

      for await (const chunk of generator) {
        // Send each chunk as it arrives
        event.sender.send("document-stream-chunk", {
          ...chunk,
          fromCache: false,
        });
      }

      // Send completion signal
      event.sender.send("document-stream-complete", { courseId });

      return { data: [], fromCache: false, age: 0 };
    } catch (error) {
      event.sender.send("document-stream-error", {
        error: error instanceof Error ? error.message : "Streaming failed",
      });
      throw error;
    }
  });

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
}