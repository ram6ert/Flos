import { ipcMain } from "electron";
import { currentSession, handleSessionExpired } from "../auth";
import {
  requestQueue,
  fetchHomeworkList,
  fetchHomeworkStreaming,
  fetchHomeworkDetails,
  uploadFile,
  submitHomework,
  fetchHomeworkDownloadPage,
  parseHomeworkDownloadUrls,
} from "../api";
import NodeCache from "node-cache";
import { Homework } from "../../shared/types";

const CACHE_TTL = 30 * 60;

const generateHomeworkResponseId = () =>
  `hw_resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const cachedHomework = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: CACHE_TTL / 2,
});
export function setupHomeworkHandlers() {
  ipcMain.handle(
    "get-homework",
    async (event, courseId?: string, options?: { skipCache?: boolean }) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const cacheKey = courseId
        ? `homework_${currentSession.username}_${courseId}`
        : "all_homework";

      // If skipCache is requested, fetch fresh data immediately
      if (options?.skipCache) {
        return requestQueue.add(async () => {
          const data = await fetchHomeworkList(courseId);
          cachedHomework.set(cacheKey, data);
          return { data, fromCache: false, age: 0 };
        });
      }

      const cachedData = cachedHomework.get(cacheKey);
      const age = (CACHE_TTL - (cachedHomework.getTtl(cacheKey) ?? 0)) * 1000;

      // If we have cached data, return it immediately without background refresh
      if (cachedData) {
        return { data: cachedData, fromCache: true, age };
      }

      // No cache, fetch fresh data
      return requestQueue.add(async () => {
        const data = await fetchHomeworkList(courseId);
        cachedHomework.set(cacheKey, data);
        return { data, fromCache: false, age: 0 };
      });
    }
  );

  ipcMain.handle(
    "refresh-homework",
    async (event, courseId?: string, options = {}) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const { requestId } = options;
      // Use the requestId passed from renderer, or generate one if not provided
      const responseId = requestId || generateHomeworkResponseId();

      const cacheKey = courseId
        ? `homework_${currentSession.username}_${courseId}`
        : "all_homework";

      // Clear existing cache for this key
      cachedHomework.del(cacheKey);

      // Signal renderer to clear display and start streaming fresh data
      try {
        // Signal renderer to clear display
        event.sender.send("homework-refresh-start", { courseId, responseId });

        const generator = fetchHomeworkStreaming(courseId, (progress) => {
          event.sender.send("homework-stream-progress", {
            ...progress,
            responseId,
          });
        });

        let finalData: Homework[] = [];
        for await (const chunk of generator) {
          event.sender.send("homework-stream-chunk", {
            ...chunk,
            fromCache: false,
            responseId,
          });
          finalData = finalData.concat(chunk.homework);
        }

        // Only complete if this is still the current request
        event.sender.send("homework-stream-complete", {
          courseId,
          responseId,
        });

        cachedHomework.set(cacheKey, finalData);
        return { data: finalData, fromCache: false, age: 0 };
      } catch (error) {
        event.sender.send("homework-stream-error", {
          error: error instanceof Error ? error.message : "Streaming failed",
          responseId,
        });
        throw error;
      }
    }
  );

  // Streaming homework handlers
  ipcMain.handle(
    "stream-homework",
    async (event, courseId?: string, options = {}) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const { requestId } = options;
      // Use the requestId passed from renderer, or generate one if not provided
      const responseId = requestId || generateHomeworkResponseId();

      const cacheKey = courseId
        ? `homework_${currentSession.username}_${courseId}`
        : "all_homework";

      // Check cache first - if we have recent data, return it immediately
      const cachedData = cachedHomework.get(cacheKey);
      if (cachedData) {
        // Send cached data immediately
        event.sender.send("homework-stream-chunk", {
          homework: cachedData,
          courseId: courseId || null,
          courseName: "Cached Data",
          fromCache: true,
          responseId,
        });

        event.sender.send("homework-stream-complete", {
          courseId,
          responseId,
        });

        return { data: cachedData, fromCache: true, age: 0 };
      }

      // No cache or expired - start streaming
      try {
        const generator = fetchHomeworkStreaming(courseId, (progress) => {
          event.sender.send("homework-stream-progress", {
            ...progress,
            responseId,
          });
        });

        let finalData: Homework[] = [];
        for await (const chunk of generator) {
          event.sender.send("homework-stream-chunk", {
            ...chunk,
            fromCache: false,
            responseId,
          });
          finalData = finalData.concat(chunk.homework);
        }

        event.sender.send("homework-stream-complete", {
          courseId,
          responseId,
        });

        cachedHomework.set(cacheKey, finalData);
        return { data: finalData || [], fromCache: false, age: 0 };
      } catch (error) {
        // Only send error if this is still the current request
        event.sender.send("homework-stream-error", {
          error: error instanceof Error ? error.message : "Streaming failed",
          responseId,
        });
        throw error;
      }
    }
  );

  // Fetch homework details
  ipcMain.handle(
    "get-homework-details",
    async (event, homeworkId: string, courseId: string, teacherId: string) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
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


  // Submit homework with files (combined interface for renderer)
  ipcMain.handle(
    "submit-homework",
    async (
      event,
      submission: {
        homeworkId: string;
        courseId: string;
        content?: string;
        files?: Array<{
          filePath: string;
          fileName: string;
        }>;
      }
    ) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      try {
        const fileList: Array<{
          fileNameNoExt: string;
          fileExtName: string;
          fileSize: string;
          visitName: string;
          pid: string;
          ftype: string;
        }> = [];

        // Step 1: Upload files if provided
        if (submission.files && submission.files.length > 0) {
          for (const file of submission.files) {
            try {
              const uploadResult = await uploadFile(
                file.filePath,
                file.fileName
              );

              if (uploadResult.success && uploadResult.data) {
                // Extract file extension and name without extension from server response
                const fileExtName = uploadResult.data.fileExtName;
                const fileNameNoExt = uploadResult.data.fileNameNoExt;

                fileList.push({
                  fileNameNoExt: fileNameNoExt,
                  fileExtName: fileExtName,
                  fileSize: uploadResult.data.fileSize.toString(),
                  visitName: uploadResult.data.visitName,
                  pid: "",
                  ftype: "insert",
                });
              } else {
                throw new Error(`Failed to upload file: ${file.fileName}`);
              }
            } catch (error) {
              throw new Error(
                `File upload failed for ${file.fileName}: ${error.message}`
              );
            }
          }
        }

        // Step 2: Submit homework with uploaded files
        const _submissionResult = await submitHomework({
          upId: submission.homeworkId,
          courseId: submission.courseId,
          content: submission.content,
          fileList: fileList,
        });

        // Return sanitized response to renderer
        return {
          success: true,
          message: "Homework submitted successfully",
          submissionTime: new Date().toISOString(),
          filesSubmitted: fileList.length,
        };
      } catch (error) {
        console.error("Failed to submit homework:", error);
        throw error;
      }
    }
  );

  // Get homework download URLs from HTML page
  ipcMain.handle(
    "get-homework-download-urls",
    async (event, upId: string, id: string, userId: string, score: string) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      return requestQueue.add(async () => {
        try {
          const html = await fetchHomeworkDownloadPage(upId, id, userId, score);
          const downloadUrls = parseHomeworkDownloadUrls(html);
          return { data: downloadUrls, success: true };
        } catch (error) {
          console.error("Failed to get homework download URLs:", error);
          throw error;
        }
      });
    }
  );

}
