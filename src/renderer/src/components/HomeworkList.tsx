import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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

  const isFetchingRef = useRef(false);

  const fetchHomework = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate requests
    if (isFetchingRef.current) {
      console.log(
        "Homework fetch already in progress, skipping duplicate request"
      );
      return;
    }

    try {
      isFetchingRef.current = true;
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
            ? t("showingCachedData", { minutes: ageMinutes })
            : t("showingFreshData")
        );
      } else {
        setHomework([]);
        setCacheInfo(t("noHomeworkDataAvailable"));
      }
    } catch (error) {
      console.error("Failed to fetch homework:", error);
      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("502")) {
          setError(t("authenticationRequired"));
        } else if (error.message.includes("Session expired")) {
          setError(t("sessionExpired"));
        } else {
          setError(t("failedToFetchHomework"));
        }
      } else {
        setError(t("unexpectedError"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
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
          setCacheInfo(t("dataUpdatedInBackground"));
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
      return { text: t("submitted"), color: "#28a745", isOverdue: false };
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
          text: t("overdueDaysHours", {
            days: overdueDays,
            hours: overdueHours,
          }),
          color: "#dc3545",
          isOverdue: true,
        };
      } else {
        return {
          text: t("overdueHours", { hours: overdueHours }),
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
        text: t("daysHoursLeft", { days, hours }),
        color: "#007bff",
        isOverdue: false,
      };
    } else if (hours > 0) {
      return {
        text: t("hoursMinutesLeft", { hours, minutes }),
        color: "#ffc107",
        isOverdue: false,
      };
    } else {
      return {
        text: t("minutesLeft", { minutes }),
        color: "#dc3545",
        isOverdue: false,
      };
    }
  };

  const translateStatus = (chineseStatus: string) => {
    switch (chineseStatus) {
      case "已提交":
        return t("submitted");
      case "未提交":
        return t("notSubmitted");
      case "已批改":
        return t("graded");
      default:
        return chineseStatus;
    }
  };

  const translateScore = (chineseScore: string) => {
    switch (chineseScore) {
      case "未公布成绩":
        return t("gradeNotPublished");
      case "暂未公布":
        return t("notPublishedYet");
      default:
        return chineseScore;
    }
  };

  const [fetchingDetails, setFetchingDetails] = useState<Set<number>>(
    new Set()
  );

  const fetchHomeworkDetails = async (
    homeworkId: number,
    courseId: number,
    teacherId?: string
  ) => {
    // Prevent duplicate detail fetches
    if (fetchingDetails.has(homeworkId)) {
      console.log(
        `Homework details fetch already in progress for ID ${homeworkId}, skipping duplicate request`
      );
      return;
    }

    setDetailsLoading(true);
    const newFetching = new Set(fetchingDetails);
    newFetching.add(homeworkId);
    setFetchingDetails(newFetching);

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
      setError(t("failedToLoadHomeworkDetails"));
    } finally {
      setDetailsLoading(false);
      const newFetching = new Set(fetchingDetails);
      newFetching.delete(homeworkId);
      setFetchingDetails(newFetching);
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

    let sanitized = content;

    // Remove dangerous elements first
    sanitized = sanitized
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<link[^>]*>/gi, "")
      .replace(/<meta[^>]*>/gi, "");

    // Replace img tags with placeholder text
    sanitized = sanitized.replace(/<img[^>]*>/gi, "**[Image removed for security]**");

    // Preserve formatting by converting common HTML tags to text equivalents
    sanitized = sanitized
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<\/div>/gi, "\n")
      .replace(/<div[^>]*>/gi, "")
      .replace(/<h[1-6][^>]*>/gi, "\n**")
      .replace(/<\/h[1-6]>/gi, "**\n")
      .replace(/<strong[^>]*>/gi, "**")
      .replace(/<\/strong>/gi, "**")
      .replace(/<b[^>]*>/gi, "**")
      .replace(/<\/b>/gi, "**")
      .replace(/<em[^>]*>/gi, "*")
      .replace(/<\/em>/gi, "*")
      .replace(/<i[^>]*>/gi, "*")
      .replace(/<\/i>/gi, "*")
      .replace(/<ul[^>]*>/gi, "\n")
      .replace(/<\/ul>/gi, "\n")
      .replace(/<ol[^>]*>/gi, "\n")
      .replace(/<\/ol>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/li>/gi, "\n");

    // Remove any remaining HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, "");

    // Decode HTML entities
    sanitized = sanitized
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&hellip;/g, "...")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–");

    // Clean up excessive whitespace
    sanitized = sanitized
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();

    return sanitized;
  };

  const renderContentWithBold = (content: string) => {
    // Split by **text** patterns and render bold text
    // whitespace-pre-wrap CSS class handles newlines automatically
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const boldText = part.slice(2, -2);
        return (
          <strong key={index} className="text-red-600">
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
        <Loading message={t("loadingHomework")} />
      </Container>
    );
  }

  if (error) {
    return (
      <Container padding="lg">
        <ErrorDisplay
          title={t("unableToLoadHomework")}
          message={error}
          onRetry={() => fetchHomework(true)}
          retryLabel={
            refreshing ? t("refreshing") : loading ? t("loading") : t("retry")
          }
        />
      </Container>
    );
  }

  return (
    <Container padding="lg">
      <PageHeader
        title={`${t("homework")} (${filteredAndSortedHomework.length})`}
        actions={
          <Button
            onClick={() => fetchHomework(true)}
            disabled={loading || refreshing}
            variant="primary"
            size="sm"
          >
            {refreshing
              ? t("refreshing")
              : loading
                ? t("loading")
                : t("refresh")}
          </Button>
        }
      />

      {cacheInfo && <InfoBanner variant="info">{cacheInfo}</InfoBanner>}

      <div className="mb-6">
        <div className="mb-4">
          <strong className="mr-3">{t("filter")}: </strong>
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
                {t(filterType)}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          <strong>{t("sortBy")}: </strong>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="remaining_time">{t("remainingTime")}</option>
            <option value="due_date">{t("dueDate")}</option>
            <option value="course">{t("course")}</option>
            <option value="status">{t("status")}</option>
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
        <p className="text-gray-600">{t("noHomeworkFound")}</p>
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
                  <h3 className="m-0 flex-1 text-lg font-semibold text-gray-900">
                    {hw.title}
                  </h3>
                  <div
                    className="font-bold text-sm text-right min-w-30"
                    style={{ color: remainingTime.color }}
                  >
                    {remainingTime.text}
                  </div>
                </div>

                {sanitizeContent(hw.content) && (
                  <div className="mb-3 text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                    {renderContentWithBold(sanitizeContent(hw.content))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p className="m-0">
                    <strong>{t("course")}:</strong> {hw.course_name}
                  </p>
                  <p className="m-0">
                    <strong>{t("maxScore")}:</strong> {hw.score}
                  </p>
                  <p className="m-0">
                    <strong>{t("due")}:</strong> {formatDeadline(hw.end_time)}
                  </p>
                  <p className="m-0">
                    <strong>{t("status")}:</strong>{" "}
                    <span style={{ color: getStatusColor(hw) }}>
                      {translateStatus(hw.subStatus)}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <p className="m-0">
                    <strong>{t("submitted")}:</strong> {hw.submitCount}/
                    {hw.allCount} {t("students")}
                  </p>
                  <p className="m-0">
                    <strong>{t("grade")}:</strong>{" "}
                    {translateScore(hw.stu_score)}
                  </p>
                </div>

                {hw.subTime && (
                  <p className="mt-2 text-xs text-gray-500">
                    <strong>{t("submittedAt")}:</strong>{" "}
                    {formatDeadline(hw.subTime)}
                  </p>
                )}

                {/* View Details Button */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleToggleDetails(hw)}
                    disabled={detailsLoading && expandedHomework.has(hw.id)}
                    className={cn(
                      "px-4 py-2 text-white border-none rounded cursor-pointer text-sm transition-colors",
                      expandedHomework.has(hw.id)
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-blue-600 hover:bg-blue-700",
                      detailsLoading &&
                        expandedHomework.has(hw.id) &&
                        "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {detailsLoading && expandedHomework.has(hw.id)
                      ? t("loading")
                      : expandedHomework.has(hw.id)
                        ? t("hideDetails")
                        : t("viewDetails")}
                  </button>
                </div>

                {/* Expanded Details View */}
                {expandedHomework.has(hw.id) && homeworkDetails.get(hw.id) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-300">
                    <h4 className="mb-3 text-gray-700">
                      {t("homeworkDetails")}
                    </h4>

                    {(() => {
                      const details = homeworkDetails.get(hw.id)!;
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                            <p className="m-0">
                              <strong>{t("created")}:</strong>{" "}
                              {new Date(details.create_date).toLocaleString()}
                            </p>
                            <p className="m-0">
                              <strong>{t("openDate")}:</strong>{" "}
                              {new Date(details.open_date).toLocaleString()}
                            </p>
                            {details.is_publish_answer === "1" && (
                              <p className="m-0">
                                <strong>{t("answer")}:</strong>{" "}
                                {details.ref_answer}
                              </p>
                            )}
                            <p className="m-0">
                              <strong>{t("repeatAllowed")}:</strong>{" "}
                              {details.is_repeat ? t("yes") : t("no")}
                            </p>
                          </div>

                          {/* Detailed Content */}
                          {details.content &&
                            sanitizeContent(details.content) && (
                              <div className="mb-4">
                                <h5 className="mb-2 text-gray-700">
                                  {t("fullDescription")}:
                                </h5>
                                <div className="p-3 bg-white rounded border border-gray-300 text-sm leading-6 whitespace-pre-wrap">
                                  {renderContentWithBold(
                                    sanitizeContent(details.content)
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Attachments */}
                          {(details.attachments &&
                            details.attachments.length > 0) ||
                          details.url ? (
                            <div className="mb-4">
                              <h5 className="mb-3 text-gray-700">
                                {t("attachments")}:
                              </h5>
                              <div className="flex flex-col gap-2">
                                {details.attachments &&
                                details.attachments.length > 0 ? (
                                  details.attachments.map(
                                    (attachment, index) => (
                                      <div
                                        key={`${attachment.id}-${index}`}
                                        className="p-3 bg-white rounded border border-gray-300 flex items-center justify-between"
                                      >
                                        <div>
                                          <div className="font-bold mb-1">
                                            📎 {attachment.file_name}
                                            {attachment.type && (
                                              <span
                                                className={cn(
                                                  "ml-2 text-xs px-1.5 py-0.5 text-white rounded",
                                                  attachment.type === "answer"
                                                    ? "bg-cyan-600"
                                                    : "bg-gray-600"
                                                )}
                                              >
                                                {attachment.type === "answer"
                                                  ? t("answer")
                                                  : t("homework")}
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {t("size")}:{" "}
                                            {formatFileSize(
                                              attachment.pic_size
                                            )}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() =>
                                            handleDownloadAttachment(attachment)
                                          }
                                          disabled={
                                            downloadingAttachment ===
                                            attachment.url
                                          }
                                          className={cn(
                                            "px-3 py-1.5 text-white border-none rounded text-xs transition-colors",
                                            downloadingAttachment ===
                                              attachment.url
                                              ? "bg-gray-400 cursor-not-allowed"
                                              : "bg-green-600 hover:bg-green-700 cursor-pointer"
                                          )}
                                        >
                                          {downloadingAttachment ===
                                          attachment.url
                                            ? t("downloading")
                                            : t("download")}
                                        </button>
                                      </div>
                                    )
                                  )
                                ) : details.url ? (
                                  // Fallback for legacy single attachment format
                                  <div className="p-3 bg-white rounded border border-gray-300 flex items-center justify-between">
                                    <div>
                                      <div className="font-bold mb-1">
                                        📎 {details.file_name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {t("size")}:{" "}
                                        {formatFileSize(details.pic_size)}
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
                                      className={cn(
                                        "px-3 py-1.5 text-white border-none rounded text-xs transition-colors",
                                        downloadingAttachment === details.url
                                          ? "bg-gray-400 cursor-not-allowed"
                                          : "bg-green-600 hover:bg-green-700 cursor-pointer"
                                      )}
                                    >
                                      {downloadingAttachment === details.url
                                        ? "Downloading..."
                                        : t("download")}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
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
