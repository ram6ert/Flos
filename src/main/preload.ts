import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { UpdateInfo } from "./updater";
import {
  LoginCredentials,
  LoginResponse,
  AddDownloadTaskParams,
  DownloadTask,
  DownloadType,
  Course,
  Homework,
  HomeworkDetails,
  CourseDocument,
  DocumentDirectory,
  CourseDocumentsResponse,
  ScheduleData,
} from "../shared/types";

/**
 * Session data returned from getCurrentSession
 */
export interface SessionData {
  userId: string;
  username: string;
  sessionId: string;
  jsessionId: string;
  loginTime: string;
  isValid: boolean;
}

/**
 * Possible types of data stored in cache
 */
export type CacheData = Course[] | Homework[] | HomeworkDetails | CourseDocumentsResponse | ScheduleData;

/**
 * Update status data
 */
export interface UpdateStatusData {
  status: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  message?: string;
  progress?: number;
}

/**
 * Update download progress data
 */
export interface UpdateDownloadData {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

/**
 * Electron API exposed to renderer process via contextBridge
 *
 * IMPORTANT: ID Parameter Conventions
 * ====================================
 * All ID parameters follow these conventions:
 *
 * - courseId, homeworkId, documentId, attachmentId, teacherId: Internal numeric IDs (string type, e.g., "12345")
 * - courseCode, courseCode: Human-readable identifiers (string type, e.g., "M302005B")
 *
 * Always use numeric IDs for API calls, never use courseCode as courseId!
 */
export interface ElectronAPI {
  getCourses: (options?: {
    skipCache?: boolean;
  }) => Promise<{ data: Course[]; fromCache: boolean; age: number }>;
  getHomework: (
    courseId?: string,
    options?: { skipCache?: boolean }
  ) => Promise<{ data: Homework[]; fromCache: boolean; age: number }>;
  getHomeworkDetails: (
    homeworkId: string,
    courseId: string,
    teacherId: string
  ) => Promise<{ data: HomeworkDetails; success: boolean }>;
  getCourseDocuments: (
    courseId: string,
    options?: { skipCache?: boolean; upId?: string | number }
  ) => Promise<{ data: CourseDocumentsResponse; fromCache: boolean; age: number }>;
  refreshCourses: () => Promise<{
    data: Course[];
    fromCache: boolean;
    age: number;
  }>;
  refreshHomework: (
    courseId?: string,
    options?: { requestId?: string }
  ) => Promise<{ data: Homework[]; fromCache: boolean; age: number }>;
  refreshDocuments: (
    courseId?: string,
    options?: { requestId?: string; upId?: string | number }
  ) => Promise<{ data: CourseDocumentsResponse; fromCache: boolean; age: number }>;
  streamHomework: (
    courseId?: string,
    options?: { requestId?: string }
  ) => Promise<{ data: Homework[]; fromCache: boolean; age: number }>;
  streamDocuments: (
    courseId?: string,
    options?: { forceRefresh?: boolean; requestId?: string; upId?: string | number }
  ) => Promise<{ data: CourseDocumentsResponse; fromCache: boolean; age: number }>;
  getSchedule: (options?: { skipCache?: boolean }) => Promise<ScheduleData>;
  refreshSchedule: () => Promise<ScheduleData>;
  fetchCourseImage: (imagePath: string) => Promise<string | null>;
  fetchCaptcha: () => Promise<{
    success: boolean;
    requestId?: string;
    imageData?: string;
  }>;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  isLoggedIn: () => Promise<boolean>;
  getCurrentSession: () => Promise<SessionData | null>;
  validateStoredSession: () => Promise<boolean>;
  storeCredentials: (credentials: {
    username: string;
    password: string;
    jsessionId?: string;
  }) => Promise<void>;
  getStoredCredentials: () => Promise<{
    username?: string;
    password?: string;
    jsessionId?: string;
  } | null>;
  clearStoredCredentials: () => Promise<void>;
  onCacheUpdate: (
    callback: (event: IpcRendererEvent, payload: { key: string; data: CacheData }) => void
  ) => void;
  onSessionExpired: (callback: () => void) => void;
  onHomeworkStreamChunk: (
    callback: (
      event: IpcRendererEvent,
      chunk: {
        homework: Homework[];
        courseId?: string;
        courseName?: string;
        fromCache: boolean;
        responseId?: string;
      }
    ) => void
  ) => void;
  onHomeworkStreamProgress: (
    callback: (
      event: IpcRendererEvent,
      progress: {
        completed: number;
        total: number;
        currentCourse?: string;
        responseId?: string;
      }
    ) => void
  ) => void;
  onHomeworkStreamComplete: (
    callback: (
      event: IpcRendererEvent,
      payload: { courseId?: string; responseId?: string }
    ) => void
  ) => void;
  onHomeworkStreamError: (
    callback: (
      event: IpcRendererEvent,
      error: { error: string; responseId?: string }
    ) => void
  ) => void;
  onDocumentStreamChunk: (
    callback: (
      event: IpcRendererEvent,
      chunk: {
        documents: CourseDocument[];
        directories?: DocumentDirectory[];
        courseId?: string;
        courseName?: string;
        fromCache: boolean;
        responseId?: string;
      }
    ) => void
  ) => void;
  onDocumentStreamProgress: (
    callback: (
      event: IpcRendererEvent,
      progress: {
        completed: number;
        total: number;
        currentCourse?: string;
        responseId?: string;
      }
    ) => void
  ) => void;
  onDocumentStreamComplete: (
    callback: (
      event: IpcRendererEvent,
      payload: { courseId?: string; responseId?: string }
    ) => void
  ) => void;
  onDocumentStreamError: (
    callback: (
      event: IpcRendererEvent,
      error: { error: string; responseId?: string }
    ) => void
  ) => void;
  onHomeworkRefreshStart: (
    callback: (
      event: IpcRendererEvent,
      payload: { courseId?: string; responseId?: string }
    ) => void
  ) => void;
  onDocumentRefreshStart: (
    callback: (
      event: IpcRendererEvent,
      payload: { courseId?: string; responseId?: string }
    ) => void
  ) => void;
  removeAllListeners: (channel: string) => void;
  // update related APIs
  checkForUpdates: () => Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion?: string;
    updateInfo?: UpdateInfo;
    error?: string;
  }>;
  downloadUpdate: (updateInfo: UpdateInfo) => Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }>;
  installUpdate: (filePath: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  showUpdateDialog: (updateInfo: UpdateInfo) => Promise<boolean>;
  onUpdateStatus: (callback: (event: IpcRendererEvent, data: UpdateStatusData) => void) => void;
  onUpdateDownload: (callback: (event: IpcRendererEvent, data: UpdateDownloadData) => void) => void;
  // homework submission
  submitHomework: (submission: {
    homeworkId: string;
    courseId: string;
    content?: string;
    files?: Array<{
      filePath: string;
      fileName: string;
    }>;
  }) => Promise<{
    success: boolean;
    message: string;
    submissionTime: string;
    filesSubmitted: number;
  }>;
  // submitted homework download
  getHomeworkDownloadUrls: (
    upId: string,
    id: string,
    userId: string,
    score: string
  ) => Promise<{
    data: Array<{
      fileName: string;
      url: string;
      id: string;
      type: "my_homework";
    }>;
    success: boolean;
  }>;
  // unified download APIs
  downloadAddTask: (params: AddDownloadTaskParams) => Promise<{
    success: boolean;
    taskId?: string;
    error?: string;
  }>;
  downloadStartTask: (taskId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  downloadCancelTask: (taskId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  downloadRetryTask: (taskId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  downloadGetTask: (taskId: string) => Promise<{
    success: boolean;
    task?: DownloadTask;
    error?: string;
  }>;
  downloadGetAllTasks: () => Promise<{
    success: boolean;
    tasks?: DownloadTask[];
    error?: string;
  }>;
  downloadGetTasksByType: (type: DownloadType) => Promise<{
    success: boolean;
    tasks?: DownloadTask[];
    error?: string;
  }>;
  downloadRemoveTask: (taskId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  downloadClearCompleted: () => Promise<{
    success: boolean;
    error?: string;
  }>;
  onDownloadTaskUpdate: (
    callback: (event: IpcRendererEvent, task: DownloadTask) => void
  ) => void;
  onDownloadProgress: (
    callback: (
      event: IpcRendererEvent,
      progress: {
        taskId: string;
        status: string;
        progress: number;
        downloadedBytes: number;
        totalBytes: number;
        speed?: number;
        timeRemaining?: number;
      }
    ) => void
  ) => void;
  selectDownloadFolder: () => Promise<{
    success: boolean;
    folderPath?: string;
    canceled?: boolean;
    error?: string;
  }>;
}

const electronAPI: ElectronAPI = {
  getCourses: (options?: { skipCache?: boolean }) =>
    ipcRenderer.invoke("get-courses", options),
  getHomework: (courseId?: string, options?: { skipCache?: boolean }) =>
    ipcRenderer.invoke("get-homework", courseId, options),
  getHomeworkDetails: (
    homeworkId: string,
    courseId: string,
    teacherId: string
  ) =>
    ipcRenderer.invoke("get-homework-details", homeworkId, courseId, teacherId),
  getCourseDocuments: (courseId: string, options?: { skipCache?: boolean }) =>
    ipcRenderer.invoke("get-course-documents", courseId, options),
  refreshCourses: () => ipcRenderer.invoke("get-courses", { skipCache: true }),
  refreshHomework: (courseId?: string, options?: { requestId?: string }) =>
    ipcRenderer.invoke("refresh-homework", courseId, options),
  refreshDocuments: (courseId?: string, options?: { requestId?: string }) =>
    ipcRenderer.invoke("refresh-documents", courseId, options),
  streamHomework: (courseId?: string, options?: { requestId?: string }) =>
    ipcRenderer.invoke("stream-homework", courseId, options),
  streamDocuments: (
    courseId?: string,
    options?: { forceRefresh?: boolean; requestId?: string }
  ) => ipcRenderer.invoke("stream-documents", courseId, options),
  getSchedule: (options?: { skipCache?: boolean }) =>
    ipcRenderer.invoke("get-schedule", options),
  refreshSchedule: () => ipcRenderer.invoke("refresh-schedule"),
  fetchCourseImage: (imagePath: string) =>
    ipcRenderer.invoke("fetch-course-image", imagePath),
  fetchCaptcha: () => ipcRenderer.invoke("fetch-captcha"),
  login: (credentials: LoginCredentials) =>
    ipcRenderer.invoke("login", credentials),
  logout: () => ipcRenderer.invoke("logout"),
  isLoggedIn: () => ipcRenderer.invoke("is-logged-in"),
  getCurrentSession: () => ipcRenderer.invoke("get-current-session"),
  validateStoredSession: () => ipcRenderer.invoke("validate-stored-session"),
  storeCredentials: (credentials) =>
    ipcRenderer.invoke("store-credentials", credentials),
  getStoredCredentials: () => ipcRenderer.invoke("get-stored-credentials"),
  clearStoredCredentials: () => ipcRenderer.invoke("clear-stored-credentials"),
  onCacheUpdate: (callback) => ipcRenderer.on("cache-updated", callback),
  onSessionExpired: (callback) => ipcRenderer.on("session-expired", callback),
  onHomeworkStreamChunk: (callback) =>
    ipcRenderer.on("homework-stream-chunk", callback),
  onHomeworkStreamProgress: (callback) =>
    ipcRenderer.on("homework-stream-progress", callback),
  onHomeworkStreamComplete: (callback) =>
    ipcRenderer.on("homework-stream-complete", callback),
  onHomeworkStreamError: (callback) =>
    ipcRenderer.on("homework-stream-error", callback),
  onDocumentStreamChunk: (callback) =>
    ipcRenderer.on("document-stream-chunk", callback),
  onDocumentStreamProgress: (callback) =>
    ipcRenderer.on("document-stream-progress", callback),
  onDocumentStreamComplete: (callback) =>
    ipcRenderer.on("document-stream-complete", callback),
  onDocumentStreamError: (callback) =>
    ipcRenderer.on("document-stream-error", callback),
  onHomeworkRefreshStart: (callback) =>
    ipcRenderer.on("homework-refresh-start", callback),
  onDocumentRefreshStart: (callback) =>
    ipcRenderer.on("document-refresh-start", callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  // update related APIs
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: (updateInfo: UpdateInfo) =>
    ipcRenderer.invoke("download-update", updateInfo),
  installUpdate: (filePath: string) =>
    ipcRenderer.invoke("install-update", filePath),
  showUpdateDialog: (updateInfo: UpdateInfo) =>
    ipcRenderer.invoke("show-update-dialog", updateInfo),
  onUpdateStatus: (callback) => ipcRenderer.on("update-status", callback),
  onUpdateDownload: (callback) => ipcRenderer.on("update-download", callback),
  // homework submission
  submitHomework: (submission) =>
    ipcRenderer.invoke("submit-homework", submission),
  // submitted homework download
  getHomeworkDownloadUrls: (
    upId: string,
    id: string,
    userId: string,
    score: string
  ) =>
    ipcRenderer.invoke("get-homework-download-urls", upId, id, userId, score),
  // unified download APIs
  downloadAddTask: (params: AddDownloadTaskParams) =>
    ipcRenderer.invoke("download-add-task", params),
  downloadStartTask: (taskId: string) =>
    ipcRenderer.invoke("download-start-task", taskId),
  downloadCancelTask: (taskId: string) =>
    ipcRenderer.invoke("download-cancel-task", taskId),
  downloadRetryTask: (taskId: string) =>
    ipcRenderer.invoke("download-retry-task", taskId),
  downloadGetTask: (taskId: string) =>
    ipcRenderer.invoke("download-get-task", taskId),
  downloadGetAllTasks: () => ipcRenderer.invoke("download-get-all-tasks"),
  downloadGetTasksByType: (type: DownloadType) =>
    ipcRenderer.invoke("download-get-tasks-by-type", type),
  downloadRemoveTask: (taskId: string) =>
    ipcRenderer.invoke("download-remove-task", taskId),
  downloadClearCompleted: () => ipcRenderer.invoke("download-clear-completed"),
  onDownloadTaskUpdate: (callback) =>
    ipcRenderer.on("download-task-update", callback),
  onDownloadProgress: (callback) =>
    ipcRenderer.on("download-progress", callback),
  selectDownloadFolder: () => ipcRenderer.invoke("select-download-folder"),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
