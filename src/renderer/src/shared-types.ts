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

export interface Document {
  id: string;
  courseId: string;
  title: string;
  type: 'lecture' | 'assignment' | 'reading' | 'reference';
  url: string;
  uploadedAt: Date;
  size?: number;
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