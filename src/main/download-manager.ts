/**
 * Download Manager
 * Centralized download management system with streaming support
 */

import axios, { AxiosResponse } from "axios";
import { BrowserWindow, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Logger } from "./logger";
import { captchaSession } from "./auth";
import { API_CONFIG } from "./constants";
import {
  DownloadTask,
  DownloadType,
  AddDownloadTaskParams,
  DownloadProgress,
  PostDownloadScript,
} from "../shared/types/download";

const MAX_CONCURRENT_DOWNLOADS = 3;
const PROGRESS_UPDATE_INTERVAL = 500; // ms
const DEFAULT_DOWNLOAD_DIR = path.join(os.tmpdir(), "smart-course-platform-downloads");

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private activeDownloads: Set<string> = new Set();
  private postDownloadScripts: Map<string, PostDownloadScript["script"]> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor() {
    // Ensure download directory exists
    if (!fs.existsSync(DEFAULT_DOWNLOAD_DIR)) {
      fs.mkdirSync(DEFAULT_DOWNLOAD_DIR, { recursive: true });
    }
  }

  /**
   * Add a new download task
   */
  async addTask(params: AddDownloadTaskParams): Promise<string> {
    const taskId = this.generateTaskId();
    const { type, fileName, metadata, savePath, autoStart = true } = params;
    let { url } = params;

    // If URL doesn't start with http:// or https://, prepend BASE_URL
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = url.startsWith("/")
        ? `${API_CONFIG.BASE_URL}${url}`
        : `${API_CONFIG.BASE_URL}/${url}`;
    }

    const task: DownloadTask = {
      id: taskId,
      type,
      url,
      fileName,
      filePath: savePath,
      status: "pending",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      createdAt: new Date().toISOString(),
      metadata,
    };

    this.tasks.set(taskId, task);
    this.notifyTaskUpdate(task);

    Logger.info(`Download task added: ${taskId} - ${fileName}`);

    if (autoStart) {
      await this.startTask(taskId);
    }

    return taskId;
  }

  /**
   * Start a download task
   */
  async startTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status === "downloading") {
      Logger.warn(`Task ${taskId} is already downloading`);
      return;
    }

    // Wait if we've reached max concurrent downloads
    while (this.activeDownloads.size >= MAX_CONCURRENT_DOWNLOADS) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.activeDownloads.add(taskId);
    task.status = "downloading";
    task.startedAt = new Date().toISOString();
    this.notifyTaskUpdate(task);

    try {
      await this.executeDownload(taskId);
    } catch (error) {
      this.handleDownloadError(taskId, error);
    } finally {
      this.activeDownloads.delete(taskId);
    }
  }

  /**
   * Execute the actual download with streaming
   */
  private async executeDownload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      // Prepare headers with session cookies if available
      const headers: Record<string, string> = {
        ...API_CONFIG.HEADERS,
      };

      if (captchaSession?.cookies) {
        headers.Cookie = captchaSession.cookies.join("; ");
      }

      // Create abort controller for this download
      const abortController = new AbortController();
      this.abortControllers.set(taskId, abortController);

      // Start streaming download
      const response: AxiosResponse = await axios.get(task.url, {
        responseType: "stream",
        headers,
        timeout: 30000, // 30 second connection timeout
        signal: abortController.signal,
      });

      // Immediately pause the stream to prevent data loss
      response.data.pause();

      // Extract file size from response headers
      const contentLength = parseInt(
        response.headers["content-length"] || "0"
      );
      if (contentLength > 0) {
        task.totalBytes = contentLength;
      }

      // Try to extract real filename from Content-Disposition header
      let realFileName = task.fileName;
      const contentDisposition = response.headers["content-disposition"];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          let extractedName = filenameMatch[1].replace(/['"]/g, "");
          // Decode if it's URL encoded
          try {
            extractedName = decodeURIComponent(extractedName);
          } catch (e) {
            // If decoding fails, use the original
          }
          if (extractedName && extractedName !== "attachment") {
            realFileName = extractedName;
            task.fileName = realFileName;
            Logger.info(`Got real filename from GET response: ${realFileName}`);
          }
        }
      }

      // Update task with file info
      this.notifyTaskUpdate(task);

      // Now ask user where to save - using the real filename from server
      let savePath = task.filePath;
      if (!savePath) {
        const result = await dialog.showSaveDialog({
          defaultPath: realFileName,
          filters: [{ name: "All Files", extensions: ["*"] }],
        });

        if (result.canceled || !result.filePath) {
          // User cancelled - abort the stream
          response.data.destroy();
          task.status = "cancelled";
          task.error = "Download cancelled by user";
          this.notifyTaskUpdate(task);
          return;
        }

        savePath = result.filePath;
      }

      task.filePath = savePath;

      // Create write stream
      const writer = fs.createWriteStream(savePath);
      let downloadedBytes = 0;
      let lastProgressUpdate = Date.now();
      let lastProgressBytes = 0;
      let lastProgressTime = Date.now();

      // Resume the stream now that we have the save path
      response.data.resume();

      // Track download progress
      response.data.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        task.downloadedBytes = downloadedBytes;

        const now = Date.now();
        if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL) {
          // Calculate speed
          const timeDelta = (now - lastProgressTime) / 1000; // seconds
          const bytesDelta = downloadedBytes - lastProgressBytes;
          const speed = timeDelta > 0 ? bytesDelta / timeDelta : 0;

          // Calculate time remaining
          const remainingBytes = task.totalBytes - downloadedBytes;
          const timeRemaining = speed > 0 ? remainingBytes / speed : 0;

          task.progress = task.totalBytes > 0
            ? Math.round((downloadedBytes / task.totalBytes) * 100)
            : 0;
          task.speed = Math.round(speed);
          task.timeRemaining = Math.round(timeRemaining);

          this.notifyProgress(task);

          lastProgressUpdate = now;
          lastProgressBytes = downloadedBytes;
          lastProgressTime = now;
        }
      });

      // Pipe to file
      response.data.pipe(writer);

      // Wait for download to complete
      await new Promise<void>((resolve, reject) => {
        writer.on("finish", () => {
          Logger.info(`Download completed: ${task.fileName}`);
          task.status = "completed";
          task.progress = 100;
          task.completedAt = new Date().toISOString();
          this.notifyTaskUpdate(task);

          // Execute post-download script if exists
          const script = this.postDownloadScripts.get(taskId);
          if (script && savePath) {
            script(savePath, task)
              .then(() => Logger.info(`Post-download script executed for ${taskId}`))
              .catch((error) => Logger.error("Post-download script failed", error));
          }

          resolve();
        });

        writer.on("error", (error) => {
          Logger.error("Write stream error", error);
          reject(error);
        });

        response.data.on("error", (error: Error) => {
          Logger.error("Download stream error", error);
          reject(error);
        });
      });

      // Clean up abort controller
      this.abortControllers.delete(taskId);
    } catch (error: any) {
      // Check if it was cancelled
      if (error.name === "CanceledError" || error.code === "ERR_CANCELED") {
        task.status = "cancelled";
        task.error = "Download cancelled";
      } else {
        throw error;
      }
      this.notifyTaskUpdate(task);
    }
  }

  /**
   * Cancel a download task
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const abortController = this.abortControllers.get(taskId);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(taskId);
    }

    task.status = "cancelled";
    this.activeDownloads.delete(taskId);
    this.notifyTaskUpdate(task);

    Logger.info(`Download task cancelled: ${taskId}`);
  }

  /**
   * Retry a failed download
   */
  async retryTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== "failed" && task.status !== "cancelled") {
      throw new Error(`Task ${taskId} is not in a failed or cancelled state`);
    }

    // Reset task state
    task.status = "pending";
    task.progress = 0;
    task.downloadedBytes = 0;
    task.error = undefined;
    this.notifyTaskUpdate(task);

    await this.startTask(taskId);
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): DownloadTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by type
   */
  getTasksByType(type: DownloadType): DownloadTask[] {
    return Array.from(this.tasks.values()).filter((task) => task.type === type);
  }

  /**
   * Remove a task
   */
  removeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === "downloading") {
      this.cancelTask(taskId);
    }

    this.tasks.delete(taskId);
    this.postDownloadScripts.delete(taskId);
    Logger.info(`Download task removed: ${taskId}`);
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): void {
    const completedTasks = Array.from(this.tasks.values()).filter(
      (task) => task.status === "completed"
    );

    completedTasks.forEach((task) => {
      this.tasks.delete(task.id);
      this.postDownloadScripts.delete(task.id);
    });

    Logger.info(`Cleared ${completedTasks.length} completed tasks`);
  }

  /**
   * Register a post-download script
   */
  registerPostDownloadScript(
    taskId: string,
    script: PostDownloadScript["script"]
  ): void {
    this.postDownloadScripts.set(taskId, script);
  }

  /**
   * Handle download error
   */
  private handleDownloadError(taskId: string, error: any): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = "failed";
    task.error = error instanceof Error ? error.message : "Download failed";
    this.notifyTaskUpdate(task);

    Logger.error(`Download task failed: ${taskId}`, error);
  }

  /**
   * Notify renderer about task update
   */
  private notifyTaskUpdate(task: DownloadTask): void {
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach((window) => {
      window.webContents.send("download-task-update", task);
    });
  }

  /**
   * Notify renderer about download progress
   */
  private notifyProgress(task: DownloadTask): void {
    const progress: DownloadProgress = {
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      downloadedBytes: task.downloadedBytes,
      totalBytes: task.totalBytes,
      speed: task.speed,
      timeRemaining: task.timeRemaining,
    };

    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach((window) => {
      window.webContents.send("download-progress", progress);
    });
  }

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    return `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const downloadManager = new DownloadManager();
