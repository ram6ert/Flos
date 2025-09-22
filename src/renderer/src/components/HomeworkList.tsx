import React, { useEffect, useState, useMemo, useCallback } from "react";
import { HomeworkDetails, HomeworkAttachment } from "../shared-types";
import {
  Container,
  PageHeader,
  Button,
  Card,
  Loading,
  ErrorDisplay,
  InfoBanner,
  cn,
} from "./common/StyledComponents";

interface Homework {
  id: number;
  course_id: number;
  course_name: string;
  title: string;
  content: string;
  end_time: string;
  score: string;
  subStatus: string;
  stu_score: string;
  subTime: string | null;
  submitCount: number;
  allCount: number;
}

interface HomeworkResponse {
  data: Homework[];
  fromCache: boolean;
  age: number;
}

const HomeworkList: React.FC = () => {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "pending" | "submitted" | "graded" | "overdue"
  >("all");
  const [cacheInfo, setCacheInfo] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [expandedHomework, setExpandedHomework] = useState<Set<number>>(
    new Set()
  );
  const [homeworkDetails, setHomeworkDetails] = useState<
    Map<number, HomeworkDetails>
  >(new Map());
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [downloadingAttachment, setDownloadingAttachment] = useState<
    string | null
  >(null);

  const fetchHomework = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const response: HomeworkResponse = forceRefresh
        ? await window.electronAPI.refreshHomework()
        : await window.electronAPI.getHomework();

      if (response.data && Array.isArray(response.data)) {
        setHomework(response.data);

        const ageMinutes = Math.floor(response.age / (1000 * 60));
        setCacheInfo(
          response.fromCache
            ? `Showing cached data (${ageMinutes} minutes old)`
            : "Showing fresh data"
        );
      } else {
        setHomework([]);
        setCacheInfo("No homework data available");
      }
    } catch (error) {
      console.error("Failed to fetch homework:", error);
      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("502")) {
          setError(
            "Please log in to view homework data. Authentication required."
          );
        } else if (error.message.includes("Session expired")) {
          setError("Your session has expired. Please log in again.");
        } else {
          setError("Failed to fetch homework data. Please try again later.");
        }
      } else {
        setError("An unexpected error occurred while fetching homework.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHomework();
  }, [fetchHomework]);

  useEffect(() => {
    const handleCacheUpdate = (
      _event: any,
      payload: { key: string; data: any }
    ) => {
      if (
        payload.key === "all_homework" ||
        payload.key.startsWith("homework_")
      ) {
        if (payload.data && Array.isArray(payload.data)) {
          setHomework(payload.data);
          setCacheInfo("Data updated in background");
        }
      }
    };

    window.electronAPI.onCacheUpdate?.(handleCacheUpdate);

    return () => {
      window.electronAPI.removeAllListeners?.("cache-updated");
    };
  }, []);

  const getStatusColor = (hw: Homework) => {
    const isGraded =
      hw.stu_score !== null &&
      hw.stu_score !== undefined &&
      hw.stu_score !== "未公布成绩";
    const isSubmitted = hw.subStatus === "已提交";

    if (isGraded) return "#28a745"; // green
    if (isSubmitted) return "#007bff"; // blue
    return "#dc3545"; // red for pending
  };

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN");
  };

  const isOverdue = (hw: Homework) => {
    const deadline = new Date(hw.end_time);
    const now = new Date();
    return deadline < now && hw.subStatus !== "已提交";
  };

  const getRemainingTime = (hw: Homework) => {
    const deadline = new Date(hw.end_time);
    const now = new Date();
    const timeDiff = deadline.getTime() - now.getTime();

    if (hw.subStatus === "已提交") {
      return { text: "Submitted", color: "#28a745", isOverdue: false };
    }

    if (timeDiff < 0) {
      const overdueDays = Math.floor(
        Math.abs(timeDiff) / (1000 * 60 * 60 * 24)
      );
      const overdueHours = Math.floor(
        (Math.abs(timeDiff) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      if (overdueDays > 0) {
        return {
          text: `Overdue ${overdueDays}d ${overdueHours}h`,
          color: "#dc3545",
          isOverdue: true,
        };
      } else {
        return {
          text: `Overdue ${overdueHours}h`,
          color: "#dc3545",
          isOverdue: true,
        };
      }
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return {
        text: `${days}d ${hours}h left`,
        color: "#007bff",
        isOverdue: false,
      };
    } else if (hours > 0) {
      return {
        text: `${hours}h ${minutes}m left`,
        color: "#ffc107",
        isOverdue: false,
      };
    } else {
      return { text: `${minutes}m left`, color: "#dc3545", isOverdue: false };
    }
  };

  const translateStatus = (chineseStatus: string) => {
    switch (chineseStatus) {
      case "已提交":
        return "Submitted";
      case "未提交":
        return "Not Submitted";
      case "已批改":
        return "Graded";
      default:
        return chineseStatus;
    }
  };

  const translateScore = (chineseScore: string) => {
    switch (chineseScore) {
      case "未公布成绩":
        return "Grade not published";
      case "暂未公布":
        return "Not published yet";
      default:
        return chineseScore;
    }
  };

  const fetchHomeworkDetails = async (
    homeworkId: number,
    courseId: number,
    teacherId?: string
  ) => {
    setDetailsLoading(true);
    try {
      // We need to extract teacher ID from homework data or make an assumption
      // For now, we'll use a default or extract from existing data
      const response = await window.electronAPI.getHomeworkDetails(
        homeworkId.toString(),
        courseId.toString(),
        teacherId || "0" // Default teacher ID if not available
      );
      const newDetails = new Map(homeworkDetails);
      newDetails.set(homeworkId, response.data.homeWork);
      setHomeworkDetails(newDetails);
    } catch (error) {
      console.error("Failed to fetch homework details:", error);
      setError("Failed to load homework details. Please try again.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleToggleDetails = async (hw: Homework) => {
    if (expandedHomework.has(hw.id)) {
      // Collapse
      const newExpanded = new Set(expandedHomework);
      newExpanded.delete(hw.id);
      setExpandedHomework(newExpanded);
      const newDetails = new Map(homeworkDetails);
      newDetails.delete(hw.id);
      setHomeworkDetails(newDetails);
    } else {
      // Expand
      const newExpanded = new Set(expandedHomework);
      newExpanded.add(hw.id);
      setExpandedHomework(newExpanded);
      await fetchHomeworkDetails(hw.id, hw.course_id);
    }
  };

  const handleDownloadAttachment = async (attachment: HomeworkAttachment) => {
    setDownloadingAttachment(attachment.url);
    try {
      const result = await window.electronAPI.downloadHomeworkAttachment(
        attachment.url,
        `${attachment.file_name}.${getFileExtension(attachment.url)}`
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
          a.download = `${attachment.file_name}.${getFileExtension(attachment.url)}`;
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
      setDownloadingAttachment(null);
    }
  };

  const getFileExtension = (url: string) => {
    const match = url.match(/\.([^.]+)$/);
    return match ? match[1] : "unknown";
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const sanitizeContent = (content: string) => {
    if (!content) return "";

    // Check if content contains images and replace them with bolded text
    let sanitized = content;

    // Replace img tags with placeholder text
    sanitized = sanitized.replace(/<img[^>]*>/gi, () => {
      return "**[Image removed for security]**";
    });

    // Basic HTML sanitization - remove script tags and other HTML
    sanitized = sanitized
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    return sanitized;
  };

  const renderContentWithBold = (content: string) => {
    // Split by **text** patterns and render bold text
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const boldText = part.slice(2, -2);
        return (
          <strong key={index} style={{ color: "#dc3545" }}>
            {boldText}
          </strong>
        );
      }
      return part;
    });
  };

  const [sortBy, setSortBy] = useState<
    "due_date" | "course" | "status" | "remaining_time"
  >("remaining_time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredAndSortedHomework = useMemo(() => {
    return homework
      .filter((hw) => {
        const isGraded = hw.stu_score !== "未公布成绩" && hw.stu_score !== "";
        const isSubmitted = hw.subStatus === "已提交";
        const hwIsOverdue = isOverdue(hw);

        switch (filter) {
          case "pending":
            return !isSubmitted && !isGraded && !hwIsOverdue;
          case "submitted":
            return isSubmitted && !isGraded;
          case "graded":
            return isGraded;
          case "overdue":
            return hwIsOverdue && !isSubmitted;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "due_date":
            comparison =
              new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
            break;
          case "course":
            comparison = a.course_name.localeCompare(b.course_name);
            break;
          case "status":
            comparison = a.subStatus.localeCompare(b.subStatus);
            break;
          case "remaining_time":
            const nowTime = new Date().getTime();
            const timeA = new Date(a.end_time).getTime() - nowTime;
            const timeB = new Date(b.end_time).getTime() - nowTime;

            const isOverdueA = timeA < 0 && a.subStatus !== "已提交";
            const isOverdueB = timeB < 0 && b.subStatus !== "已提交";
            const isSubmittedA = a.subStatus === "已提交";
            const isSubmittedB = b.subStatus === "已提交";

            if (isSubmittedA && !isSubmittedB) return 1;
            if (!isSubmittedA && isSubmittedB) return -1;

            if (isOverdueA && !isOverdueB) return -1;
            if (!isOverdueA && isOverdueB) return 1;

            comparison = Math.abs(timeA) - Math.abs(timeB);
            break;
          default:
            comparison = 0;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [homework, filter, sortBy, sortOrder]);

  if (loading) {
    return (
      <Container padding="lg">
        <Loading message="Loading homework..." />
      </Container>
    );
  }

  if (error) {
    return (
      <Container padding="lg">
        <ErrorDisplay
          title="Unable to Load Homework"
          message={error}
          onRetry={() => fetchHomework(true)}
          retryLabel={refreshing ? "Retrying..." : loading ? "Loading..." : "Retry"}
        />
      </Container>
    );
  }

  return (
    <Container padding="lg">
      <PageHeader
        title={`Homework (${filteredAndSortedHomework.length})`}
        actions={
          <Button
            onClick={() => fetchHomework(true)}
            disabled={loading || refreshing}
            variant="primary"
            size="sm"
          >
            {refreshing ? "Refreshing..." : loading ? "Loading..." : "Refresh"}
          </Button>
        }
      />

      {cacheInfo && (
        <InfoBanner variant="info">
          {cacheInfo}
        </InfoBanner>
      )}

      <div className="mb-6">
        <div className="mb-4">
          <strong className="mr-3">Filter: </strong>
          {["all", "pending", "submitted", "graded", "overdue"].map(
            (filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType as any)}
                className={cn(
                  "px-3 py-1.5 mr-2 border border-gray-300 rounded-md cursor-pointer text-sm font-medium transition-colors",
                  filter === filterType
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                )}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          <strong>Sort by: </strong>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="remaining_time">Remaining Time</option>
            <option value="due_date">Due Date</option>
            <option value="course">Course</option>
            <option value="status">Status</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {filteredAndSortedHomework.length === 0 ? (
        <p className="text-gray-600">No homework found for the selected filter.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredAndSortedHomework.map((hw) => {
            const remainingTime = getRemainingTime(hw);
            const statusColor = getStatusColor(hw);
            return (
              <Card
                key={hw.id}
                padding="lg"
                className={cn(
                  "border-l-4",
                  remainingTime.isOverdue && "bg-red-50"
                )}
                style={{ borderLeftColor: statusColor }}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="m-0 flex-1 text-lg font-semibold text-gray-900">{hw.title}</h3>
                  <div
                    className="font-bold text-sm text-right min-w-30"
                    style={{ color: remainingTime.color }}
                  >
                    {remainingTime.text}
                  </div>
                </div>

                {sanitizeContent(hw.content) && (
                  <p
                    style={{
                      margin: "0 0 12px 0",
                      color: "#555",
                      fontSize: "14px",
                      lineHeight: "1.4",
                    }}
                  >
                    {renderContentWithBold(sanitizeContent(hw.content))}
                  </p>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    fontSize: "13px",
                  }}
                >
                  <p style={{ margin: "0" }}>
                    <strong>Course:</strong> {hw.course_name}
                  </p>
                  <p style={{ margin: "0" }}>
                    <strong>Max Score:</strong> {hw.score}
                  </p>
                  <p style={{ margin: "0" }}>
                    <strong>Due:</strong> {formatDeadline(hw.end_time)}
                  </p>
                  <p style={{ margin: "0" }}>
                    <strong>Status:</strong>{" "}
                    <span style={{ color: getStatusColor(hw) }}>
                      {translateStatus(hw.subStatus)}
                    </span>
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    fontSize: "13px",
                    marginTop: "8px",
                  }}
                >
                  <p style={{ margin: "0" }}>
                    <strong>Submitted:</strong> {hw.submitCount}/{hw.allCount}{" "}
                    students
                  </p>
                  <p style={{ margin: "0" }}>
                    <strong>Grade:</strong> {translateScore(hw.stu_score)}
                  </p>
                </div>

                {hw.subTime && (
                  <p
                    style={{
                      margin: "8px 0 0 0",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    <strong>Submitted at:</strong> {formatDeadline(hw.subTime)}
                  </p>
                )}

                {/* View Details Button */}
                <div
                  style={{
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid #eee",
                  }}
                >
                  <button
                    onClick={() => handleToggleDetails(hw)}
                    disabled={detailsLoading && expandedHomework.has(hw.id)}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: expandedHomework.has(hw.id)
                        ? "#dc3545"
                        : "#007bff",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    {detailsLoading && expandedHomework.has(hw.id)
                      ? "Loading..."
                      : expandedHomework.has(hw.id)
                        ? "Hide Details"
                        : "View Details"}
                  </button>
                </div>

                {/* Expanded Details View */}
                {expandedHomework.has(hw.id) && homeworkDetails.get(hw.id) && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "16px",
                      backgroundColor: "#f8f9fa",
                      borderRadius: "8px",
                      border: "1px solid #dee2e6",
                    }}
                  >
                    <h4 style={{ margin: "0 0 12px 0", color: "#495057" }}>
                      Homework Details
                    </h4>

                    {(() => {
                      const details = homeworkDetails.get(hw.id)!;
                      return (
                        <>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "12px",
                              fontSize: "14px",
                              marginBottom: "16px",
                            }}
                          >
                            <p style={{ margin: "0" }}>
                              <strong>Created:</strong>{" "}
                              {new Date(details.create_date).toLocaleString()}
                            </p>
                            <p style={{ margin: "0" }}>
                              <strong>Open Date:</strong>{" "}
                              {new Date(details.open_date).toLocaleString()}
                            </p>
                            {details.is_publish_answer === "1" && (
                              <p style={{ margin: "0" }}>
                                <strong>Answer:</strong> {details.ref_answer}
                              </p>
                            )}
                            <p style={{ margin: "0" }}>
                              <strong>Repeat Allowed:</strong>{" "}
                              {details.is_repeat ? "Yes" : "No"}
                            </p>
                          </div>

                          {/* Detailed Content */}
                          {details.content &&
                            sanitizeContent(details.content) && (
                              <div style={{ marginBottom: "16px" }}>
                                <h5
                                  style={{
                                    margin: "0 0 8px 0",
                                    color: "#495057",
                                  }}
                                >
                                  Full Description:
                                </h5>
                                <div
                                  style={{
                                    padding: "12px",
                                    backgroundColor: "#ffffff",
                                    borderRadius: "4px",
                                    border: "1px solid #dee2e6",
                                    fontSize: "14px",
                                    lineHeight: "1.5",
                                  }}
                                >
                                  {renderContentWithBold(
                                    sanitizeContent(details.content)
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Attachments */}
                          {details.url && (
                            <div style={{ marginBottom: "16px" }}>
                              <h5
                                style={{
                                  margin: "0 0 12px 0",
                                  color: "#495057",
                                }}
                              >
                                Attachments:
                              </h5>
                              <div
                                style={{
                                  padding: "12px",
                                  backgroundColor: "#ffffff",
                                  borderRadius: "4px",
                                  border: "1px solid #dee2e6",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    📎 {details.file_name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      color: "#6c757d",
                                    }}
                                  >
                                    Size: {formatFileSize(details.pic_size)}
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    handleDownloadAttachment({
                                      id: details.id,
                                      url: details.url,
                                      file_name: details.file_name,
                                      convert_url: details.convert_url,
                                      pic_size: details.pic_size,
                                    })
                                  }
                                  disabled={
                                    downloadingAttachment === details.url
                                  }
                                  style={{
                                    padding: "6px 12px",
                                    backgroundColor:
                                      downloadingAttachment === details.url
                                        ? "#ccc"
                                        : "#28a745",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor:
                                      downloadingAttachment === details.url
                                        ? "not-allowed"
                                        : "pointer",
                                    fontSize: "12px",
                                  }}
                                >
                                  {downloadingAttachment === details.url
                                    ? "Downloading..."
                                    : "Download"}
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
};

export default HomeworkList;
