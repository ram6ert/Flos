import React from "react";
import { useTranslation } from "react-i18next";
import { Course } from "../../../shared/types";
import {
  Container,
  PageHeader,
  Button,
  Card,
  Grid,
} from "./common/StyledComponents";
import { Homework } from "../../../shared/types/homework";

interface CourseListProps {
  courses: Course[];
  onCourseSelect: (course: Course) => void;
  onRefresh?: () => Promise<void>;
  selectedCourse?: Course | null;
  onNavigate?: (view: "courses" | "homework" | "documents" | "flow-schedule") => void;
}

const CourseList: React.FC<CourseListProps> = ({
  courses,
  onCourseSelect,
  onRefresh,
  selectedCourse,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [courseImages, setCourseImages] = React.useState<
    Record<string, string | null>
  >({});
  // Refs and measured heights to enable smooth nonlinear expand/collapse
  const contentRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [contentHeights, setContentHeights] = React.useState<Record<string, number>>({});
  const [details, setDetails] = React.useState<
    Record<
      string,
      | {
          loading: boolean;
          error?: string;
          docsCount: number | null;
          hwSummary: {
            total: number;
            pending: number;
            submitted: number;
            graded: number;
          } | null;
        }
      | undefined
    >
  >({});

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error("Failed to refresh courses:", error);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const formatSemesterDates = (beginDate: string, endDate: string) => {
    const begin = new Date(beginDate);
    const end = new Date(endDate);
    const beginFormatted = begin.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const endFormatted = end.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return `${beginFormatted} - ${endFormatted}`;
  };

  // Fetch course images through main process
  React.useEffect(() => {
    const fetchImages = async () => {
      for (const course of courses) {
        if (course.picture && !courseImages[course.id]) {
          try {
            const imageData = await window.electronAPI.fetchCourseImage(
              course.picture
            );
            if (imageData) {
              setCourseImages((prev) => ({
                ...prev,
                [course.id]: imageData,
              }));
            }
          } catch (error) {
            console.error(
              `Failed to fetch image for course ${course.id}:`,
              error
            );
            setCourseImages((prev) => ({
              ...prev,
              [course.id]: null,
            }));
          }
        }
      }
    };

    fetchImages();
  }, [courses, courseImages]);

  // Lazy-load details (documents count, homework summary) when a course becomes selected
  React.useEffect(() => {
    const loadDetails = async (course: Course) => {
      setDetails((prev) => ({
        ...prev,
        [course.id]: { loading: true, docsCount: null, hwSummary: null },
      }));

      try {
        const [docsResp, hwResp]: any = await Promise.all([
          // Documents use courseNumber (code)
          window.electronAPI.getCourseDocuments(course.courseNumber),
          // Homework uses course.id
          window.electronAPI.getHomework(course.id),
        ]);

        const docsCount: number = Array.isArray(docsResp?.data)
          ? docsResp.data.length
          : 0;

        const hwList: Homework[] = Array.isArray(hwResp?.data)
          ? (hwResp.data as Homework[])
          : [];
        const summary = {
          total: hwList.length,
          pending: hwList.filter((h) => h.submissionStatus === "not_submitted")
            .length,
          submitted: hwList.filter((h) => h.submissionStatus === "submitted")
            .length,
          graded: hwList.filter((h) => h.submissionStatus === "graded").length,
        };

        setDetails((prev) => ({
          ...prev,
          [course.id]: {
            loading: false,
            docsCount,
            hwSummary: summary,
          },
        }));
      } catch (err: any) {
        console.error("Failed to load course details:", err);
        setDetails((prev) => ({
          ...prev,
          [course.id]: {
            loading: false,
            error: err?.message || "Failed to load details",
            docsCount: null,
            hwSummary: null,
          },
        }));
      }
    };

    if (selectedCourse) {
      const existing = details[selectedCourse.id];
      if (!existing || (!!existing && !existing.loading && existing.docsCount == null && !existing.hwSummary)) {
        loadDetails(selectedCourse);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse?.id]);

  // Measure expanded content height for smooth animation
  const measureHeight = React.useCallback((id: string) => {
    const el = contentRefs.current[id];
    if (!el) return;
    const h = el.scrollHeight || el.clientHeight || 0;
    setContentHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  React.useEffect(() => {
    if (selectedCourse?.id) {
      // Re-measure when details for selected course update
      measureHeight(selectedCourse.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse?.id, details[selectedCourse?.id || ""]]);

  return (
    <Container padding="lg">
      <PageHeader
        title={t("myCourses")}
        actions={
          onRefresh && (
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="primary"
              size="sm"
            >
              {isRefreshing ? t("refreshing") : t("refresh")}
            </Button>
          )
        }
      />

      {courses.length === 0 ? (
        <p className="text-gray-600">{t("noCourses")}</p>
      ) : (
        <Grid>
          {courses.map((course) => {
            const isSelected = !!selectedCourse && (selectedCourse.id === course.id || selectedCourse.name === course.name);
            return (
            <Card
              key={course.id}
              onClick={() => onCourseSelect(course)}
              className={`course-card flex flex-col relative ${
                isSelected
                  ? "ring-4 ring-indigo-500/80 ring-offset-2 ring-offset-white border-2 border-indigo-500 bg-indigo-50/70 shadow-lg shadow-indigo-300"
                  : ""
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-400 text-black border border-amber-600 shadow-md shadow-amber-300">
                    ✓ Selected
                  </span>
                </div>
              )}
              {courseImages[course.id] && (
                <div className="mb-3">
                  <img
                    src={courseImages[course.id]!}
                    alt={course.name}
                    className="w-full h-30 object-cover rounded-md"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}

              <div className="flex-1">
                <h3 className={`m-0 mb-2 text-lg font-semibold ${isSelected ? "text-indigo-900" : "text-gray-900"}`}>
                  {course.name}
                </h3>

                <p className={`m-0 mb-2 text-sm ${isSelected ? "text-indigo-800" : "text-gray-700"}`}>
                  <strong>{t("courseNumber")}:</strong> {course.courseNumber}
                </p>

                <p className={`m-0 mb-2 text-sm ${isSelected ? "text-indigo-800" : "text-gray-700"}`}>
                  <strong>{t("instructor")}:</strong> {course.teacherName}
                </p>

                <p className={`m-0 text-xs ${isSelected ? "text-indigo-700" : "text-gray-600"}`}>
                  <strong>{t("semester")}:</strong>{" "}
                  {formatSemesterDates(course.beginDate, course.endDate)}
                </p>
              </div>

              {/* Expanded details when selected */}
              {/* Smooth expandable container */}
              <div
                className={`mt-3 border-t border-indigo-200 overflow-hidden ${
                  isSelected ? "" : "pointer-events-none"
                }`}
                style={{
                  maxHeight: isSelected
                    ? `${contentHeights[course.id] ?? 0}px`
                    : "0px",
                  opacity: isSelected ? 1 : 0,
                  transform: isSelected ? "translateY(0px)" : "translateY(-6px)",
                  transition:
                    "max-height 420ms cubic-bezier(0.22,1,0.36,1), opacity 280ms ease, transform 320ms ease",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="pt-4" ref={(el) => { contentRefs.current[course.id] = el; }}>
                  {(() => {
                    const d = details[course.id];
                    if (!d || d.loading) {
                      return (
                        <div className="flex items-center text-sm text-indigo-800">
                          <div className="w-4 h-4 border-2 border-transparent border-t-indigo-600 rounded-full animate-spin mr-2" />
                          {t("loading")}...
                        </div>
                      );
                    }
                    if (d.error) {
                      return (
                        <div className="text-sm text-red-700">
                          {t("error")}: {d.error}
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-b from-white to-indigo-50/40 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                          {/* Documents summary */}
                          <div className="rounded-lg border border-indigo-200/70 bg-white p-3 h-full">
                            <div className="flex flex-col h-full justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-base" aria-hidden>📄</span>
                                  <span className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold">
                                    {t("documents")}
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                  <div className="text-xl font-bold text-indigo-900 tabular-nums">
                                    {d.docsCount ?? 0}
                                  </div>
                                  <div className="text-xs text-indigo-800/80 truncate">{t("documents")}</div>
                                </div>
                              </div>
                              <div className="pt-2">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="whitespace-nowrap"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCourseSelect(course);
                                    onNavigate && onNavigate("documents");
                                  }}
                                >
                                  {t("viewDetails")} →
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Homework summary */}
                          <div className="rounded-lg border border-indigo-200/70 bg-white p-3 h-full">
                            <div className="flex flex-col h-full justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-base" aria-hidden>📝</span>
                                  <span className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold">
                                    {t("homework")}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <span className="inline-flex items-center justify-between px-2 py-1 text-[11px] font-medium rounded-md bg-gray-50 text-gray-800 border border-gray-200">
                                    {t("all")}<span className="ml-2 font-semibold tabular-nums">{d.hwSummary?.total ?? 0}</span>
                                  </span>
                                  <span className="inline-flex items-center justify-between px-2 py-1 text-[11px] font-medium rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200">
                                    {t("pending")}<span className="ml-2 font-semibold tabular-nums">{d.hwSummary?.pending ?? 0}</span>
                                  </span>
                                  <span className="inline-flex items-center justify-between px-2 py-1 text-[11px] font-medium rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                                    {t("submitted")}<span className="ml-2 font-semibold tabular-nums">{d.hwSummary?.submitted ?? 0}</span>
                                  </span>
                                  <span className="inline-flex items-center justify-between px-2 py-1 text-[11px] font-medium rounded-md bg-green-50 text-green-800 border border-green-200">
                                    {t("graded")}<span className="ml-2 font-semibold tabular-nums">{d.hwSummary?.graded ?? 0}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="pt-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="whitespace-nowrap"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCourseSelect(course);
                                    onNavigate && onNavigate("homework");
                                  }}
                                >
                                  {t("viewDetails")} →
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </Card>
          )})}
        </Grid>
      )}
    </Container>
  );
};

export default CourseList;
