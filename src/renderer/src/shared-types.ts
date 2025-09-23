export interface Course {
  id: number;
  name: string;
  course_num: string;
  pic: string;
  teacher_id: number;
  teacher_name: string;
  begin_date: string;
  end_date: string;
  type: number;
  selective_course_id: number | null;
  fz_id: string;
  xq_code: string;
  boy: string;
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
  courseList: Course[];
  STATUS: string;
  message: string;
  rows: number;
  page: number;
  currentRows: number;
  total: number;
  totalPage: number;
}





export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  content: string;
  publishedAt: Date;
  isImportant: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
  passcode: string;
}

export interface UserSession {
  username: string;
  requestId: string;
  isLoggedIn: boolean;
  loginTime: Date;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  requestId?: string;
}

// Schedule types
export interface TimeSlot {
  id: string; // e.g., "1-2" for periods 1-2
  startPeriod: number; // 1-based period number
  endPeriod: number;
  startTime: string; // "08:00"
  endTime: string; // "09:40"
  label: string; // "第1-2节"
}

export interface ScheduleCourse {
  id: string;
  name: string;
  teacher: string;
  classroom: string;
  className: string;
  studentCount: number;
  credits?: number;
  courseType?: string; // "必修" | "选修" | "实践"
}

export interface ScheduleEntry {
  id: string; // unique identifier
  course: ScheduleCourse;
  timeSlot: TimeSlot;
  dayOfWeek: number; // 0 = Monday, 6 = Sunday
  weekNumbers: number[]; // [1, 3, 5] for weeks when this course occurs
  recurrence?: {
    type: "weekly" | "biweekly" | "custom";
    pattern?: string;
  };
}

export interface DaySchedule {
  dayOfWeek: number;
  date: string; // "2025-09-22"
  entries: ScheduleEntry[];
  conflicts: ScheduleConflict[];
}

export interface ScheduleConflict {
  timeSlot: TimeSlot;
  conflictingEntries: ScheduleEntry[];
  severity: "warning" | "error";
  message: string;
}

export interface WeekSchedule {
  weekNumber: number;
  year: number;
  startDate: string; // "2025-09-22"
  endDate: string; // "2025-09-28"
  days: DaySchedule[];
  metadata: {
    totalCourses: number;
    totalHours: number;
    conflicts: ScheduleConflict[];
    lastUpdated: string;
  };
}

export interface ScheduleData {
  semester: {
    id: string;
    name: string; // "2025-2026学年第一学期"
    startDate: string;
    endDate: string;
  };
  weeks: WeekSchedule[];
  courses: { [courseId: string]: ScheduleCourse };
  timeSlots: { [timeSlotId: string]: TimeSlot };
  statistics: {
    totalWeeks: number;
    totalCourses: number;
    averageHoursPerWeek: number;
    busyDays: number[];
    freeDays: number[];
  };
}
