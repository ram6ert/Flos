import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Course } from "../../../shared/types";
import {
  CourseDocument,
  DocumentStreamChunk,
  DocumentStreamProgress,
  CourseDocumentType,
} from "../../../shared/types";
import { LoadingState, LoadingStateData } from "../types/ui";
import {
  Container,
  PageHeader,
  Button,
  Card,
  Loading,
  ErrorDisplay,
  InfoBanner,
} from "./common/StyledComponents";

interface DocumentListProps {
  documents: CourseDocument[];
  selectedCourse: Course | null;
  courses: Course[];
  onCourseSelect: (course: Course | null) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  selectedCourse,
  courses,
  onCourseSelect,
}) => {
  const { t } = useTranslation();
  const [realDocuments, setRealDocuments] = useState<CourseDocument[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingStateData>({
    state: LoadingState.IDLE,
  });
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDocType, setSelectedDocType] = useState<
    CourseDocumentType | "all"
  >("all");
  const currentRequestRef = useRef<string | null>(null);
  const streamingAbortControllerRef = useRef<AbortController | null>(null);

  const fetchDocuments = useCallback(
    async (forceRefresh = false) => {
      if (!selectedCourse) return;

      // Abort any ongoing streaming request
      if (streamingAbortControllerRef.current) {
        streamingAbortControllerRef.current.abort();
      }

      // Create a unique request ID to track this request
      const requestId = `${selectedCourse.courseNumber}-${Date.now()}`;
      currentRequestRef.current = requestId;

      // Create new abort controller for this request
      const abortController = new AbortController();
      streamingAbortControllerRef.current = abortController;

      try {
        setLoadingState({ state: LoadingState.LOADING });

        setRealDocuments([]); // Clear existing documents for streaming

        // Set up event listeners for streaming with race condition protection
        const cleanupListeners = () => {
          window.electronAPI.removeAllListeners("document-stream-chunk");
          window.electronAPI.removeAllListeners("document-stream-progress");
          window.electronAPI.removeAllListeners("document-stream-complete");
          window.electronAPI.removeAllListeners("document-stream-error");
          window.electronAPI.removeAllListeners("document-refresh-start");
        };

        // Clean up any existing listeners before setting up new ones
        cleanupListeners();

        window.electronAPI.onDocumentStreamChunk(
          (_event, chunk: DocumentStreamChunk) => {
            // Check if request was aborted or is not current
            if (
              abortController.signal.aborted ||
              currentRequestRef.current !== requestId
            ) {
              return;
            }

            if (chunk.fromCache) {
              // If cached data, replace all documents
              setRealDocuments(chunk.documents);
              setLoadingState({ state: LoadingState.SUCCESS });
              cleanupListeners();
            } else if (chunk.isComplete || chunk.type === "complete") {
              // Final completion signal - don't add documents but finish streaming
              setLoadingState({ state: LoadingState.SUCCESS });
              cleanupListeners();
            } else {
              // If streaming data, append to existing documents
              setRealDocuments((prev) => {
                const newDocs = [...prev, ...chunk.documents];
                // Remove duplicates based on document ID
                const uniqueDocs = newDocs.filter(
                  (doc, index, arr) =>
                    arr.findIndex((d) => d.id === doc.id) === index
                );
                return uniqueDocs;
              });
            }
          }
        );

        window.electronAPI.onDocumentStreamProgress(
          (_event, progress: DocumentStreamProgress) => {
            // Check if request was aborted or is not current
            if (
              abortController.signal.aborted ||
              currentRequestRef.current !== requestId
            ) {
              return;
            }
            setLoadingState({
              state: LoadingState.LOADING,
              progress: {
                completed: progress.completed,
                total: progress.total,
                currentItem: progress.currentCourse,
              },
            });
          }
        );

        window.electronAPI.onDocumentStreamComplete((_event, _payload) => {
          // Check if request was aborted or is not current
          if (
            abortController.signal.aborted ||
            currentRequestRef.current !== requestId
          ) {
            return;
          }
          setLoadingState({ state: LoadingState.SUCCESS });
          cleanupListeners();
        });

        window.electronAPI.onDocumentStreamError((_event, errorData) => {
          // Check if request was aborted or is not current
          if (
            abortController.signal.aborted ||
            currentRequestRef.current !== requestId
          ) {
            return;
          }
          console.error("Document streaming error:", errorData.error);
          setLoadingState({
            state: LoadingState.ERROR,
            error: `Failed to fetch documents: ${errorData.error}`,
          });
          cleanupListeners();
        });

        window.electronAPI.onDocumentRefreshStart?.((_event, _payload) => {
          // Check if request was aborted or is not current
          if (
            abortController.signal.aborted ||
            currentRequestRef.current !== requestId
          ) {
            return;
          }
          // Clear current documents and reset loading state for refresh
          setRealDocuments([]);
          setLoadingState({ state: LoadingState.LOADING });
        });

        if (forceRefresh) {
          await window.electronAPI.refreshDocuments(
            selectedCourse.courseNumber
          );
        } else {
          // Start streaming for this specific course (will fetch all document types)
          await window.electronAPI.streamDocuments(selectedCourse.courseNumber);
        }
      } catch (error) {
        // Don't show error if request was aborted or is not current
        if (
          abortController.signal.aborted ||
          currentRequestRef.current !== requestId
        ) {
          return;
        }
        console.error("Failed to fetch documents:", error);
        setLoadingState({
          state: LoadingState.ERROR,
          error: "Failed to fetch course documents. Please try again later.",
        });
      }
    },
    [selectedCourse]
  );

  useEffect(() => {
    if (selectedCourse) {
      fetchDocuments(false); // Use streaming for initial load
    } else {
      // Abort any ongoing request when course is deselected
      if (streamingAbortControllerRef.current) {
        streamingAbortControllerRef.current.abort();
      }
      setRealDocuments([]);
      setLoadingState({ state: LoadingState.IDLE });
    }
  }, [selectedCourse, fetchDocuments]);

  // Cleanup listeners on unmount and abort any ongoing requests
  useEffect(() => {
    return () => {
      // Abort any ongoing streaming request
      if (streamingAbortControllerRef.current) {
        streamingAbortControllerRef.current.abort();
      }

      // Clean up event listeners
      window.electronAPI.removeAllListeners("document-stream-chunk");
      window.electronAPI.removeAllListeners("document-stream-progress");
      window.electronAPI.removeAllListeners("document-stream-complete");
      window.electronAPI.removeAllListeners("document-stream-error");
    };
  }, []);

  const formatFileSize = (sizeStr: string) => {
    const size = parseFloat(sizeStr);
    if (size < 1) {
      return `${(size * 1024).toFixed(0)} KB`;
    }
    return `${size.toFixed(2)} MB`;
  };

  const formatUploadTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFileIcon = (extName: string) => {
    switch (extName.toLowerCase()) {
      case "pdf":
        return "📄";
      case "ppt":
      case "pptx":
        return "📊";
      case "doc":
      case "docx":
        return "📝";
      case "zip":
      case "rar":
        return "📦";
      case "mp4":
      case "avi":
        return "🎥";
      default:
        return "📋";
    }
  };

  const handleDownload = async (doc: CourseDocument) => {
    setDownloadingDoc(doc.id);
    try {
      const fileName = `${doc.name}.${doc.fileExtension}`;
      const result = await window.electronAPI.downloadCourseDocument(
        doc.resourceUrl,
        fileName
      );

      if (result.success) {
        if (result.savedToFile) {
          // Large file saved directly to disk
          alert(`File downloaded successfully to: ${result.filePath}`);
        } else if (result.data) {
          // Small file - create download link
          const blob = new Blob(
            [Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))],
            {
              type: result.contentType,
            }
          );
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
      } else {
        alert(`Download failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed. Please try again.");
    } finally {
      setDownloadingDoc(null);
    }
  };

  const renderDocumentContent = () => {
    if (loadingState.state === LoadingState.ERROR) {
      return (
        <ErrorDisplay
          title={t("unableToLoadDocuments")}
          message={loadingState.error || "Unknown error"}
          onRetry={() => fetchDocuments(true)}
          retryLabel={t("retry")}
        />
      );
    }

    if (loadingState.state === LoadingState.LOADING && !loadingState.progress) {
      return <Loading message={t("loading")} />;
    }

    if (!selectedCourse) {
      return (
        <p className="text-gray-600">Select a course to view documents.</p>
      );
    }

    if (realDocuments.length === 0) {
      return (
        <p className="text-gray-600">No documents available for this course.</p>
      );
    }

    const filteredDocuments = realDocuments.filter((doc) => {
      const matchesSearch = doc.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType =
        selectedDocType === "all" || doc.documentType === selectedDocType;
      return matchesSearch && matchesType;
    });

    if (
      filteredDocuments.length === 0 &&
      (searchTerm || selectedDocType !== "all")
    ) {
      return (
        <p className="text-gray-600">
          No documents found matching your filters.
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {filteredDocuments
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((doc) => (
            <Card key={doc.id} padding="lg">
              <div className="flex justify-between items-center w-full">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-3">
                      {getFileIcon(doc.fileExtension)}
                    </span>
                    <h3 className="m-0 text-base text-gray-900 font-semibold">
                      {doc.name}
                    </h3>
                    <span className="ml-3 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700 font-medium">
                      {doc.fileExtension.toUpperCase()}
                    </span>
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 rounded-full text-xs text-blue-700 font-medium">
                      {t(
                        doc.documentType === "courseware"
                          ? "electronicCourseware"
                          : doc.documentType === "experiment_guide"
                            ? "experimentGuide"
                            : "unknownDocumentType"
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <p className="m-0">
                      <strong>Size:</strong> {formatFileSize(doc.size)}
                    </p>
                    <p className="m-0">
                      <strong>Uploaded:</strong>{" "}
                      {formatUploadTime(doc.uploadTime)}
                    </p>
                    <p className="m-0">
                      <strong>Teacher:</strong> {doc.teacherName}
                    </p>
                    <p className="m-0">
                      <strong>Downloads:</strong> {doc.downloadCount}
                    </p>
                  </div>
                </div>

                <div className="ml-4">
                  <Button
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingDoc === doc.id}
                    variant="success"
                    size="sm"
                  >
                    {downloadingDoc === doc.id
                      ? t("downloading")
                      : t("download")}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
      </div>
    );
  };

  return (
    <Container padding="lg">
      <PageHeader
        title={`${t("documents")}${
          selectedCourse
            ? ` - ${selectedCourse.name} (${loadingState.state === LoadingState.LOADING ? "..." : realDocuments.length})`
            : ""
        }`}
        actions={
          <div className="flex gap-3 items-center">
            <select
              value={courses.some((c) => c.id === (selectedCourse?.id || "")) ? selectedCourse?.id || "" : ""}
              onChange={(e) => {
                if (e.target.value === "") {
                  onCourseSelect(null);
                  return;
                }
                const course = courses.find((c) => c.id === e.target.value);
                if (course) onCourseSelect(course);
              }}
              className="px-2 py-1 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.courseNumber} - {course.name}
                </option>
              ))}
            </select>
            {selectedCourse && (
              <Button
                onClick={() => fetchDocuments(true)}
                disabled={loadingState.state === LoadingState.LOADING}
                variant="primary"
                size="sm"
              >
                {loadingState.state === LoadingState.LOADING
                  ? t("loading")
                  : t("refresh")}
              </Button>
            )}
          </div>
        }
      />

      {selectedCourse && (
        <InfoBanner variant="info">
          <div>
            <strong>{selectedCourse.name}</strong>
            <div className="mt-2 text-sm">
              <strong>Teacher:</strong> {selectedCourse.teacherName} •{" "}
              <strong>Course Code:</strong> {selectedCourse.courseNumber}
            </div>
          </div>
        </InfoBanner>
      )}

      {/* Loading Progress */}
      {loadingState.state === LoadingState.LOADING && loadingState.progress && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">
              {t("loadingDocuments")} ({loadingState.progress.completed}/
              {loadingState.progress.total})
            </span>
            <span className="text-xs text-blue-600">
              {Math.round(
                (loadingState.progress.completed /
                  loadingState.progress.total) *
                  100
              )}
              %
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${(loadingState.progress.completed / loadingState.progress.total) * 100}%`,
              }}
            />
          </div>
          {loadingState.progress.currentItem && (
            <div className="text-xs text-blue-700 mt-1">
              {t("currentlyFetching")}: {loadingState.progress.currentItem}
            </div>
          )}
        </div>
      )}

      {/* Show initial loading when starting to load */}
      {loadingState.state === LoadingState.LOADING &&
        !loadingState.progress && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-center">
              <span className="text-sm font-medium text-blue-800">
                {t("loadingDocuments")}...
              </span>
            </div>
          </div>
        )}

      {selectedCourse && realDocuments.length > 0 && (
        <div className="mb-4 flex gap-3">
          <input
            type="text"
            placeholder="Search documents by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={selectedDocType}
            onChange={(e) =>
              setSelectedDocType(e.target.value as CourseDocumentType | "all")
            }
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">{t("allDocumentTypes")}</option>
            <option value="courseware">{t("electronicCourseware")}</option>
            <option value="experiment_guide">{t("experimentGuide")}</option>
          </select>
        </div>
      )}

      {renderDocumentContent()}
    </Container>
  );
};

export default DocumentList;
