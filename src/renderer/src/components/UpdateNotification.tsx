import React, { useState } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);

  // Helper function to translate error codes
  const getErrorMessage = (error: string, errorCode?: string): string => {
    if (errorCode && t(errorCode) !== errorCode) {
      return t(errorCode);
    }
    return error;
  };
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string>("");

  const formatFileSize = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const handleDownloadAndInstall = async () => {
    try {
      setIsDownloading(true);
      setError(null);
      setDownloadStatus(t("downloadingUpdate"));
      onUpdate();

      // 下载更新
      const api = window.electronAPI;

      if (!api?.downloadUpdate || !api.installUpdate) {
        throw new Error("Update functionality is currently unavailable");
      }

      const downloadResult = await api.downloadUpdate(updateInfo);
      
      if (!downloadResult.success) {
        setError(getErrorMessage(downloadResult.error || t("downloadFailed"), (downloadResult as any).errorCode));
        setIsDownloading(false);
        setDownloadStatus("");
        return;
      }

      setIsDownloading(false);
      setIsInstalling(true);
      setDownloadStatus(t("installingUpdate"));

      // 安装更新
      const installResult = await api.installUpdate(downloadResult.filePath!);
      
      if (!installResult.success) {
        setError(getErrorMessage(installResult.error || t("installationFailed"), (installResult as any).errorCode));
        setIsInstalling(false);
        setDownloadStatus("");
        return;
      }

      // Installation successful, app will exit automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unknownUpdateError"));
      setIsDownloading(false);
      setIsInstalling(false);
      setDownloadStatus("");
    }
  };

  const handleLater = () => {
    onClose();
  };

  const handleSkip = () => {
    // Add logic to skip this version here
    onClose();
  };

  return (
    <div className="fixed top-4 right-4 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center">
            <span className="text-blue-500 mr-2 text-xl">🔔</span>
            <h3 className="text-lg font-semibold text-gray-900">{t("updateAvailable")}</h3>
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
            {t("newVersionFound", { version: updateInfo.version })}
          </p>
          
          <div className="text-xs text-gray-500 space-y-1">
            <p>{t("fileSize")}: {formatFileSize(updateInfo.fileSize)}</p>
            <p>{t("publishedAt")}: {formatDate(updateInfo.publishedAt)}</p>
          </div>

          {updateInfo.releaseNotes && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-1">{t("updateNotes")}:</p>
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

        {/* Download progress bar */}
        {isDownloading && downloadProgress && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {downloadStatus || t("downloadingUpdate")}
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
              <span>{downloadProgress.downloadedMB} {t("mb")} / {downloadProgress.totalMB} {t("mb")}</span>
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
                {t("downloadingUpdate")}
              </>
            ) : isInstalling ? (
              <>
                <span className="mr-2 animate-spin">⏳</span>
                {t("installingUpdate")}
              </>
            ) : (
              <>
                {t("updateNow")}
              </>
            )}
          </button>
          
          <button
            onClick={handleLater}
            disabled={isDownloading || isInstalling}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t("remindLater")}
          </button>
          
          <button
            onClick={handleSkip}
            disabled={isDownloading || isInstalling}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t("skipVersion")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
