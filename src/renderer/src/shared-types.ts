export interface Course {
  id: string;
  name: string;
  code: string;
  instructor: string;
  description?: string;
  semester: string;
  year: number;
}

export interface Homework {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: Date;
  submissionType: 'file' | 'text' | 'online';
  maxPoints: number;
  isCompleted: boolean;
  submittedAt?: Date;
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