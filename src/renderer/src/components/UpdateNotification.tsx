import React, { useState, useEffect } from "react";

interface UpdateInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  publishedAt: string;
}

interface UpdateNotificationProps {
  updateInfo: UpdateInfo;
  onClose: () => void;
  onUpdate: () => void;
  downloadProgress?: {
    percent: number;
    downloadedMB: string;
    totalMB: string;
  } | null;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  updateInfo,
  onClose,
  onUpdate,
  downloadProgress,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string>("");

  const formatFileSize = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString("zh-CN");
  };

  const handleDownloadAndInstall = async () => {
    try {
      setIsDownloading(true);
      setError(null);
      setDownloadStatus("准备下载...");

      // 下载更新
      const downloadResult = await window.electronAPI.downloadUpdate(updateInfo);
      
      if (!downloadResult.success) {
        setError(downloadResult.error || "下载失败");
        setIsDownloading(false);
        setDownloadStatus("");
        return;
      }

      setIsDownloading(false);
      setIsInstalling(true);
      setDownloadStatus("准备安装...");

      // 安装更新
      const installResult = await window.electronAPI.installUpdate(downloadResult.filePath!);
      
      if (!installResult.success) {
        setError(installResult.error || "安装失败");
        setIsInstalling(false);
        setDownloadStatus("");
        return;
      }

      // 安装成功，应用将自动退出
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新过程中发生未知错误");
      setIsDownloading(false);
      setIsInstalling(false);
      setDownloadStatus("");
    }
  };

  const handleLater = () => {
    onClose();
  };

  const handleSkip = () => {
    // 这里可以添加跳过此版本的逻辑
    onClose();
  };

  return (
    <div className="fixed top-4 right-4 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center">
            <span className="text-blue-500 mr-2 text-xl">🔔</span>
            <h3 className="text-lg font-semibold text-gray-900">发现新版本</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            新版本 <span className="font-semibold text-blue-600">v{updateInfo.version}</span> 已发布
          </p>
          
          <div className="text-xs text-gray-500 space-y-1">
            <p>文件大小: {formatFileSize(updateInfo.fileSize)}</p>
            <p>发布时间: {formatDate(updateInfo.publishedAt)}</p>
          </div>

          {updateInfo.releaseNotes && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-1">更新说明:</p>
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                {updateInfo.releaseNotes}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <span className="text-red-500 mr-2">⚠️</span>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* 下载进度条 */}
        {isDownloading && downloadProgress && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {downloadStatus || "下载中..."}
              </span>
              <span className="text-sm text-gray-500">
                {downloadProgress.percent}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress.percent}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{downloadProgress.downloadedMB} MB / {downloadProgress.totalMB} MB</span>
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={handleDownloadAndInstall}
            disabled={isDownloading || isInstalling}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isDownloading ? (
              <>
                <span className="mr-2 animate-spin">⏳</span>
                下载中...
              </>
            ) : isInstalling ? (
              <>
                <span className="mr-2 animate-spin">⏳</span>
                安装中...
              </>
            ) : (
              <>
                立即更新
              </>
            )}
          </button>
          
          <button
            onClick={handleLater}
            disabled={isDownloading || isInstalling}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            稍后
          </button>
          
          <button
            onClick={handleSkip}
            disabled={isDownloading || isInstalling}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            跳过
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
