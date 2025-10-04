export type CourseDocumentType = "courseware" | "experiment_guide";

export interface CourseDocument {
  id: string; // Internal numeric document ID (string, e.g., "12345")
  auditStatus: "pending" | "approved" | "rejected"; // transformed from number
  name: string; // rpName from server
  size: string; // rpSize from server
  playUrl: string | null; // play_url from server
  resourceUrl: string; // res_url from server
  isPublic: boolean; // isPublic from server (number to boolean)
  uploadTime: string; // inputTime from server, transformed to ISO string
  clickCount: number; // clicks from server
  downloadCount: number; // downloadNum from server
  resourceId: number; // Internal numeric resource ID
  teacherId: string; // Internal numeric teacher ID (string, e.g., "67890")
  teacherName: string;
  documentType: CourseDocumentType; // Parsed document type enum
  fileExtension: string; // extName from server
  shareType: "private" | "public" | "course"; // share_type from server (number to enum)
  studentDownloadCount: number; // stu_download from server
}

export interface CourseDocumentsResponse {
  documents: CourseDocument[]; // resList from server, sanitized
  bagList: string;
  status: string; // STATUS from server
}

export interface DocumentStreamChunk {
  documents: CourseDocument[];
  courseId?: string;
  courseName?: string | null;
  fromCache?: boolean;
}

export interface DocumentStreamProgress {
  completed: number;
  total: number;
  currentCourse?: string;
}
