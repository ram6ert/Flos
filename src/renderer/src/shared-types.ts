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

export interface Homework {
  id: number;
  course_id: number;
  course_name: string;
  title: string;
  content: string;
  end_time: string;
  score: string;
  subStatus: string;
  stu_score: string;
  subTime: string | null;
  submitCount: number;
  allCount: number;
}

export interface HomeworkDetails {
  id: number;
  create_date: string;
  course_id: number;
  course_sched_id: number;
  content: string;
  title: string;
  end_time: string;
  open_date: string;
  is_fz: number;
  score: string;
  moudel_id: number;
  isOpen: number;
  is_publish_answer: string;
  status: string;
  ref_answer: string;
  review_method: string;
  url: string;
  file_name: string;
  convert_url: string;
  pic_size: number;
  makeup_time: string;
  is_repeat: number;
  makeup_flag: string;
  xzIds: string | null;
  is_group_stu: string;
  teacher_weight: number;
  stu_weight: number;
  stu_completion: number;
  evaluation_num: number;
}

export interface HomeworkAttachment {
  id: number;
  url: string;
  file_name: string;
  convert_url: string;
  pic_size: number;
}

export interface HomeworkDetailsResponse {
  homeWork: HomeworkDetails;
  picList: HomeworkAttachment[];
  answerPicList: HomeworkAttachment[];
  STATUS: string;
  message: string;
}

export interface HomeworkListResponse {
  courseNoteList: Homework[];
  page: number;
  size: number;
  currentRow: number;
  total: number;
  totalPage: number;
  STATUS: string;
  message: string;
}

export interface CourseDocument {
  rpId: string;
  auditStatus: number;
  rpName: string;
  rpSize: string;
  play_url: string | null;
  res_url: string;
  isPublic: number;
  inputTime: string;
  clicks: number;
  downloadNum: number;
  resId: number;
  teacherId: string;
  teacherName: string;
  docType: string;
  extName: string;
  share_type: number;
  stu_download: number;
}

export interface CourseDocumentsResponse {
  resList: CourseDocument[];
  bagList: string;
  STATUS: string;
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
