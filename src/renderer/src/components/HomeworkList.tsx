import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { Homework, Course } from "../../../shared/types";
import { LoadingState, LoadingStateData } from "../types/ui";
import {
  Container,
  PageHeader,
  Button,
  Loading,
  ErrorDisplay,
  InfoBanner,
  cn,
} from "./common/StyledComponents";
import HomeworkCard from "./HomeworkCard";

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

  const isFetchingRef = useRef(false);
  const currentRequestIdRef = useRef<string | null>(null);

  const fetchHomework = useCallback(
    async (forceRefresh = false) => {
      // Prevent duplicate requests
      if (isFetchingRef.current) {
        console.log(
          "Homework fetch already in progress, skipping duplicate request"
        );
        return;
      }

      // Generate unique request ID for this fetch and set it IMMEDIATELY
      const requestId = `homework-${Date.now()}-${Math.random()}`;

      // Set the request ID BEFORE making any API calls
      currentRequestIdRef.current = requestId;
      isFetchingRef.current = true;

      // Set loading state BEFORE API call so events can start arriving
      setLoadingState({ state: LoadingState.LOADING });
      if (!forceRefresh) {
        setHomework(null); // Clear existing homework for streaming
      }

      try {
        if (forceRefresh) {
          // For force refresh, use streaming refresh (clears display first)
          await window.electronAPI.refreshHomework(undefined, { requestId });
        } else {
          // Start streaming
          const response: HomeworkResponse =
            await window.electronAPI.streamHomework(undefined, { requestId });

          // Handle final response (may be cached data)
          if (response.fromCache) {
            const ageMinutes = Math.floor(response.age / (1000 * 60));
            setCacheInfo(t("showingCachedData", { minutes: ageMinutes }));
          }
        }
      } catch (error) {
        // Only handle error if this is still the current request
        if (currentRequestIdRef.current === requestId) {
          console.error("Failed to fetch homework:", error);
          setLoadingState({
            state: LoadingState.ERROR,
            error: "Failed to fetch homework. Please try again later.",
          });
        }
      } finally {
        isFetchingRef.current = false;
        // Don't clear currentRequestIdRef.current here - let the next request handle it
        // This prevents issues with late events or immediate subsequent requests
      }
    },
    [t, setHomework]
  );

  useEffect(() => {
    fetchHomework();
  }, [fetchHomework]);

  // Handler functions for homework streaming events
  const handleHomeworkStreamChunk = useCallback(
    (
      _event: any,
      chunk: {
        homework: any[];
        courseId?: string;
        courseName?: string;
        fromCache: boolean;
        responseId?: string;
      }
    ) => {
      // Check if this chunk is from the current request
      if (chunk.responseId && currentRequestIdRef.current) {
        if (chunk.responseId !== currentRequestIdRef.current) {
          console.log("Ignoring homework chunk from outdated request");
          return;
        }
      }

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
    },
    [setHomework, t]
  );

  const handleHomeworkStreamProgress = useCallback(
    (
      _event: any,
      progress: {
        completed: number;
        total: number;
        currentCourse?: string;
        responseId?: string;
      }
    ) => {
      // Check if this progress is from the current request
      if (progress.responseId && currentRequestIdRef.current) {
        if (progress.responseId !== currentRequestIdRef.current) {
          console.log("Ignoring homework progress from outdated request");
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

  const handleHomeworkStreamComplete = useCallback(
    (_event: any, payload: { courseId?: string; responseId?: string }) => {
      // Check if this completion is from the current request
      if (payload.responseId && currentRequestIdRef.current) {
        if (payload.responseId !== currentRequestIdRef.current) {
          console.log("Ignoring homework completion from outdated request");
          return;
        }
      }

      setLoadingState({ state: LoadingState.SUCCESS });
      setCacheInfo(t("showingFreshData"));
      // Don't clear currentRequestIdRef.current here - let the next request handle it
      // This prevents issues with late events or immediate subsequent requests
    },
    [t]
  );

  const handleHomeworkStreamError = useCallback(
    (_event: any, errorData: { error: string; responseId?: string }) => {
      // Check if this error is from the current request
      if (errorData.responseId && currentRequestIdRef.current) {
        if (errorData.responseId !== currentRequestIdRef.current) {
          console.log("Ignoring homework error from outdated request");
          return;
        }
      }

      console.error("Homework streaming error:", errorData.error);
      setLoadingState({
        state: LoadingState.ERROR,
        error: `Failed to fetch homework: ${errorData.error}`,
      });
      // Don't clear currentRequestIdRef.current here either - let the next request handle it
    },
    []
  );

  const handleHomeworkRefreshStart = useCallback(
    (_event: any, _payload: { courseId?: string; responseId?: string }) => {
      // Clear current homework and reset loading state for refresh (loading state already set by fetchHomework)
      setHomework([]);
    },
    [setHomework]
  );

  // Set up event listeners and cleanup on unmount
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

    // Set up event listeners
    window.electronAPI.onCacheUpdate?.(handleCacheUpdate);
    window.electronAPI.onHomeworkStreamChunk?.(handleHomeworkStreamChunk);
    window.electronAPI.onHomeworkStreamProgress?.(handleHomeworkStreamProgress);
    window.electronAPI.onHomeworkStreamComplete?.(handleHomeworkStreamComplete);
    window.electronAPI.onHomeworkStreamError?.(handleHomeworkStreamError);
    window.electronAPI.onHomeworkRefreshStart?.(handleHomeworkRefreshStart);

    return () => {
      window.electronAPI.removeAllListeners?.("cache-updated");
      window.electronAPI.removeAllListeners?.("homework-stream-chunk");
      window.electronAPI.removeAllListeners?.("homework-stream-progress");
      window.electronAPI.removeAllListeners?.("homework-stream-complete");
      window.electronAPI.removeAllListeners?.("homework-stream-error");
      window.electronAPI.removeAllListeners?.("homework-refresh-start");
    };
  }, [
    setHomework,
    t,
    handleHomeworkStreamChunk,
    handleHomeworkStreamProgress,
    handleHomeworkStreamComplete,
    handleHomeworkStreamError,
    handleHomeworkRefreshStart,
  ]);

  const isOverdue = (hw: Homework) => {
    const now = new Date();
    return new Date(hw.dueDate) < now;
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
          if (hw.courseId !== selectedCourse.id) return false;
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
          message={loadingState.error || t("unknownError")}
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
                <Button
                  key={filterType}
                  onClick={() => setFilter(filterType as any)}
                  variant={filter === filterType ? "primary" : "secondary"}
                  size="sm"
                  className={cn(
                    filter === filterType
                      ? ""
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-300"
                  )}
                >
                  {t(filterType)}
                </Button>
              )
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <strong>{t("course")}: </strong>
            <select
              value={
                courses.some((c) => c.id === (selectedCourse?.id || ""))
                  ? selectedCourse?.id || ""
                  : ""
              }
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
              <option value="">{t("allCourses")}</option>
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

          <Button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            variant="secondary"
            size="sm"
            className="bg-gray-50 border border-gray-300 hover:bg-gray-100"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </Button>
        </div>
      </div>

      {filteredAndSortedHomework.length === 0 ? (
        <p className="text-gray-600">{t("noHomeworkFound")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredAndSortedHomework.map((hw) => {
            return (
              <HomeworkCard
                key={hw.id}
                homework={hw}
                refreshHomework={() => fetchHomework(true)}
              />
            );
          })}
        </div>
      )}
    </Container>
  );
};

export default HomeworkList;
