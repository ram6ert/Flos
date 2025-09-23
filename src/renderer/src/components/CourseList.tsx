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

interface CourseListProps {
  courses: Course[];
  onCourseSelect: (course: Course) => void;
  onRefresh?: () => Promise<void>;
}

const CourseList: React.FC<CourseListProps> = ({
  courses,
  onCourseSelect,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [courseImages, setCourseImages] = React.useState<
    Record<string, string | null>
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
          {courses.map((course) => (
            <Card
              key={course.id}
              onClick={() => onCourseSelect(course)}
              className="course-card flex flex-col"
            >
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
                <h3 className="m-0 mb-2 text-lg text-gray-900 font-semibold">
                  {course.name}
                </h3>

                <p className="m-0 mb-2 text-gray-700 text-sm">
                  <strong>{t("courseNumber")}:</strong> {course.courseNumber}
                </p>

                <p className="m-0 mb-2 text-gray-700 text-sm">
                  <strong>{t("instructor")}:</strong> {course.teacherName}
                </p>

                <p className="m-0 text-gray-600 text-xs">
                  <strong>{t("semester")}:</strong>{" "}
                  {formatSemesterDates(course.beginDate, course.endDate)}
                </p>
              </div>
            </Card>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default CourseList;
