export interface Course {
  id: string; // transformed from number to string
  name: string;
  courseNumber: string; // course_num from server
  picture: string; // pic from server
  teacherId: string; // teacher_id from server, transformed from number to string
  teacherName: string; // teacher_name from server
  beginDate: string; // begin_date from server, transformed to ISO string
  endDate: string; // end_date from server, transformed to ISO string
  type: "required" | "elective" | "practice"; // type from server (number to enum)
  selectiveCourseId: string | null; // selective_course_id from server, transformed from number to string
  facilityId: string; // fz_id from server
  semesterCode: string; // xq_code from server
  boy: string; // boy from server (unclear purpose, keeping as-is)
  schedule?: CourseScheduleInfo;
}

export interface CourseScheduleInfo {
  timeSlots: Array<{
    dayOfWeek: number; // 0 = Monday, 6 = Sunday
    timeSlotId: string; // e.g., "1-2", "3-4"
    classroom: string;
    weekNumbers: number[]; // Which weeks this schedule applies
  }>;
  className?: string;
  studentCount?: number;
}

export interface CourseListResponse {
  courses: Course[]; // courseList from server, sanitized
  status: string; // STATUS from server
  message: string;
  totalRows: number; // rows from server
  currentPage: number; // page from server
  currentRows: number;
  totalItems: number; // total from server
  totalPages: number; // totalPage from server
}
