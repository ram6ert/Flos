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

// Active request tracking to prevent race conditions
const activeRequests = new Map<string, string>(); // requestKey -> responseId
const generateResponseId = () => `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

      const { forceRefresh = false, requestId } = options;
      const requestKey = courseId || 'all_documents';
      // Use the requestId passed from renderer, or generate one if not provided
      const responseId = requestId || generateResponseId();

      // Check for existing request and cancel it
      if (activeRequests.has(requestKey)) {
        console.log(`Cancelling previous document request for ${requestKey}`);
      }
      activeRequests.set(requestKey, responseId);

      const cacheKey = courseId
        ? `documents_${currentSession.username}_${courseId}`
        : `all_documents_${currentSession.username}`;

      // Check cache first - if we have recent data and not forcing refresh, return it immediately
      if (!forceRefresh) {
        const cachedData = cachedDocuments.get(cacheKey);
        if (cachedData) {
          // Only send if this is still the current request
          if (activeRequests.get(requestKey) === responseId) {
            // Send cached data immediately
            event.sender.send("document-stream-chunk", {
              documents: cachedData,
              courseId: courseId,
              courseName: "Cached Data",
              type: "cached",
              fromCache: true,
              responseId,
            });

            event.sender.send("document-stream-complete", { courseId, responseId });
            activeRequests.delete(requestKey);
          }
          return { data: cachedData, fromCache: true, age: 0 };
        }
      }

      // No cache, expired, or forced refresh - start streaming
      try {
        const generator = fetchDocumentsStreaming(courseId, (progress) => {
          // Only send progress if this is still the current request
          if (activeRequests.get(requestKey) === responseId) {
            event.sender.send("document-stream-progress", { ...progress, responseId });
          }
        });

        let finalData: CourseDocument[] = [];
        for await (const chunk of generator) {
          // Only send chunk if this is still the current request
          if (activeRequests.get(requestKey) === responseId) {
            event.sender.send("document-stream-chunk", {
              ...chunk,
              fromCache: false,
              responseId,
            });
            finalData = finalData.concat(chunk.documents);
          } else {
            // Request was cancelled, stop streaming
            console.log(`Document streaming cancelled for ${requestKey}`);
            break;
          }
        }

        // Only complete if this is still the current request
        if (activeRequests.get(requestKey) === responseId) {
          event.sender.send("document-stream-complete", { courseId, responseId });
          cachedDocuments.set(cacheKey, finalData);
          activeRequests.delete(requestKey);
        }

        return { data: finalData || [], fromCache: false, age: 0 };
      } catch (error) {
        // Only send error if this is still the current request
        if (activeRequests.get(requestKey) === responseId) {
          event.sender.send("document-stream-error", {
            error: error instanceof Error ? error.message : "Streaming failed",
            responseId,
          });
          activeRequests.delete(requestKey);
        }
        throw error;
      }
    }
  );

  // Refresh documents using streaming
  ipcMain.handle("refresh-documents", async (event, courseId?: string) => {
    if (!currentSession) {
      await handleSessionExpired();
      throw new Error("SESSION_EXPIRED");
    }

    const requestKey = courseId || 'all_documents';
    const responseId = generateResponseId();

    // Cancel any existing request
    if (activeRequests.has(requestKey)) {
      console.log(`Cancelling previous document refresh for ${requestKey}`);
    }
    activeRequests.set(requestKey, responseId);

    const cacheKey = courseId
      ? `documents_${currentSession.username}_${courseId}`
      : "all_documents";

    // Signal renderer to clear display and start streaming fresh data
    try {
      // Signal renderer to clear display
      event.sender.send("document-refresh-start", { courseId, responseId });

      const generator = fetchDocumentsStreaming(
        courseId,
        (progress) => {
          // Only send progress if this is still the current request
          if (activeRequests.get(requestKey) === responseId) {
            event.sender.send("document-stream-progress", { ...progress, responseId });
          }
        },
        false
      ); // false = allow caching of the fresh data

      let finalData: CourseDocument[] = [];
      for await (const chunk of generator) {
        // Only send chunk if this is still the current request
        if (activeRequests.get(requestKey) === responseId) {
          event.sender.send("document-stream-chunk", {
            ...chunk,
            fromCache: false,
            responseId,
          });
          finalData = finalData.concat(chunk.documents);
        } else {
          // Request was cancelled
          console.log(`Document refresh cancelled for ${requestKey}`);
          break;
        }
      }

      // Only complete if this is still the current request
      if (activeRequests.get(requestKey) === responseId) {
        event.sender.send("document-stream-complete", { courseId, responseId });
        cachedDocuments.set(cacheKey, finalData);
        activeRequests.delete(requestKey);
      }

      return { data: finalData, fromCache: false, age: 0 };
    } catch (error) {
      // Only send error if this is still the current request
      if (activeRequests.get(requestKey) === responseId) {
        event.sender.send("document-stream-error", {
          error: error instanceof Error ? error.message : "Streaming failed",
          responseId,
        });
        activeRequests.delete(requestKey);
      }
      throw error;
    }
  });

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

  // Download course document with size limit and streaming
  ipcMain.handle(
    "download-course-document",
    async (event, documentUrl: string, fileName: string) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

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
              ...APP_CONFIG.HEADERS,
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
              ...APP_CONFIG.HEADERS,
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
