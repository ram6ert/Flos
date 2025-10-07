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

      const { requestId, upId = 0 } = options;
      // Use the requestId passed from renderer, or generate one if not provided
      const responseId = requestId || generateResponseId();

      const cacheKey = courseId
        ? `documents_${currentSession.username}_${courseId}_${upId}`
        : `all_documents_${currentSession.username}_${upId}`;

      // Check cache first - if we have recent data, return it immediately
      const cachedData = cachedDocuments.get(cacheKey);
      if (cachedData) {
        // Only send if this is still the current request
        event.sender.send("document-stream-chunk", {
          documents: cachedData.documents || cachedData,
          directories: cachedData.directories || [],
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
        const generator = fetchDocumentsStreaming(
          courseId,
          (progress) => {
            event.sender.send("document-stream-progress", {
              ...progress,
              responseId,
            });
          },
          upId
        );

        let finalDocuments: CourseDocument[] = [];
        let finalDirectories: any[] = [];
        for await (const chunk of generator) {
          event.sender.send("document-stream-chunk", {
            ...chunk,
            fromCache: false,
            responseId,
          });
          finalDocuments = finalDocuments.concat(chunk.documents);
          finalDirectories = finalDirectories.concat(chunk.directories || []);
        }

        event.sender.send("document-stream-complete", {
          courseId,
          responseId,
        });

        const finalData = {
          documents: finalDocuments,
          directories: finalDirectories,
        };
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

  // Refresh documents using streaming
  ipcMain.handle(
    "refresh-documents",
    async (event, courseId?: string, options = {}) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const { requestId, upId = 0 } = options;
      const responseId = requestId || generateResponseId();

      const cacheKey = courseId
        ? `documents_${currentSession.username}_${courseId}_${upId}`
        : `all_documents_${upId}`;

      // Signal renderer to clear display and start streaming fresh data
      try {
        // Signal renderer to clear display
        event.sender.send("document-refresh-start", { courseId, responseId });

        const generator = fetchDocumentsStreaming(
          courseId,
          (progress) => {
            event.sender.send("document-stream-progress", {
              ...progress,
              responseId,
            });
          },
          upId
        ); // false = allow caching of the fresh data

        let finalDocuments: CourseDocument[] = [];
        let finalDirectories: any[] = [];
        for await (const chunk of generator) {
          event.sender.send("document-stream-chunk", {
            ...chunk,
            fromCache: false,
            responseId,
          });
          finalDocuments = finalDocuments.concat(chunk.documents);
          finalDirectories = finalDirectories.concat(chunk.directories || []);
        }

        event.sender.send("document-stream-complete", {
          courseId,
          responseId,
        });

        const finalData = {
          documents: finalDocuments,
          directories: finalDirectories,
        };
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
    async (
      event,
      courseCode: string,
      options?: { skipCache?: boolean; upId?: string | number }
    ) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const upId = options?.upId ?? 0;
      const cacheKey = `documents_${currentSession.username}_${courseCode}_${upId}`;
      const cachedData = cachedDocuments.get(cacheKey);

      // Use cached data if available and not expired (unless skipCache is true)
      if (!options?.skipCache && cachedData) {
        return { data: cachedData, fromCache: true, age: 0 };
      }

      return requestQueue.add(async () => {
        try {
          const result = await fetchCourseDocuments(courseCode, upId);

          // Update cache with sanitized data
          cachedDocuments.set(cacheKey, result);

          return { data: result, fromCache: false, age: 0 };
        } catch (error) {
          console.error("Failed to fetch course documents:", error);
          throw error;
        }
      });
    }
  );

}

