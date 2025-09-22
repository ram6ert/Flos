import React, { useEffect, useState, useCallback } from "react";
import { Course, CourseDocument } from "../shared-types";

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
  const [realDocuments, setRealDocuments] = useState<CourseDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCourse) {
      fetchDocuments();
    } else {
      setRealDocuments([]);
    }
  }, [selectedCourse, fetchDocuments]);

  const fetchDocuments = useCallback(async (forceRefresh = false) => {
    if (!selectedCourse) return;

    try {
      setLoading(true);
      setError("");
      const response = await window.electronAPI.getCourseDocuments(
        selectedCourse.course_num,
        { skipCache: forceRefresh }
      );
      setRealDocuments(response.data);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      setError("Failed to fetch course documents. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [selectedCourse]);

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

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading documents...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "20px" }}>
        <div
          style={{
            padding: "16px",
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: "4px",
            color: "#721c24",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 8px 0" }}>Unable to Load Documents</h3>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
        <button
          onClick={() => fetchDocuments(true)}
          style={{
            padding: "8px 16px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2>
          Documents{" "}
          {selectedCourse
            ? `- ${selectedCourse.name} (${realDocuments.length})`
            : ""}
        </h2>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <select
            value={selectedCourse?.id || ""}
            onChange={(e) => {
              const course = courses.find(
                (c) => c.id.toString() === e.target.value
              );
              if (course) onCourseSelect(course);
            }}
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ddd",
            }}
          >
            <option value="">Select a course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.course_num} - {course.name}
              </option>
            ))}
          </select>
          {selectedCourse && (
            <button
              onClick={() => fetchDocuments(true)}
              disabled={loading}
              style={{
                padding: "8px 16px",
                backgroundColor: loading ? "#ccc" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          )}
        </div>
      </div>

      {selectedCourse && (
        <div
          style={{
            marginBottom: "20px",
            padding: "16px",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ margin: "0 0 8px 0" }}>{selectedCourse.name}</h3>
          <p style={{ margin: "0", color: "#666" }}>
            <strong>Teacher:</strong> {selectedCourse.teacher_name} •{" "}
            <strong>Course Code:</strong> {selectedCourse.course_num}
          </p>
        </div>
      )}

      {!selectedCourse ? (
        <p>Select a course to view documents.</p>
      ) : realDocuments.length === 0 ? (
        <p>No documents available for this course.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {realDocuments
            .sort((a, b) => a.rpName.localeCompare(b.rpName))
            .map((doc) => (
              <div
                key={doc.rpId}
                style={{
                  border: "1px solid #ddd",
                  padding: "16px",
                  borderRadius: "8px",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontSize: "24px", marginRight: "12px" }}>
                      {getFileIcon(doc.extName)}
                    </span>
                    <h3 style={{ margin: 0, fontSize: "16px", color: "#333" }}>
                      {doc.rpName}
                    </h3>
                    <span
                      style={{
                        marginLeft: "12px",
                        padding: "2px 8px",
                        backgroundColor: "#e9ecef",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "#495057",
                      }}
                    >
                      {doc.extName.toUpperCase()}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      fontSize: "13px",
                      color: "#666",
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      <strong>Size:</strong> {formatFileSize(doc.rpSize)}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Uploaded:</strong>{" "}
                      {formatUploadTime(doc.inputTime)}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Teacher:</strong> {doc.teacherName}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Downloads:</strong> {doc.downloadNum}
                    </p>
                  </div>
                </div>

                <div style={{ marginLeft: "16px" }}>
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingDoc === doc.rpId}
                    style={{
                      padding: "8px 16px",
                      backgroundColor:
                        downloadingDoc === doc.rpId ? "#ccc" : "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor:
                        downloadingDoc === doc.rpId ? "not-allowed" : "pointer",
                      fontSize: "14px",
                    }}
                  >
                    {downloadingDoc === doc.rpId
                      ? "Downloading..."
                      : "Download"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default DocumentList;
