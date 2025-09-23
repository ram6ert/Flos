import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Course, CourseDocument } from "../shared-types";
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
  onCourseSelect: (course: Course) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  selectedCourse,
  courses,
  onCourseSelect,
}) => {
  const { t } = useTranslation();
  const [realDocuments, setRealDocuments] = useState<CourseDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const currentRequestRef = useRef<string | null>(null);

  const fetchDocuments = useCallback(
    async (forceRefresh = false) => {
      if (!selectedCourse) return;

      // Create a unique request ID to track this request
      const requestId = `${selectedCourse.course_num}-${Date.now()}`;
      currentRequestRef.current = requestId;

      try {
        setLoading(true);
        setError("");
        const response = await window.electronAPI.getCourseDocuments(
          selectedCourse.course_num,
          { skipCache: forceRefresh }
        );

        // Check if this request is still the current one
        if (currentRequestRef.current !== requestId) {
          return;
        }

        setRealDocuments(response.data);
      } catch (error) {
        // Don't show error if this is not the current request
        if (currentRequestRef.current !== requestId) {
          return;
        }
        console.error("Failed to fetch documents:", error);
        setError("Failed to fetch course documents. Please try again later.");
      } finally {
        // Only set loading to false if this is still the current request
        if (currentRequestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [selectedCourse]
  );

  useEffect(() => {
    if (selectedCourse) {
      fetchDocuments();
    } else {
      setRealDocuments([]);
    }
  }, [selectedCourse, fetchDocuments]);

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
    setDownloadingDoc(doc.rpId);
    try {
      const fileName = `${doc.rpName}.${doc.extName}`;
      const result = await window.electronAPI.downloadCourseDocument(
        doc.res_url,
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
    if (error) {
      return (
        <ErrorDisplay
          title={t("unableToLoadDocuments")}
          message={error}
          onRetry={() => fetchDocuments(true)}
          retryLabel={t("retry")}
        />
      );
    }

    if (loading) {
      return <Loading message={t("loading")} />;
    }

    if (!selectedCourse) {
      return <p className="text-gray-600">Select a course to view documents.</p>;
    }

    if (realDocuments.length === 0) {
      return <p className="text-gray-600">No documents available for this course.</p>;
    }

    return (
      <div className="flex flex-col gap-3">
        {realDocuments
          .sort((a, b) => a.rpName.localeCompare(b.rpName))
          .map((doc) => (
            <Card key={doc.rpId} padding="lg">
              <div className="flex justify-between items-center w-full">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-3">
                      {getFileIcon(doc.extName)}
                    </span>
                    <h3 className="m-0 text-base text-gray-900 font-semibold">
                      {doc.rpName}
                    </h3>
                    <span className="ml-3 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700 font-medium">
                      {doc.extName.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <p className="m-0">
                      <strong>Size:</strong> {formatFileSize(doc.rpSize)}
                    </p>
                    <p className="m-0">
                      <strong>Uploaded:</strong>{" "}
                      {formatUploadTime(doc.inputTime)}
                    </p>
                    <p className="m-0">
                      <strong>Teacher:</strong> {doc.teacherName}
                    </p>
                    <p className="m-0">
                      <strong>Downloads:</strong> {doc.downloadNum}
                    </p>
                  </div>
                </div>

                <div className="ml-4">
                  <Button
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingDoc === doc.rpId}
                    variant="success"
                    size="sm"
                  >
                    {downloadingDoc === doc.rpId
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
            ? ` - ${selectedCourse.name} (${loading ? "..." : realDocuments.length})`
            : ""
        }`}
        actions={
          <div className="flex gap-3 items-center">
            <select
              value={selectedCourse?.id || ""}
              onChange={(e) => {
                const course = courses.find(
                  (c) => c.id.toString() === e.target.value
                );
                if (course) onCourseSelect(course);
              }}
              className="px-2 py-1 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_num} - {course.name}
                </option>
              ))}
            </select>
            {selectedCourse && (
              <Button
                onClick={() => fetchDocuments(true)}
                disabled={loading}
                variant="primary"
                size="sm"
              >
                {loading ? t("refreshing") : t("refresh")}
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
              <strong>Teacher:</strong> {selectedCourse.teacher_name} •{" "}
              <strong>Course Code:</strong> {selectedCourse.course_num}
            </div>
          </div>
        </InfoBanner>
      )}

      {renderDocumentContent()}
    </Container>
  );
};

export default DocumentList;
