import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Homework,
  HomeworkDetails,
  HomeworkAttachment,
  Course,
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
  cn,
} from "./common/StyledComponents";

interface HomeworkResponse {
  data: Homework[];
  fromCache: boolean;
  age: number;
}

interface HomeworkListProps {
  selectedCourse: Course | null;
  courses: Course[];
  onCourseSelect: (course: Course | null) => void;
  homework: Homework[] | null;
  setHomework: React.Dispatch<React.SetStateAction<Homework[] | null>>;
}

const HomeworkList: React.FC<HomeworkListProps> = ({
  selectedCourse,
  courses,
  onCourseSelect,
  homework,
  setHomework,
}) => {
  const { t } = useTranslation();
  const [loadingState, setLoadingState] = useState<LoadingStateData>({
    state: LoadingState.IDLE,
  });
  const [filter, setFilter] = useState<
    "all" | "pending" | "submitted" | "graded" | "overdue"
  >("all");
  const [cacheInfo, setCacheInfo] = useState<string>("");
  // Removed error state - using loadingState.error instead
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
  const [submissionText, setSubmissionText] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState<Set<number>>(new Set());

  const isFetchingRef = useRef(false);

  const fetchHomework = useCallback(
    async (forceRefresh = false) => {
      // Prevent duplicate requests
      if (isFetchingRef.current) {
        console.log(
          "Homework fetch already in progress, skipping duplicate request"
        );
        return;
      }

      isFetchingRef.current = true;

      try {
        if (forceRefresh) {
          // For force refresh, use streaming refresh (clears display first)
          await window.electronAPI.refreshHomework();
        } else if(!homework) {
          // Use streaming for normal loads
          setLoadingState({ state: LoadingState.LOADING });

          // Start streaming
          const response: HomeworkResponse =
            await window.electronAPI.streamHomework();

          // Handle final response (may be cached data)
          if (response.fromCache) {
            const ageMinutes = Math.floor(response.age / (1000 * 60));
            setCacheInfo(t("showingCachedData", { minutes: ageMinutes }));
          }
        }
      } finally {
        if (!forceRefresh) {
          setLoadingState({ state: LoadingState.SUCCESS });
        }
        isFetchingRef.current = false;
      }
    },
    [t]
  );

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

    const handleStreamChunk = (
      _event: any,
      chunk: {
        homework: any[];
        courseId?: string;
        courseName?: string;
        type: string;
        isComplete: boolean;
        fromCache: boolean;
      }
    ) => {
      if (chunk.fromCache && chunk.isComplete) {
        // Cached data - replace all homework
        setHomework(chunk.homework);
        setLoadingState({ state: LoadingState.SUCCESS });
      } else {
        // Streaming data - append new homework
        setHomework((prev) => {
          const existingIds = new Set((prev || []).map((hw) => hw.id));
          const newHomework = chunk.homework.filter(
            (hw) => !existingIds.has(hw.id)
          );
          return [...(prev || []), ...newHomework];
        });

        // Update cache info to show we're receiving fresh data
        if (!chunk.fromCache) {
          setCacheInfo(t("showingFreshData"));
        }
      }
    };

    const handleStreamProgress = (
      _event: any,
      progress: {
        completed: number;
        total: number;
        currentCourse?: string;
      }
    ) => {
      setLoadingState({
        state: LoadingState.LOADING,
        progress: {
          completed: progress.completed,
          total: progress.total,
          currentItem: progress.currentCourse,
        },
      });
    };

    const handleStreamComplete = (
      _event: any,
      _payload: { courseId?: string }
    ) => {
      setLoadingState({ state: LoadingState.SUCCESS });
      setCacheInfo(t("showingFreshData"));
    };

    const handleStreamError = (_event: any, error: { error: string }) => {
      console.error("Streaming error:", error.error);
      setLoadingState({ state: LoadingState.ERROR, error: error.error });
    };

    const handleRefreshStart = (
      _event: any,
      _payload: { courseId?: string }
    ) => {
      // Clear current homework and reset loading state for refresh
      setHomework([]);
      setLoadingState({ state: LoadingState.LOADING });
      setCacheInfo("");
    };

    // Set up event listeners
    window.electronAPI.onCacheUpdate?.(handleCacheUpdate);
    window.electronAPI.onHomeworkStreamChunk?.(handleStreamChunk);
    window.electronAPI.onHomeworkStreamProgress?.(handleStreamProgress);
    window.electronAPI.onHomeworkStreamComplete?.(handleStreamComplete);
    window.electronAPI.onHomeworkStreamError?.(handleStreamError);
    window.electronAPI.onHomeworkRefreshStart?.(handleRefreshStart);

    return () => {
      window.electronAPI.removeAllListeners?.("cache-updated");
      window.electronAPI.removeAllListeners?.("homework-stream-chunk");
      window.electronAPI.removeAllListeners?.("homework-stream-progress");
      window.electronAPI.removeAllListeners?.("homework-stream-complete");
      window.electronAPI.removeAllListeners?.("homework-stream-error");
      window.electronAPI.removeAllListeners?.("homework-refresh-start");
    };
  }, [t]);

  const getStatusColor = (hw: Homework) => {
    if (hw.submissionStatus === "graded") return "#28a745"; // green
    if (hw.submissionStatus === "submitted") return "#007bff"; // blue
    return "#dc3545"; // red for pending
  };

  const formatDeadline = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN");
  };

  const isOverdue = (hw: Homework) => {
    const now = new Date();
    return new Date(hw.dueDate) < now && hw.submissionStatus !== "submitted";
  };

  const getRemainingTime = (hw: Homework) => {
    const now = new Date();
    const timeDiff = new Date(hw.dueDate).getTime() - now.getTime();

    if (hw.submissionStatus === "submitted") {
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

  const translateStatus = (
    status: "submitted" | "not_submitted" | "graded"
  ) => {
    switch (status) {
      case "submitted":
        return t("submitted");
      case "not_submitted":
        return t("notSubmitted");
      case "graded":
        return t("graded");
      default:
        return status;
    }
  };

  const formatScore = (score: number | null) => {
    if (score === null) {
      return t("gradeNotPublished");
    }
    return score.toString();
  };

  const getHomeworkTypeText = (
    type: "homework" | "report" | "experiment" | "quiz" | "assessment"
  ) => {
    switch (type) {
      case "homework":
        return t("normalHomework");
      case "report":
        return t("courseReport");
      case "experiment":
        return t("experimentHomework");
      case "quiz":
        return t("regularQuiz");
      case "assessment":
        return t("finalAssessment");
      default:
        return t("unknownType");
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
      setLoadingState({
        state: LoadingState.ERROR,
        error: t("failedToLoadHomeworkDetails"),
      });
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
      await fetchHomeworkDetails(hw.id, hw.courseId);
    }
  };

  const handleDownloadAttachment = async (attachment: HomeworkAttachment) => {
    setDownloadingAttachment(attachment.url);
    try {
      const result = await window.electronAPI.downloadHomeworkAttachment(
        attachment.url,
        `${attachment.fileName}.${getFileExtension(attachment.url)}`
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
          a.download = `${attachment.fileName}.${getFileExtension(attachment.url)}`;
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
    sanitized = sanitized.replace(
      /<img[^>]*>/gi,
      "**[Image removed for security]**"
    );

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

  const handleHomeworkSubmission = async (hw: Homework) => {
    if (submitting.has(hw.id)) {
      return;
    }

    const newSubmitting = new Set(submitting);
    newSubmitting.add(hw.id);
    setSubmitting(newSubmitting);

    try {
      const files: Array<{ filePath: string; fileName: string }> = [];

      // Convert FileList to our format if files are selected
      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          // For Electron apps, we'll need the file path
          // In a real implementation, you might need to save the file temporarily
          // or handle it differently depending on your file picker implementation
          files.push({
            filePath: (file as any).path || file.name, // Use file.path if available in Electron
            fileName: file.name,
          });
        }
      }

      const result = await window.electronAPI.submitHomework({
        homeworkId: hw.id.toString(),
        courseId: hw.courseId.toString(),
        content: submissionText,
        files: files.length > 0 ? files : undefined,
      });

      if (result.success) {
        alert(
          t("homeworkSubmittedSuccessfully", {
            message: result.message,
            files: result.filesSubmitted,
          })
        );

        // Clear the form
        setSubmissionText("");
        setSelectedFiles(null);

        // Refresh homework list to show updated status
        await fetchHomework(true);
      }
    } catch (error) {
      console.error("Homework submission failed:", error);
      alert(
        t("homeworkSubmissionFailed", {
          error: error instanceof Error ? error.message : "Unknown error",
        })
      );
    } finally {
      const newSubmitting = new Set(submitting);
      newSubmitting.delete(hw.id);
      setSubmitting(newSubmitting);
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
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
    "due_date" | "course" | "status" | "remaining_time" | "type"
  >("remaining_time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredAndSortedHomework = useMemo(() => {
    return (homework || [])
      .filter((hw) => {
        // Filter by selected course if provided
        if (selectedCourse) {
          const selectedCourseIdAsNumber = Number(selectedCourse.id);
          if (hw.courseId !== selectedCourseIdAsNumber) return false;
        }

        const hwIsOverdue = isOverdue(hw);

        switch (filter) {
          case "pending":
            return hw.submissionStatus === "not_submitted" && !hwIsOverdue;
          case "submitted":
            return hw.submissionStatus === "submitted";
          case "graded":
            return hw.submissionStatus === "graded";
          case "overdue":
            return hwIsOverdue && hw.submissionStatus !== "submitted";
          default:
            return true;
        }
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "due_date":
            comparison =
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            break;
          case "course":
            comparison = a.courseName.localeCompare(b.courseName);
            break;
          case "status":
            comparison = a.submissionStatus.localeCompare(b.submissionStatus);
            break;
          case "remaining_time":
            const nowTime = new Date().getTime();
            const timeA = new Date(a.dueDate).getTime() - nowTime;
            const timeB = new Date(b.dueDate).getTime() - nowTime;

            const isOverdueA = timeA < 0 && a.submissionStatus !== "submitted";
            const isOverdueB = timeB < 0 && b.submissionStatus !== "submitted";
            const isSubmittedA = a.submissionStatus === "submitted";
            const isSubmittedB = b.submissionStatus === "submitted";

            if (isSubmittedA && !isSubmittedB) return 1;
            if (!isSubmittedA && isSubmittedB) return -1;

            if (isOverdueA && !isOverdueB) return -1;
            if (!isOverdueA && isOverdueB) return 1;

            comparison = Math.abs(timeA) - Math.abs(timeB);
            break;
          case "type":
            comparison = a.type.localeCompare(b.type);
            break;
          default:
            comparison = 0;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [homework, selectedCourse, filter, sortBy, sortOrder]);

  if (loadingState.state === LoadingState.LOADING && !loadingState.progress) {
    return (
      <Container padding="lg">
        <Loading message={t("loadingHomework")} />
      </Container>
    );
  }

  if (loadingState.state === LoadingState.ERROR) {
    return (
      <Container padding="lg">
        <ErrorDisplay
          title={t("unableToLoadHomework")}
          message={loadingState.error || "Unknown error"}
          onRetry={() => fetchHomework(true)}
          retryLabel={t("retry")}
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
              disabled={loadingState.state === LoadingState.LOADING}
              variant="primary"
              size="sm"
            >
              {loadingState.state === LoadingState.LOADING
                ? t("loading")
                : t("refresh")}
          </Button>
        }
      />

      {cacheInfo && <InfoBanner variant="info">{cacheInfo}</InfoBanner>}

      {/* Loading Progress */}
      {loadingState.state === LoadingState.LOADING && loadingState.progress && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">
              {t("loadingHomework")} ({loadingState.progress.completed}/
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

      <div className="mb-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="mr-1">{t("filter")}: </strong>
            {["all", "pending", "submitted", "graded", "overdue"].map(
              (filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType as any)}
                  className={cn(
                    "px-3 py-1.5 border border-gray-300 rounded-md cursor-pointer text-sm font-medium transition-colors",
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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <strong>{t("course")}: </strong>
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
              className="px-2 py-1 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.courseNumber} - {course.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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
            <option value="type">{t("type")}</option>
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
                    <strong>{t("course")}:</strong> {hw.courseName}
                  </p>
                  <p className="m-0">
                    <strong>{t("maxScore")}:</strong> {hw.maxScore}
                  </p>
                  <p className="m-0">
                    <strong>{t("due")}:</strong> {formatDeadline(hw.dueDate)}
                  </p>
                  <p className="m-0">
                    <strong>{t("status")}:</strong>{" "}
                    <span style={{ color: getStatusColor(hw) }}>
                      {translateStatus(hw.submissionStatus)}
                    </span>
                  </p>
                  <p className="m-0">
                    <strong>{t("type")}:</strong> {getHomeworkTypeText(hw.type)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <p className="m-0">
                    <strong>{t("submitted")}:</strong> {hw.submittedCount}/
                    {hw.totalStudents} {t("students")}
                  </p>
                  <p className="m-0">
                    <strong>{t("grade")}:</strong>{" "}
                    {formatScore(hw.studentScore)}
                  </p>
                </div>

                {hw.submitDate && (
                  <p className="mt-2 text-xs text-gray-500">
                    <strong>{t("submittedAt")}:</strong>{" "}
                    {formatDeadline(hw.submitDate)}
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
                              {new Date(details.createdDate).toLocaleString()}
                            </p>
                            <p className="m-0">
                              <strong>{t("openDate")}:</strong>{" "}
                              {new Date(details.openDate).toLocaleString()}
                            </p>
                            {details.isAnswerPublished && (
                              <p className="m-0">
                                <strong>{t("answer")}:</strong>{" "}
                                {details.referenceAnswer}
                              </p>
                            )}
                            <p className="m-0">
                              <strong>{t("repeatAllowed")}:</strong>{" "}
                              {details.isRepeatAllowed ? t("yes") : t("no")}
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
                                            📎 {attachment.fileName}
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
                                              attachment.fileSize
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
                                        📎 {details.fileName}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {t("size")}:{" "}
                                        {formatFileSize(details.fileSize)}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() =>
                                        handleDownloadAttachment({
                                          id: details.id,
                                          url: details.url,
                                          fileName: details.fileName,
                                          convertUrl: details.convertUrl,
                                          fileSize: details.fileSize,
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

                          {/* Homework Submission Section */}
                          {(() => {
                            const details = homeworkDetails.get(hw.id);
                            const canSubmit =
                              !isOverdue(hw) &&
                              (hw.submissionStatus === "not_submitted" ||
                                (hw.submissionStatus === "submitted" &&
                                  details?.isRepeatAllowed));
                            if (!canSubmit) return null;
                            return (
                              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h5 className="mb-3 text-blue-800 font-semibold">
                                  {hw.submissionStatus === "submitted"
                                    ? t("submitHomework")
                                    : t("submitHomework")}
                                </h5>

                                {/* Text Content Input */}
                                <div className="mb-4">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t("submissionContent")} ({t("optional")})
                                  </label>
                                  <textarea
                                    value={submissionText}
                                    onChange={(e) =>
                                      setSubmissionText(e.target.value)
                                    }
                                    placeholder={t("enterSubmissionText")}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
                                    rows={4}
                                    disabled={submitting.has(hw.id)}
                                  />
                                </div>

                                {/* File Upload */}
                                <div className="mb-4">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t("attachFiles")} ({t("optional")})
                                  </label>
                                  <input
                                    type="file"
                                    multiple
                                    onChange={handleFileSelection}
                                    disabled={submitting.has(hw.id)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                  />
                                  {selectedFiles && (
                                    <div className="mt-2 text-sm text-gray-600">
                                      {t("selectedFiles", {
                                        count: selectedFiles.length,
                                      })}
                                      :
                                      <ul className="list-disc list-inside mt-1">
                                        {Array.from(selectedFiles).map(
                                          (file, index) => (
                                            <li
                                              key={index}
                                              className="truncate"
                                            >
                                              {file.name} (
                                              {formatFileSize(file.size)})
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>

                                {/* Submit Button */}
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => handleHomeworkSubmission(hw)}
                                    disabled={
                                      submitting.has(hw.id) ||
                                      (!submissionText.trim() && !selectedFiles)
                                    }
                                    className={cn(
                                      "px-6 py-2 text-white border-none rounded-md text-sm font-medium transition-colors",
                                      submitting.has(hw.id) ||
                                        (!submissionText.trim() &&
                                          !selectedFiles)
                                        ? "bg-gray-400 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                                    )}
                                  >
                                    {submitting.has(hw.id)
                                      ? t("submitting")
                                      : hw.submissionStatus === "submitted"
                                        ? t("submitHomework")
                                        : t("submitHomework")}
                                  </button>

                                  {submitting.has(hw.id) && (
                                    <div className="text-sm text-blue-600 flex items-center gap-2">
                                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                      {t("submittingHomework")}
                                    </div>
                                  )}
                                </div>

                                <div className="mt-2 text-xs text-gray-500">
                                  {t("submissionNote")}
                                </div>
                              </div>
                            );
                          })()}
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
