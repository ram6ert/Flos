import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./common/StyledComponents";

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

      // download update
      const api = window.electronAPI;

      if (!api?.downloadUpdate || !api.installUpdate) {
        throw new Error("Update functionality is currently unavailable");
      }

      const downloadResult = await api.downloadUpdate(updateInfo);

      if (!downloadResult.success) {
        setError(
          getErrorMessage(
            downloadResult.error || t("downloadFailed"),
            (downloadResult as any).errorCode
          )
        );
        setIsDownloading(false);
        setDownloadStatus("");
        return;
      }

      setIsDownloading(false);
      setIsInstalling(true);
      setDownloadStatus(t("installingUpdate"));

      // install the update
      const installResult = await api.installUpdate(downloadResult.filePath!);

      if (!installResult.success) {
        setError(
          getErrorMessage(
            installResult.error || t("installationFailed"),
            (installResult as any).errorCode
          )
        );
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
            <h3 className="text-lg font-semibold text-gray-900">
              {t("updateAvailable")}
            </h3>
          </div>
          <Button
            onClick={onClose}
            variant="secondary"
            size="sm"
            className="text-gray-400 hover:text-gray-600 transition-colors bg-transparent border-none hover:bg-gray-100"
          >
            ✕
          </Button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            {t("newVersionFound", { version: updateInfo.version })}
          </p>

          <div className="text-xs text-gray-500 space-y-1">
            <p>
              {t("fileSize")}: {formatFileSize(updateInfo.fileSize)}
            </p>
            <p>
              {t("publishedAt")}: {formatDate(updateInfo.publishedAt)}
            </p>
          </div>

          {updateInfo.releaseNotes && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-1">
                {t("updateNotes")}:
              </p>
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
              <span>
                {downloadProgress.downloadedMB} {t("mb")} /{" "}
                {downloadProgress.totalMB} {t("mb")}
              </span>
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          <Button
            onClick={handleDownloadAndInstall}
            disabled={isDownloading || isInstalling}
            variant="primary"
            size="md"
            className="flex-1 flex items-center justify-center"
          >
            {isDownloading ? (
              <>{t("downloadingUpdate")}</>
            ) : isInstalling ? (
              <>{t("installingUpdate")}</>
            ) : (
              <>{t("updateNow")}</>
            )}
          </Button>

          <Button
            onClick={handleLater}
            disabled={isDownloading || isInstalling}
            variant="secondary"
            size="md"
            className="text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            {t("remindLater")}
          </Button>

          <Button
            onClick={handleSkip}
            disabled={isDownloading || isInstalling}
            variant="secondary"
            size="md"
            className="text-gray-500 hover:text-gray-700 bg-transparent border-none hover:bg-gray-100"
          >
            {t("skipVersion")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
