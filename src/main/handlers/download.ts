/**
 * Download Handlers
 * IPC handlers for the unified download system
 */

import { ipcMain } from "electron";
import { downloadManager } from "../download-manager";
import { Logger } from "../logger";
import { currentSession, handleSessionExpired } from "../auth";
import { AddDownloadTaskParams, DownloadType } from "../../shared/types/download";

export function setupDownloadHandlers() {
  /**
   * Add a new download task
   */
  ipcMain.handle(
    "download-add-task",
    async (event, params: AddDownloadTaskParams) => {
      try {
        const taskId = await downloadManager.addTask(params);
        Logger.info(`Download task created: ${taskId}`);
        return {
          success: true,
          taskId,
        };
      } catch (error) {
        Logger.error("Failed to add download task", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * Start a download task
   */
  ipcMain.handle("download-start-task", async (event, taskId: string) => {
    try {
      await downloadManager.startTask(taskId);
      return { success: true };
    } catch (error) {
      Logger.error(`Failed to start download task ${taskId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  /**
   * Cancel a download task
   */
  ipcMain.handle("download-cancel-task", async (event, taskId: string) => {
    try {
      await downloadManager.cancelTask(taskId);
      return { success: true };
    } catch (error) {
      Logger.error(`Failed to cancel download task ${taskId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  /**
   * Retry a failed download task
   */
  ipcMain.handle("download-retry-task", async (event, taskId: string) => {
    try {
      await downloadManager.retryTask(taskId);
      return { success: true };
    } catch (error) {
      Logger.error(`Failed to retry download task ${taskId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  /**
   * Get a specific download task
   */
  ipcMain.handle("download-get-task", async (event, taskId: string) => {
    try {
      const task = downloadManager.getTask(taskId);
      return {
        success: true,
        task,
      };
    } catch (error) {
      Logger.error(`Failed to get download task ${taskId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  /**
   * Get all download tasks
   */
  ipcMain.handle("download-get-all-tasks", async () => {
    try {
      const tasks = downloadManager.getAllTasks();
      return {
        success: true,
        tasks,
      };
    } catch (error) {
      Logger.error("Failed to get all download tasks", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  /**
   * Get tasks by type
   */
  ipcMain.handle(
    "download-get-tasks-by-type",
    async (event, type: DownloadType) => {
      try {
        const tasks = downloadManager.getTasksByType(type);
        return {
          success: true,
          tasks,
        };
      } catch (error) {
        Logger.error(`Failed to get tasks by type ${type}`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * Remove a download task
   */
  ipcMain.handle("download-remove-task", async (event, taskId: string) => {
    try {
      downloadManager.removeTask(taskId);
      return { success: true };
    } catch (error) {
      Logger.error(`Failed to remove download task ${taskId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  /**
   * Clear completed tasks
   */
  ipcMain.handle("download-clear-completed", async () => {
    try {
      downloadManager.clearCompleted();
      return { success: true };
    } catch (error) {
      Logger.error("Failed to clear completed tasks", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  /**
   * Convenience method: Download a document
   */
  ipcMain.handle(
    "download-document",
    async (
      event,
      params: {
        documentUrl: string;
        fileName: string;
        courseId?: string;
        courseName?: string;
        documentId?: string;
      }
    ) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      try {
        const taskId = await downloadManager.addTask({
          type: "document",
          url: params.documentUrl,
          fileName: params.fileName,
          metadata: {
            courseId: params.courseId,
            courseName: params.courseName,
            documentId: params.documentId,
          },
          autoStart: true,
        });

        return {
          success: true,
          taskId,
        };
      } catch (error) {
        Logger.error("Failed to download document", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * Convenience method: Download homework attachment
   * Uses the correct download URL and extracts filename from server
   *
   * IMPORTANT:
   * - attachmentId: NUMERIC attachment ID (used as 'id' parameter in URL)
   * - homeworkId: NUMERIC homework ID (used as 'noteId' parameter in URL)
   * - DO NOT pass URLs! Pass numeric IDs only.
   */
  ipcMain.handle(
    "download-homework-attachment",
    async (
      event,
      params: {
        attachmentId: string;  // Numeric attachment ID
        homeworkId: string;    // Numeric homework ID
        courseId?: string;
      }
    ) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      try {
        // Construct the correct download URL
        // id = attachmentId (numeric), noteId = homeworkId (numeric)
        const downloadUrl = `http://123.121.147.7:88/ve/back/coursePlatform/dataSynAction.shtml?method=downLoadPic&id=${params.attachmentId}&noteId=${params.homeworkId}`;

        // Use a fallback filename - the real filename will be extracted from GET response
        const fileName = `attachment_${params.attachmentId}`;

        Logger.info(`Starting download for attachment ${params.attachmentId}, will get real filename from server response`);

        const taskId = await downloadManager.addTask({
          type: "homework-attachment",
          url: downloadUrl,
          fileName: fileName,
          metadata: {
            homeworkId: params.homeworkId,
            courseId: params.courseId,
            attachmentId: params.attachmentId,
          },
          autoStart: true,
        });

        return {
          success: true,
          taskId,
          fileName,
        };
      } catch (error) {
        Logger.error("Failed to download homework attachment", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * Convenience method: Download submitted homework
   */
  ipcMain.handle(
    "download-submitted-homework",
    async (
      event,
      params: {
        url: string;
        fileName: string;
        id: string;
        homeworkId?: string;
      }
    ) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      try {
        const taskId = await downloadManager.addTask({
          type: "submitted-homework",
          url: params.url,
          fileName: params.fileName,
          metadata: {
            attachmentId: params.id,
            homeworkId: params.homeworkId,
          },
          autoStart: true,
        });

        return {
          success: true,
          taskId,
        };
      } catch (error) {
        Logger.error("Failed to download submitted homework", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  /**
   * Show folder selection dialog
   */
  ipcMain.handle("select-download-folder", async () => {
    const { dialog, BrowserWindow } = require("electron");
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory", "createDirectory"],
        title: "Select Download Folder",
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return {
          success: false,
          canceled: true,
        };
      }

      return {
        success: true,
        folderPath: result.filePaths[0],
      };
    } catch (error) {
      Logger.error("Failed to show folder selection dialog", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
}
