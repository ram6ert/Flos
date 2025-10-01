/**
 * Download System Types
 * Unified download management types for all download operations
 */

export type DownloadType =
  | 'document'
  | 'homework-attachment'
  | 'submitted-homework'
  | 'update'
  | 'course-image'
  | 'generic';

export type DownloadStatus =
  | 'pending'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface DownloadTask {
  id: string;
  type: DownloadType;
  url: string;
  fileName: string;
  filePath?: string;
  status: DownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: DownloadMetadata;
}

export interface DownloadMetadata {
  // For documents
  documentId?: string;
  courseId?: string;
  courseName?: string;

  // For homework
  homeworkId?: string;
  attachmentId?: string;

  // For updates
  version?: string;

  // Generic metadata
  contentType?: string;
  description?: string;
  [key: string]: any;
}

export interface AddDownloadTaskParams {
  type: DownloadType;
  url: string;
  fileName: string;
  metadata?: DownloadMetadata;
  savePath?: string; // Optional: specify where to save the file
  autoStart?: boolean; // Default: true
}

export interface DownloadProgress {
  taskId: string;
  status: DownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed?: number;
  timeRemaining?: number;
}

export interface DownloadResult {
  success: boolean;
  taskId: string;
  filePath?: string;
  error?: string;
}

export interface PostDownloadScript {
  taskId: string;
  script: (filePath: string, task: DownloadTask) => Promise<void> | void;
}
