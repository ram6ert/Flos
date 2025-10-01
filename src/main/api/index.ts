/**
 * Main API module entry point
 *
 * This module aggregates and re-exports all API functionality from specialized modules:
 * - utils: Session management, rate limiting, and sanitization utilities
 * - homework: Homework submission, fetching, and file operations
 * - course: Course list fetching and management
 * - document: Document fetching and streaming
 * - schedule: Schedule data fetching and parsing
 */

// Export all utilities
export {
  setupAxiosSessionInterceptors,
  RateLimitedQueue,
  requestQueue,
  authenticatedAPIRequest,
  sanitizeCourse,
  convertHomeworkType,
  convertDocumentType,
  sanitizeHomeworkItem,
  sanitizeHomeworkAttachment,
  sanitizeHomeworkDetails,
  sanitizeCourseDocument,
} from "./utils";

// Export homework operations
export {
  uploadFile,
  submitHomework,
  fetchHomeworkDetails,
  fetchHomeworkList,
  fetchHomeworkStreaming,
  fetchHomeworkDownloadPage,
  parseHomeworkDownloadUrls,
  downloadSubmittedHomeworkFile,
} from "./homework";

// Export course operations
export { fetchCourseList, getCourseList } from "./course";

// Export document operations
export { fetchCourseDocuments, fetchDocumentsStreaming } from "./document";

// Export schedule operations
export { fetchScheduleData } from "./schedule";
