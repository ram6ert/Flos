// Clean document-related type definitions

export interface CourseDocument {
  id: string; // rpId from server, transformed from number to string
  auditStatus: 'pending' | 'approved' | 'rejected'; // transformed from number
  name: string; // rpName from server
  size: string; // rpSize from server
  playUrl: string | null; // play_url from server
  resourceUrl: string; // res_url from server
  isPublic: boolean; // isPublic from server (number to boolean)
  uploadTime: string; // inputTime from server, transformed to ISO string
  clickCount: number; // clicks from server
  downloadCount: number; // downloadNum from server
  resourceId: number; // resId from server
  teacherId: string;
  teacherName: string;
  documentType: string; // docType from server
  fileExtension: string; // extName from server
  shareType: 'private' | 'public' | 'course'; // share_type from server (number to enum)
  studentDownloadCount: number; // stu_download from server
}

export interface CourseDocumentsResponse {
  documents: CourseDocument[]; // resList from server, sanitized
  bagList: string;
  status: string; // STATUS from server
}