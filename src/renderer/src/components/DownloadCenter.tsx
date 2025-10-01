import React, { useEffect, useState } from "react";
import { DownloadTask, DownloadStatus } from "../../../shared/types/download";

declare global {
  interface Window {
    electronAPI: {
      downloadGetAllTasks: () => Promise<{
        success: boolean;
        tasks?: DownloadTask[];
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
      downloadRemoveTask: (taskId: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
      downloadClearCompleted: () => Promise<{
        success: boolean;
        error?: string;
      }>;
      onDownloadTaskUpdate: (
        callback: (event: any, task: DownloadTask) => void
      ) => void;
      onDownloadProgress: (
        callback: (
          event: any,
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
      removeAllListeners: (channel: string) => void;
    };
  }
}

const DownloadCenter: React.FC = () => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();

    // Listen for task updates
    window.electronAPI.onDownloadTaskUpdate((_, task) => {
      setTasks((prevTasks) => {
        const index = prevTasks.findIndex((t) => t.id === task.id);
        if (index >= 0) {
          const newTasks = [...prevTasks];
          newTasks[index] = task;
          return newTasks;
        } else {
          return [...prevTasks, task];
        }
      });
    });

    // Listen for progress updates
    window.electronAPI.onDownloadProgress((_, progress) => {
      setTasks((prevTasks) => {
        const index = prevTasks.findIndex((t) => t.id === progress.taskId);
        if (index >= 0) {
          const newTasks = [...prevTasks];
          newTasks[index] = {
            ...newTasks[index],
            progress: progress.progress,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
            speed: progress.speed,
            timeRemaining: progress.timeRemaining,
          };
          return newTasks;
        }
        return prevTasks;
      });
    });

    return () => {
      window.electronAPI.removeAllListeners("download-task-update");
      window.electronAPI.removeAllListeners("download-progress");
    };
  }, []);

  const loadTasks = async () => {
    const result = await window.electronAPI.downloadGetAllTasks();
    if (result.success && result.tasks) {
      setTasks(result.tasks);
    }
  };

  const handleCancel = async (taskId: string) => {
    await window.electronAPI.downloadCancelTask(taskId);
  };

  const handleRetry = async (taskId: string) => {
    await window.electronAPI.downloadRetryTask(taskId);
  };

  const handleRemove = async (taskId: string) => {
    await window.electronAPI.downloadRemoveTask(taskId);
    setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));
  };

  const handleClearCompleted = async () => {
    await window.electronAPI.downloadClearCompleted();
    setTasks((prevTasks) =>
      prevTasks.filter((t) => t.status !== "completed")
    );
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || seconds === Infinity) return "Calculating...";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const getStatusColor = (status: DownloadStatus): string => {
    switch (status) {
      case "downloading":
        return "text-blue-600";
      case "completed":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      case "cancelled":
        return "text-gray-600";
      case "paused":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusText = (status: DownloadStatus): string => {
    const statusMap: Record<DownloadStatus, string> = {
      pending: "Pending",
      downloading: "Downloading",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
      paused: "Paused",
    };
    return statusMap[status] || status;
  };

  const activeDownloads = tasks.filter(
    (t) => t.status === "downloading" || t.status === "pending"
  );

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Floating Button */}
      {!isOpen && tasks.length > 0 && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {activeDownloads.length > 0 && (
              <span className="bg-white text-blue-600 rounded-full px-2 py-0.5 text-sm font-semibold">
                {activeDownloads.length}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Download Center Panel */}
      {isOpen && (
        <div className="bg-white rounded-lg shadow-2xl w-96 max-h-[32rem] flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 m-0">
              Downloads ({tasks.length})
            </h3>
            <div className="flex gap-2">
              {tasks.some((t) => t.status === "completed") && (
                <button
                  onClick={handleClearCompleted}
                  className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                >
                  Clear Completed
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="overflow-y-auto flex-1 p-4">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No downloads yet
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                  >
                    {/* File Name and Type */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate m-0">
                          {task.fileName}
                        </p>
                        <p className="text-xs text-gray-500 m-0 mt-1">
                          {task.type}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium ${getStatusColor(task.status)} ml-2`}
                      >
                        {getStatusText(task.status)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {task.status === "downloading" && (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mb-2">
                          <span>
                            {formatBytes(task.downloadedBytes)} /{" "}
                            {formatBytes(task.totalBytes)}
                          </span>
                          <span>{task.progress}%</span>
                        </div>
                        {task.speed && task.speed > 0 && (
                          <div className="text-xs text-gray-500">
                            {formatBytes(task.speed)}/s •{" "}
                            {formatTime(task.timeRemaining || 0)} remaining
                          </div>
                        )}
                      </>
                    )}

                    {/* Error Message */}
                    {task.status === "failed" && task.error && (
                      <p className="text-xs text-red-600 mt-2 m-0">
                        {task.error}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      {task.status === "downloading" && (
                        <button
                          onClick={() => handleCancel(task.id)}
                          className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      {task.status === "failed" && (
                        <button
                          onClick={() => handleRetry(task.id)}
                          className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Retry
                        </button>
                      )}
                      {(task.status === "completed" ||
                        task.status === "cancelled" ||
                        task.status === "failed") && (
                        <button
                          onClick={() => handleRemove(task.id)}
                          className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadCenter;
