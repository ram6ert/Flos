import React from "react";
import { Course } from "../shared-types";

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
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [courseImages, setCourseImages] = React.useState<
    Record<number, string | null>
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
        if (course.pic && !courseImages[course.id]) {
          try {
            const imageData = await window.electronAPI.fetchCourseImage(
              course.pic
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
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2>My Courses</h2>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: isRefreshing ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isRefreshing ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
            }}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>
      <div style={{ marginTop: "1.5rem" }}>
        {courses.length === 0 ? (
          <p>No courses available.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            }}
          >
            {courses.map((course) => (
              <div
                key={course.id}
                className="course-card"
                onClick={() => onCourseSelect(course)}
                style={{
                  cursor: "pointer",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "1rem",
                  backgroundColor: "#fff",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  display: "flex",
                  flexDirection: "column",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 8px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                }}
              >
                {courseImages[course.id] && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <img
                      src={courseImages[course.id]!}
                      alt={course.name}
                      style={{
                        width: "100%",
                        height: "120px",
                        objectFit: "cover",
                        borderRadius: "4px",
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: "0 0 0.5rem 0",
                      fontSize: "1.1rem",
                      color: "#333",
                    }}
                  >
                    {course.name}
                  </h3>

                  <p
                    style={{
                      margin: "0 0 0.5rem 0",
                      color: "#666",
                      fontSize: "0.9rem",
                    }}
                  >
                    <strong>课程号:</strong> {course.course_num}
                  </p>

                  <p
                    style={{
                      margin: "0 0 0.5rem 0",
                      color: "#666",
                      fontSize: "0.9rem",
                    }}
                  >
                    <strong>授课教师:</strong> {course.teacher_name}
                  </p>

                  <p
                    style={{ margin: "0", color: "#888", fontSize: "0.85rem" }}
                  >
                    <strong>学期:</strong>{" "}
                    {formatSemesterDates(course.begin_date, course.end_date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseList;
