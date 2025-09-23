// Clean course-related type definitions

export interface Course {
  id: number;
  name: string;
  courseNumber: string; // course_num from server
  picture: string; // pic from server
  teacherId: number; // teacher_id from server
  teacherName: string; // teacher_name from server
  startDate: string; // begin_date from server, ISO string
  endDate: string; // end_date from server, ISO string
  type: number;
  selectiveCourseId: number | null; // selective_course_id from server
  departmentId: string; // fz_id from server
  semesterCode: string; // xq_code from server
  boy: string; // unclear field, keeping as-is
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
  rows: number;
  page: number;
  currentRows: number;
  total: number;
  totalPage: number;
}