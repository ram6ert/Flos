import { ipcMain } from "electron";
import axios from "axios";
import { currentSession, captchaSession } from "../auth";
import {
  requestQueue,
  fetchHomeworkData,
  fetchHomeworkStreaming,
  fetchHomeworkDetails,
  uploadFile,
  submitHomework,
} from "../api";
import { API_CONFIG } from "../constants";
import NodeCache from "node-cache";
import { Homework } from "../../shared/types";

const CACHE_TTL = 30 * 60;
const cachedHomework = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: CACHE_TTL / 2,
});
export function setupHomeworkHandlers() {
  ipcMain.handle(
    "get-homework",
    async (event, courseId?: string, options?: { skipCache?: boolean }) => {
      if (!currentSession) {
        throw new Error("Not logged in");
      }

      const cacheKey = courseId
        ? `homework_${currentSession.username}_${courseId}`
        : "all_homework";

      // If skipCache is requested, fetch fresh data immediately
      if (options?.skipCache) {
        return requestQueue.add(async () => {
          const data = await fetchHomeworkData(courseId);
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
        const data = await fetchHomeworkData(courseId);
        cachedHomework.set(cacheKey, data);
        return { data, fromCache: false, age: 0 };
      });
    }
  );

  ipcMain.handle("refresh-homework", async (event, courseId?: string) => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    const cacheKey = courseId
      ? `homework_${currentSession.username}_${courseId}`
      : "all_homework";

    // Clear existing cache for this key
    cachedHomework.del(cacheKey);

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

      let finalData: Homework[] = [];
      for await (const chunk of generator) {
        // Send each chunk as it arrives
        event.sender.send("homework-stream-chunk", {
          ...chunk,
          fromCache: false,
        });
        finalData = finalData.concat(chunk.homework);
      }

      // Send completion signal
      event.sender.send("homework-stream-complete", { courseId });

      cachedHomework.set(cacheKey, finalData);
      return { data: finalData, fromCache: false, age: 0 };
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

      let finalData: Homework[] = [];
      for await (const chunk of generator) {
        // Send each chunk as it arrives
        event.sender.send("homework-stream-chunk", {
          ...chunk,
          fromCache: false,
        });
        finalData = finalData.concat(chunk.homework);
      }

      // Send completion signal
      event.sender.send("homework-stream-complete", { courseId });

      // Return final cached data
      cachedHomework.set(cacheKey, finalData);
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
          ? `${API_CONFIG.BASE_URL}${attachmentUrl}`
          : attachmentUrl;

        console.log("Downloading homework attachment from URL:", fullUrl);

        // First, check the file size with a HEAD request
        const headResponse = await axios.head(fullUrl, {
          headers: {
            Cookie: captchaSession?.cookies.join("; ") || "",
            ...API_CONFIG.HEADERS,
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
              ...API_CONFIG.HEADERS,
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
              ...API_CONFIG.HEADERS,
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
        throw new Error("Not logged in");
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
}
