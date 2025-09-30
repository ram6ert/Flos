import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./common/StyledComponents";

interface DownloadTask {
  id: string;
  fileName: string;
  status: "pending" | "downloading" | "completed" | "failed";
  progress: number;
  totalSize: number;
  downloadedSize: number;
  error?: string;
  filePath?: string;
}

interface DownloadTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DownloadTasksModal: React.FC<DownloadTasksModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [activeTab, setActiveTab] = useState<"downloading" | "completed">("downloading");

  useEffect(() => {
    if (isOpen) {
      loadTasks();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleTaskUpdate = (_event: any, task: DownloadTask) => {
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
    };

    window.electronAPI.onDownloadTaskUpdate?.(handleTaskUpdate);

    return () => {
      window.electronAPI.removeAllListeners?.("download-task-update");
    };
  }, []);

  const loadTasks = async () => {
    try {
      const taskList = await window.electronAPI.getDownloadTasks();
      setTasks(taskList || []);
    } catch (error) {
      console.error("Failed to load download tasks:", error);
    }
  };

  const handleClearCompleted = async () => {
    try {
      await window.electronAPI.clearDownloadTasks();
      setTasks((prevTasks) =>
        prevTasks.filter(
          (task) => task.status === "downloading" || task.status === "pending"
        )
      );
    } catch (error) {
      console.error("Failed to clear download tasks:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getStatusColor = (status: DownloadTask["status"]) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-700";
      case "downloading":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusText = (status: DownloadTask["status"]) => {
    switch (status) {
      case "pending":
        return t("pending") || "Pending";
      case "downloading":
        return t("downloading") || "Downloading";
      case "completed":
        return t("completed") || "Completed";
      case "failed":
        return t("failed") || "Failed";
      default:
        return status;
    }
  };

  const downloadingTasks = tasks.filter(
    (t) => t.status === "downloading" || t.status === "pending"
  );
  const completedTasks = tasks.filter(
    (t) => t.status === "completed" || t.status === "failed"
  );

  const displayTasks = activeTab === "downloading" ? downloadingTasks : completedTasks;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-96 max-h-[600px] bg-white rounded-md shadow-2xl border border-gray-200 flex flex-col transition-all duration-300 ease-out ${
        isOpen
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-md">
        <h2 className="text-lg font-bold text-gray-900">
          下载任务
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
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

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("downloading")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "downloading"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          下载中 ({downloadingTasks.length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "completed"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          已完成 ({completedTasks.length})
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {displayTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {activeTab === "downloading" ? "暂无下载任务" : "暂无已完成任务"}
          </div>
        ) : (
            <div className="space-y-2">
            {displayTasks.map((task) => (
                <div
                  key={task.id}
                  className="border border-gray-200 rounded-md p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-gray-900 mb-1 truncate">
                        {task.fileName}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}
                        >
                          {getStatusText(task.status)}
                        </span>
                        {task.totalSize > 0 && (
                          <span className="text-xs text-gray-600">
                            {formatFileSize(task.downloadedSize)} /{" "}
                            {formatFileSize(task.totalSize)}
                          </span>
                        )}
                      </div>
                    </div>
                    {task.status === "downloading" && (
                      <span className="text-sm font-medium text-blue-600 ml-2">
                        {task.progress}%
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {task.status === "downloading" && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Error Message */}
                  {task.status === "failed" && task.error && (
                    <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                      {task.error}
                    </div>
                  )}

                  {/* File Path */}
                  {task.status === "completed" && task.filePath && (
                    <div className="mt-1.5 text-xs text-gray-600 truncate" title={task.filePath}>
                      📁 {task.filePath}
                    </div>
                  )}

                  {/* Delete button for completed tasks */}
                  {activeTab === "completed" && (
                    <button
                      onClick={() => {
                        window.electronAPI.clearDownloadTasks([task.id]);
                        setTasks((prev) => prev.filter((t) => t.id !== task.id));
                      }}
                      className="mt-2 text-xs text-red-600 hover:text-red-700 hover:underline"
                    >
                      删除记录
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Footer with clear all button (only in completed tab) */}
      {activeTab === "completed" && completedTasks.length > 0 && (
        <div className="border-t p-3 bg-gray-50 flex justify-center rounded-b-md">
          <Button
            onClick={handleClearCompleted}
            variant="secondary"
            size="sm"
          >
            清空所有记录
          </Button>
        </div>
      )}
    </div>
  );
};

export default DownloadTasksModal;
