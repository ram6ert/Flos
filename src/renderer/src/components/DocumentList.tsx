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
  Input,
  Card,
  Loading,
  ErrorDisplay,
  InfoBanner,
} from "./common/StyledComponents";

interface DocumentListProps {
  documents: CourseDocument[] | null;
  setDocuments: React.Dispatch<React.SetStateAction<CourseDocument[] | null>>;
  selectedCourse: Course | null;
  courses: Course[] | null;
  onCourseSelect: (course: Course | null) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  selectedCourse,
  documents,
  setDocuments,
  courses,
  onCourseSelect,
}) => {
  const { t } = useTranslation();
  const [loadingState, setLoadingState] = useState<LoadingStateData>({
    state: LoadingState.IDLE,
  });
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDocType, setSelectedDocType] = useState<
    CourseDocumentType | "all"
  >("all");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [batchDownloading, setBatchDownloading] = useState(false);

  // Simple race condition protection - tracks current request
  const currentRequestIdRef = useRef<string | null>(null);

  // Handler functions for document streaming events
  const handleDocumentStreamChunk = useCallback(
    (_event: any, chunk: DocumentStreamChunk & { responseId?: string }) => {
      // Check if this chunk is from the current request
      if (chunk.responseId && currentRequestIdRef.current) {
        if (chunk.responseId !== currentRequestIdRef.current) {
          console.log("Ignoring document chunk from outdated request");
          return;
        }
      }

      // If streaming data, append to existing documents
      setDocuments((prev) => {
        const newDocs = [...(prev || []), ...chunk.documents];
        // Remove duplicates based on document ID
        const uniqueDocs = newDocs.filter(
          (doc, index, arr) => arr.findIndex((d) => d.id === doc.id) === index
        );
        return uniqueDocs;
      });
    },
    [setDocuments]
  );

  const handleDocumentStreamProgress = useCallback(
    (
      _event: any,
      progress: DocumentStreamProgress & { responseId?: string }
    ) => {
      // Check if this progress is from the current request
      if (progress.responseId && currentRequestIdRef.current) {
        if (progress.responseId !== currentRequestIdRef.current) {
          console.log("Ignoring document progress from outdated request");
          return;
        }
      }

      setLoadingState({
        state: LoadingState.LOADING,
        progress: {
          completed: progress.completed,
          total: progress.total,
          currentItem: progress.currentCourse,
        },
      });
    },
    []
  );

  const handleDocumentStreamComplete = useCallback(
    (_event: any, payload: { courseId?: string; responseId?: string }) => {
      // Check if this completion is from the current request
      if (payload.responseId && currentRequestIdRef.current) {
        if (payload.responseId !== currentRequestIdRef.current) {
          console.log("Ignoring document completion from outdated request");
          return;
        }
      }

      setLoadingState({ state: LoadingState.SUCCESS });
      // Don't clear currentRequestIdRef.current here - let the next request handle it
      // This prevents issues with late events or immediate subsequent requests
    },
    []
  );

  const handleDocumentStreamError = useCallback(
    (_event: any, errorData: { error: string; responseId?: string }) => {
      // Check if this error is from the current request
      if (errorData.responseId && currentRequestIdRef.current) {
        if (errorData.responseId !== currentRequestIdRef.current) {
          console.log("Ignoring document error from outdated request");
          return;
        }
      }

      console.error("Document streaming error:", errorData.error);
      setLoadingState({
        state: LoadingState.ERROR,
        error: `Failed to fetch documents: ${errorData.error}`,
      });
      // Don't clear currentRequestIdRef.current here either - let the next request handle it
    },
    []
  );

  const handleDocumentRefreshStart = useCallback(
    (_event: any, _payload: any) => {
      // Clear current documents for refresh (loading state already set by fetchDocuments)
      setDocuments([]);
    },
    [setDocuments]
  );

  const fetchDocuments = useCallback(
    async (forceRefresh = false) => {
      if (!selectedCourse) return;

      // Generate unique request ID for this fetch and set it IMMEDIATELY
      const requestId = `${selectedCourse.courseNumber}-${Date.now()}-${Math.random()}`;

      // Set the request ID BEFORE making any API calls
      currentRequestIdRef.current = requestId;
      console.log("Starting document fetch with request ID:", requestId);

      // Set loading state BEFORE API call so events can start arriving
      setLoadingState({ state: LoadingState.LOADING });
      setDocuments(null); // Clear existing documents for streaming

      try {
        if (forceRefresh) {
          await window.electronAPI.refreshDocuments(
            selectedCourse.courseNumber,
            {
              requestId: requestId,
            }
          );
        } else {
          // Start streaming for this specific course (will fetch all document types)
          await window.electronAPI.streamDocuments(
            selectedCourse.courseNumber,
            {
              requestId: requestId,
            }
          );
        }
      } catch (error) {
        // Only handle error if this is still the current request
        if (currentRequestIdRef.current === requestId) {
          console.error("Failed to fetch documents:", error);
          setLoadingState({
            state: LoadingState.ERROR,
            error: "Failed to fetch course documents. Please try again later.",
          });
        }
      }
    },
    [selectedCourse, setDocuments]
  );

  useEffect(() => {
    if (selectedCourse) {
      fetchDocuments(false); // Always fetch when course changes - fetchDocuments will handle request ID
    } else {
      // Cancel any ongoing request
      currentRequestIdRef.current = null;
      setDocuments(null);
      setLoadingState({ state: LoadingState.IDLE });
    }
  }, [selectedCourse, fetchDocuments, setDocuments]);

  // Set up event listeners and cleanup on unmount
  useEffect(() => {
    // Set up event listeners
    window.electronAPI.onDocumentStreamChunk?.(handleDocumentStreamChunk);
    window.electronAPI.onDocumentStreamProgress?.(handleDocumentStreamProgress);
    window.electronAPI.onDocumentStreamComplete?.(handleDocumentStreamComplete);
    window.electronAPI.onDocumentStreamError?.(handleDocumentStreamError);
    window.electronAPI.onDocumentRefreshStart?.(handleDocumentRefreshStart);

    return () => {
      // Clean up event listeners
      window.electronAPI.removeAllListeners?.("document-stream-chunk");
      window.electronAPI.removeAllListeners?.("document-stream-progress");
      window.electronAPI.removeAllListeners?.("document-stream-complete");
      window.electronAPI.removeAllListeners?.("document-stream-error");
      window.electronAPI.removeAllListeners?.("document-refresh-start");
    };
  }, [
    handleDocumentStreamChunk,
    handleDocumentStreamProgress,
    handleDocumentStreamComplete,
    handleDocumentStreamError,
    handleDocumentRefreshStart,
  ]);

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
      const result = await window.electronAPI.downloadAddTask({
        type: "document",
        url: doc.resourceUrl,
        fileName: fileName,
        metadata: {
          courseId: selectedCourse?.courseNumber,
          courseName: selectedCourse?.name,
          documentId: doc.id,
        },
        autoStart: true,
      });

      if (!result.success) {
        alert(`Download failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed. Please try again.");
    } finally {
      setDownloadingDoc(null);
    }
  };

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!documents) return;

    const filteredDocuments = documents.filter((doc) => {
      const matchesSearch = doc.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType =
        selectedDocType === "all" || doc.documentType === selectedDocType;
      return matchesSearch && matchesType;
    });

    if (selectedDocs.size === filteredDocuments.length) {
      // Deselect all
      setSelectedDocs(new Set());
    } else {
      // Select all filtered documents
      setSelectedDocs(new Set(filteredDocuments.map((doc) => doc.id)));
    }
  }, [documents, searchTerm, selectedDocType, selectedDocs.size]);

  const handleBatchDownload = useCallback(async () => {
    if (selectedDocs.size === 0) {
      alert(
        t("selectDocumentsFirst") || "Please select documents to download."
      );
      return;
    }

    setBatchDownloading(true);
    try {
      // Show folder selection dialog
      const folderResult = await window.electronAPI.selectDownloadFolder();

      if (
        !folderResult.success ||
        folderResult.canceled ||
        !folderResult.folderPath
      ) {
        setBatchDownloading(false);
        return;
      }

      const folderPath = folderResult.folderPath;
      const selectedDocsList = documents?.filter((doc) =>
        selectedDocs.has(doc.id)
      );

      if (!selectedDocsList || selectedDocsList.length === 0) {
        setBatchDownloading(false);
        return;
      }

      // Add all selected documents to download center in parallel
      const downloadPromises = selectedDocsList.map(async (doc) => {
        const fileName = `${doc.name}.${doc.fileExtension}`;
        const savePath = `${folderPath}/${fileName}`;

        return window.electronAPI.downloadAddTask({
          type: "document",
          url: doc.resourceUrl,
          fileName: fileName,
          savePath: savePath,
          metadata: {
            courseId: selectedCourse?.courseNumber,
            courseName: selectedCourse?.name,
            documentId: doc.id,
          },
          autoStart: true,
        });
      });

      const results = await Promise.allSettled(downloadPromises);

      let successCount = 0;
      let failCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          failCount++;
          const doc = selectedDocsList[index];
          const error = result.status === 'fulfilled' ? result.value.error : result.reason;
          console.error(`Failed to add download task for ${doc.name}:`, error);
        }
      });

      // Clear selection after batch download
      setSelectedDocs(new Set());

      // Show result
      if (failCount != 0) {
        alert(
          t("batchDownloadPartial") ||
            `Added ${successCount} documents to download center. ${failCount} failed.`
        );
      }
    } catch (error) {
      console.error("Batch download error:", error);
      alert(
        t("batchDownloadFailed") || "Batch download failed. Please try again."
      );
    } finally {
      setBatchDownloading(false);
    }
  }, [selectedDocs, documents, selectedCourse, t]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when a course is selected and documents exist
      if (!selectedCourse || !documents || documents.length === 0) return;

      // Cmd-A or Ctrl-A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        toggleSelectAll();
      }

      // Cmd-S or Ctrl-S: Batch download (if documents are selected)
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (selectedDocs.size > 0 && !batchDownloading) {
          handleBatchDownload();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedCourse,
    documents,
    selectedDocs,
    batchDownloading,
    toggleSelectAll,
    handleBatchDownload,
  ]);

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

    if (documents && documents.length === 0) {
      return (
        <p className="text-gray-600">No documents available for this course.</p>
      );
    }

    const filteredDocuments = (documents || []).filter((doc) => {
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
                <div className="flex items-center mr-3">
                  <input
                    type="checkbox"
                    checked={selectedDocs.has(doc.id)}
                    onChange={() => toggleDocSelection(doc.id)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>
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
            ? ` - ${selectedCourse.name} (${loadingState.state === LoadingState.LOADING ? "..." : documents?.length || 0})`
            : ""
        }`}
        actions={
          <div className="flex gap-3 items-center">
            <select
              value={
                (courses || []).some((c) => c.id === (selectedCourse?.id || ""))
                  ? selectedCourse?.id || ""
                  : ""
              }
              onChange={(e) => {
                if (e.target.value === "") {
                  onCourseSelect(null);
                  return;
                }
                const course = (courses || []).find(
                  (c) => c.id === e.target.value
                );
                if (course) onCourseSelect(course);
              }}
              className="px-2 py-1 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("selectCourse") || "Select a course"}</option>
              {(courses || []).map((course) => (
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

      {selectedCourse && (documents?.length || 0) > 0 && (
        <>
          <div className="mb-4 flex gap-3">
            <Input
              type="text"
              placeholder="Search documents by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
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
          <div className="mb-4 flex gap-3 items-center">
            <Button onClick={toggleSelectAll} variant="secondary" size="sm">
              {selectedDocs.size > 0
                ? t("clearSelection") || "Clear Selection"
                : t("selectAll") || "Select All"}
            </Button>
            {selectedDocs.size > 0 && (
              <span className="text-sm text-gray-600">
                {selectedDocs.size} {t("selected") || "selected"}
              </span>
            )}
            {selectedDocs.size > 0 && (
              <Button
                onClick={handleBatchDownload}
                disabled={batchDownloading}
                variant="primary"
                size="sm"
              >
                {batchDownloading
                  ? t("processing") || "Processing..."
                  : t("batchDownload") || "Batch Download"}
              </Button>
            )}
          </div>
        </>
      )}

      {renderDocumentContent()}
    </Container>
  );
};

export default DocumentList;
