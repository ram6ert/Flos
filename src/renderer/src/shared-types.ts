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

export interface ScheduleEntry {
  courseId: string;
  courseName: string;
  teacherName: string;
  className: string;
  studentCount: number;
  classroom: string;
  timeSlot: string;
  dayOfWeek: number; // 0 = Monday, 6 = Sunday
}

export interface WeekSchedule {
  weekNumber: number;
  beginDate: string;
  endDate: string;
  entries: ScheduleEntry[];
}

export interface ScheduleResponse {
  schedule: WeekSchedule;
  STATUS: string;
  message?: string;
}
