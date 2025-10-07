import { getCachedData, COURSE_CACHE_DURATION } from "../cache";
import { Logger } from "../logger";
import { Course } from "../../shared/types";
import { authenticatedAPIRequest, sanitizeCourse } from "./utils";

/**
 * Fetch course list with semester code and enrich with schedule data
 */
export async function fetchCourseList() {
  // First get semester info
  const semesterUrl = `/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
  const semesterData = await authenticatedAPIRequest(semesterUrl);

  if (!semesterData.result || semesterData.result.length === 0) {
    throw new Error("Failed to get semester info");
  }

  const xqCode = semesterData.result[0].xqCode;
  const url = `/coursePlatform/course.shtml?method=getCourseList&pagesize=100&page=1&xqCode=${xqCode}`;
  const data = await authenticatedAPIRequest(url, true);

  if (data.courseList) {
    // Try to enrich course data with schedule information
    try {
      const { fetchScheduleData } = await import("./schedule");
      const scheduleData = await fetchScheduleData(false);

      // Create a map of schedule courses for quick lookup
      const scheduleCourseMap = new Map();
      scheduleData.weeks.forEach((week) => {
        week.days.forEach((day) => {
          day.entries.forEach((entry) => {
            const courseKey = entry.course.name.toLowerCase().trim();
            if (!scheduleCourseMap.has(courseKey)) {
              scheduleCourseMap.set(courseKey, []);
            }
            scheduleCourseMap.get(courseKey).push({
              dayOfWeek: entry.dayOfWeek,
              timeSlotId: entry.timeSlot.id,
              classroom: entry.course.classroom,
              weekNumbers: entry.weekNumbers,
              className: entry.course.className,
              studentCount: entry.course.studentCount,
            });
          });
        });
      });

      // Enrich course list with schedule info and sanitize
      const enrichedCourses = data.courseList.map((course: any) => {
        const courseKey = course.name.toLowerCase().trim();
        const scheduleInfo = scheduleCourseMap.get(courseKey);

        if (scheduleInfo && scheduleInfo.length > 0) {
          const courseWithSchedule = {
            ...course,
            schedule: {
              timeSlots: scheduleInfo,
              className: scheduleInfo[0].className,
              studentCount: scheduleInfo[0].studentCount,
            },
          };
          return sanitizeCourse(courseWithSchedule);
        }

        return sanitizeCourse(course);
      });

      Logger.event(
        `Enriched ${enrichedCourses.filter((c: any) => c.schedule).length} courses with schedule data`
      );
      return enrichedCourses;
    } catch (scheduleError) {
      Logger.warn(
        "Failed to enrich courses with schedule data, returning basic course list",
        scheduleError
      );
      // Still sanitize the basic course list
      return data.courseList.map(sanitizeCourse);
    }
  }
  throw new Error("Failed to get course list");
}

/**
 * Get course list with caching
 */
export async function getCourseList(): Promise<Course[]> {
  const courseList = getCachedData("courses", COURSE_CACHE_DURATION);
  if (courseList) {
    Logger.event("Using cached course list");
    return courseList;
  }
  return await fetchCourseList();
}
