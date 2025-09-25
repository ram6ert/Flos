import { t } from "i18next";
import { Course, Homework } from "../../../shared/types";
import { Button, Card } from "./common/StyledComponents";
import { useEffect, useState } from "react";

interface CourseCardProps {
  course: Course;
  image: string | null;
  isSelected: boolean;
  onNavigate?: (
    view: "courses" | "homework" | "documents" | "flow-schedule"
  ) => void;
  onCourseSelect: (course: string | null) => void;
}

const CourseCard: React.FC<CourseCardProps> = ({
  course,
  isSelected,
  onCourseSelect,
  onNavigate = null,
  image = null,
}) => {
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

  const [details, setDetails] = useState<{
    loading: boolean;
    error?: string;
    docsCount: number | null;
    hwSummary: {
      total: number;
      pending: number;
      submitted: number;
      graded: number;
    } | null;
  } | null>(null);

  useEffect(() => {
    const loadDetails = async () => {
      if (!isSelected) {
        return;
      }
      try {
        const [docsResp, hwResp]: any = await Promise.all([
          // Documents use courseNumber (code) - get from matching Course object
          window.electronAPI.getCourseDocuments(course.courseNumber),
          // Homework uses course.id - use the selectedCourse id
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

        setDetails({
          loading: false,
          docsCount,
          hwSummary: summary,
        });
      } catch (err: any) {
        console.error("Failed to load course details:", err);
        setDetails({
          loading: false,
          error: err?.message || "Failed to load details",
          docsCount: null,
          hwSummary: null,
        });
      }
    };
    loadDetails();
  }, [isSelected, course.id, course.courseNumber]);
  return (
    <Card
      key={course.id}
      onClick={() => {
        onCourseSelect(isSelected ? null : course.courseNumber);
      }}
      className={`course-card flex flex-col relative overflow-hidden min-h-[200px] ${
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
      {image && (
        <div className="mb-3 overflow-hidden rounded-md">
          <img
            src={image}
            alt={course.name}
            className="w-full h-32 max-h-32 object-cover rounded-md aspect-video"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}

      <div className="flex-1">
        <h3
          className={`m-0 mb-2 text-lg font-semibold leading-tight ${isSelected ? "text-indigo-900" : "text-gray-900"}`}
          title={course.name}
        >
          <span className="line-clamp-2">{course.name}</span>
        </h3>

        <p
          className={`m-0 mb-2 text-sm ${isSelected ? "text-indigo-800" : "text-gray-700"}`}
          title={course.courseNumber}
        >
          <strong>{t("courseNumber")}:</strong>{" "}
          <span className="truncate inline-block max-w-full">
            {course.courseNumber}
          </span>
        </p>

        <p
          className={`m-0 mb-2 text-sm ${isSelected ? "text-indigo-800" : "text-gray-700"}`}
          title={course.teacherName}
        >
          <strong>{t("instructor")}:</strong>{" "}
          <span className="truncate inline-block max-w-full">
            {course.teacherName}
          </span>
        </p>

        <p
          className={`m-0 text-xs ${isSelected ? "text-indigo-700" : "text-gray-600"}`}
        >
          <strong>{t("semester")}:</strong>{" "}
          {formatSemesterDates(course.beginDate, course.endDate)}
        </p>
      </div>

      {/* Course details - only render when selected (selected = expanded) */}
      <div
        className={`grid overflow-hidden transition-all duration-500 ease-in-out ${
          isSelected
            ? "grid-rows-1 mt-3 border-t border-indigo-200"
            : "grid-rows-0 mt-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden">
          {isSelected && (
            <div className="pt-4 transition-all duration-300 delay-150 opacity-100 transform translate-y-0">
              {(() => {
                if (!details || details.loading) {
                  return (
                    <div className="flex items-center text-sm text-indigo-800">
                      <div className="w-4 h-4 border-2 border-transparent border-t-indigo-600 rounded-full animate-spin mr-2" />
                      {t("loading")}...
                    </div>
                  );
                }
                if (details.error) {
                  return (
                    <div className="text-sm text-red-700">
                      {t("error")}: {details.error}
                    </div>
                  );
                }
                return (
                  <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-b from-white to-indigo-50/40 p-3 w-full overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch min-w-0">
                      {/* Documents summary */}
                      <div className="rounded-lg border border-indigo-200/70 bg-white p-3 flex flex-col min-w-0 overflow-hidden">
                        <div className="flex-1 min-h-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="text-base flex-shrink-0"
                              aria-hidden
                            >
                              📄
                            </span>
                            <span className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold truncate">
                              {t("documents")}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2 min-w-0">
                            <div className="text-xl font-bold text-indigo-900 tabular-nums flex-shrink-0">
                              {details.docsCount ?? 0}
                            </div>
                            <div className="text-xs text-indigo-800/80 truncate min-w-0">
                              {t("documents")}
                            </div>
                          </div>
                        </div>
                        <div className="pt-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="primary"
                            className="w-full text-center min-w-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCourseSelect(course.courseNumber);
                              onNavigate && onNavigate("documents");
                            }}
                          >
                            <span className="truncate">
                              {t("viewDetails")} →
                            </span>
                          </Button>
                        </div>
                      </div>

                      {/* Homework summary */}
                      <div className="rounded-lg border border-indigo-200/70 bg-white p-3 flex flex-col min-w-0 overflow-hidden">
                        <div className="flex-1 min-h-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="text-base flex-shrink-0"
                              aria-hidden
                            >
                              📝
                            </span>
                            <span className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold truncate">
                              {t("homework")}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <div className="grid grid-cols-2 gap-1.5 min-w-0">
                              <span className="inline-flex items-center justify-between px-2 py-1 text-[9px] font-medium rounded-md bg-gray-50 text-gray-800 border border-gray-200 min-w-0 overflow-hidden">
                                <span className="truncate flex-1">
                                  {t("all")}
                                </span>
                                <span className="ml-1 font-semibold tabular-nums flex-shrink-0">
                                  {details.hwSummary?.total ?? 0}
                                </span>
                              </span>
                              <span className="inline-flex items-center justify-between px-2 py-1 text-[9px] font-medium rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200 min-w-0 overflow-hidden">
                                <span className="truncate flex-1">
                                  {t("pending")}
                                </span>
                                <span className="ml-1 font-semibold tabular-nums flex-shrink-0">
                                  {details.hwSummary?.pending ?? 0}
                                </span>
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 min-w-0">
                              <span className="inline-flex items-center justify-between px-2 py-1 text-[9px] font-medium rounded-md bg-blue-50 text-blue-800 border border-blue-200 min-w-0 overflow-hidden">
                                <span className="truncate flex-1">
                                  {t("submitted")}
                                </span>
                                <span className="ml-1 font-semibold tabular-nums flex-shrink-0">
                                  {details.hwSummary?.submitted ?? 0}
                                </span>
                              </span>
                              <span className="inline-flex items-center justify-between px-2 py-1 text-[9px] font-medium rounded-md bg-green-50 text-green-800 border border-green-200 min-w-0 overflow-hidden">
                                <span className="truncate flex-1">
                                  {t("graded")}
                                </span>
                                <span className="ml-1 font-semibold tabular-nums flex-shrink-0">
                                  {details.hwSummary?.graded ?? 0}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="pt-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full text-center min-w-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCourseSelect(course.courseNumber);
                              onNavigate && onNavigate("homework");
                            }}
                          >
                            <span className="truncate">
                              {t("viewDetails")} →
                            </span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default CourseCard;
