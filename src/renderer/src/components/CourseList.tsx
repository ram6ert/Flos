import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Course } from "../../../shared/types";
import { Container, PageHeader, Button, Grid } from "./common/StyledComponents";
import CourseCard from "./CourseCard";

interface CourseListProps {
  courses: Course[];
  onCourseSelect: (course: string | null) => void;
  onRefresh?: () => Promise<void>;
  selectedCourse?: Course | null;
  onNavigate?: (
    view: "courses" | "homework" | "documents" | "flow-schedule"
  ) => void;
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

  // Fetch course images through main process
  useEffect(() => {
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
          {courses.map((course) => {
            // Check if this course matches the selected course (handles Course vs ScheduleCourse)
            return (
              <CourseCard
                key={course.id}
                course={course}
                image={courseImages[course.id] || null}
                isSelected={selectedCourse?.id === course.id}
                onCourseSelect={onCourseSelect}
                onNavigate={onNavigate}
              />
            );
          })}
        </Grid>
      )}
    </Container>
  );
};

export default CourseList;
