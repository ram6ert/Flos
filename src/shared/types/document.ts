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

export interface DocumentDirectory {
  id: string; // Internal numeric directory ID (string, e.g., "4245")
  name: string; // bag_name from server - directory name
  content: string; // bag_content from server - directory description/content
  upId: string; // up_id from server - parent directory ID (0 for root)
  teacherId: string; // teacher_id from server
  courseCode: string; // course_code from server
  facilityId: string; // fz_id from server
  tagLevel: number; // tag_level from server
  sequence: string; // sequ from server
  addTime: string; // add_time from server
  resourceType: string; // resource_type from server
  tId: number; // tId from server
  showType: number; // show_type from server
  sort: number; // sort from server
  shareType: number; // share_type from server
}

export interface CourseDocumentsResponse {
  documents: CourseDocument[]; // resList from server, sanitized
  directories: DocumentDirectory[]; // bagList from server, sanitized
  // status: string; // STATUS from server - just an indicator, commented out
}

export interface DocumentStreamChunk {
  documents: CourseDocument[];
  directories?: DocumentDirectory[];
  courseId?: string;
  courseName?: string | null;
  fromCache?: boolean;
}

export interface DocumentStreamProgress {
  completed: number;
  total: number;
  currentCourse?: string;
}
