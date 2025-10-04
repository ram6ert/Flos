import { API_CONFIG, courseAPI, courseBase, courseVe } from "../constants";
import {
  currentSession,
  captchaSession,
  updateSessionCookies,
  handleSessionExpired,
} from "../auth";
import { Logger } from "../logger";
import {
  CourseDocumentType,
  Homework,
  HomeworkDetails,
} from "../../shared/types";

/**
 * Install axios interceptors to detect session expiration globally
 */
export function setupAxiosSessionInterceptors(): void {
  const instances = [courseAPI, courseVe, courseBase];

  const onResponse = async (response: any) => {
    try {
      // Allow opt-out per request
      const cfg: any = response.config || {};
      if (cfg.skipSessionInterceptor === true) return response;

      // Ignore login endpoint redirects on courseVe
      const urlStr: string = cfg.url || "";
      if (urlStr.includes(API_CONFIG.ENDPOINTS.LOGIN)) {
        return response;
      }

      // 3xx means redirect → treat as session expired
      if (response.status >= 300 && response.status < 400) {
        Logger.event("Session expiration detected (3xx)");
        await handleSessionExpired();
        return Promise.reject(new Error("SESSION_EXPIRED"));
      }
    } catch (error) {
      // fallthrough to reject below
    }
    return response;
  };

  const onError = async (error: any) => {
    const status = error?.response?.status;
    if (status >= 300 && status < 400) {
      Logger.event("Session expiration detected (3xx error)");
      await handleSessionExpired();
      return Promise.reject(new Error("SESSION_EXPIRED"));
    }

    // Network or other errors pass through
    return Promise.reject(error);
  };

  for (const instance of instances) {
    // Avoid double installation
    const hasMarker = (instance as any).__sessionInterceptorInstalled;
    if (hasMarker) continue;
    instance.interceptors.response.use(onResponse, onError);
    (instance as any).__sessionInterceptorInstalled = true;
  }
}

/**
 * Rate limiting queue for API requests
 */
export class RateLimitedQueue {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;
  private maxConcurrency = 3;

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const task = this.queue.shift()!;

    try {
      await task();
    } finally {
      this.running--;
      // Add random delay between 30-500ms for faster processing
      const delay = Math.floor(Math.random() * 471) + 30;
      setTimeout(() => this.process(), delay);
    }
  }
}

export const requestQueue = new RateLimitedQueue();

/**
 * Helper function for authenticated API requests
 */
export async function authenticatedAPIRequest(
  url: string,
  useSessionId: boolean = false
): Promise<any> {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  // Get fresh session by re-fetching captcha and using current credentials
  let activeSession = captchaSession;

  // If no active session, try to get one
  if (!activeSession) {
    // Fetch fresh captcha to get session
    const captchaResponse = await courseAPI.get(
      `${API_CONFIG.ENDPOINTS.CAPTCHA}`,
      {
        headers: {
          Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
          "Cache-Control": "max-age=0",
          Referer: `${API_CONFIG.API_BASE_URL}/ve/`,
        },
        responseType: "arraybuffer",
        validateStatus: () => true,
      }
    );

    updateSessionCookies(captchaResponse);
    activeSession = captchaSession;
  }

  // Use the session cookies for the actual request
  const cookieHeader = activeSession ? activeSession.cookies.join("; ") : "";

  // Prepare headers
  const headers: any = {
    Accept: "*/*",
    Cookie: cookieHeader,
    Referer: `${API_CONFIG.API_BASE_URL}/ve/`,
    "X-Requested-With": "XMLHttpRequest",
  };

  // Add Sessionid header for specific API endpoints that require it
  if (useSessionId && currentSession?.sessionId) {
    headers["Sessionid"] = currentSession.sessionId;
  }

  const response = await courseAPI.get(url, {
    headers,
    validateStatus: () => true,
  });

  if (response.status >= 200 && response.status < 300) {
    // Always update session cookies from successful responses
    updateSessionCookies(response);

    // Try to parse as JSON if it's expected to be JSON
    if (
      typeof response.data === "string" &&
      response.data.trim().startsWith("{")
    ) {
      try {
        return JSON.parse(response.data);
      } catch (parseError) {
        Logger.debug(
          "Failed to parse JSON response, treating as string:",
          response.data.substring(0, 200)
        );
        return response.data;
      }
    }

    return response.data;
  }

  throw new Error(`Request failed with status: ${response.status}`);
}

/**
 * Sanitization function for courses
 */
export const sanitizeCourse = (course: any): any => {
  // Map course type numbers to readable strings
  const getCourseType = (
    type: number
  ): "required" | "elective" | "practice" => {
    switch (type) {
      case 1:
        return "elective";
      case 2:
        return "practice";
      case 0:
      default:
        return "required";
    }
  };

  return {
    id: String(course.id),
    name: course.name,
    courseCode: course.course_num,
    picture: course.pic,
    teacherId: String(course.teacher_id),
    teacherName: course.teacher_name,
    beginDate: new Date(course.begin_date).toISOString(),
    endDate: new Date(course.end_date).toISOString(),
    type: getCourseType(course.type),
    selectiveCourseId: course.selective_course_id
      ? String(course.selective_course_id)
      : null,
    facilityId: course.fz_id,
    semesterCode: course.xq_code,
    boy: course.boy,
    schedule: course.schedule, // Keep schedule as-is for now since it's already clean
  };
};

/**
 * Helper function to convert numeric homework type to English enum
 */
export const convertHomeworkType = (
  numericType: number
): "homework" | "report" | "experiment" | "quiz" | "assessment" => {
  switch (numericType) {
    case 0:
      return "homework";
    case 1:
      return "report";
    case 2:
      return "experiment";
    case 3:
      return "quiz";
    case 4:
      return "assessment";
    default:
      return "homework";
  }
};

/**
 * Helper function to convert document type string to English enum
 */
export const convertDocumentType = (docType: string): CourseDocumentType => {
  switch (docType) {
    case "1":
      return "courseware";
    case "10":
      return "experiment_guide";
    default:
      return "courseware";
  }
};

/**
 * Sanitization function to transform server homework response to clean structure
 */
export const sanitizeHomeworkItem = (hw: any): Homework => {
  return {
    id: hw.id.toString(),
    courseId: hw.course_id.toString(),
    courseName: hw.course_name || hw.courseName,
    title: hw.title,
    content: hw.content,
    dueDate: new Date(hw.end_time).toISOString(),
    maxScore: parseFloat(hw.score) || 0,
    submissionStatus:
      hw.subStatus === "已提交"
        ? "submitted"
        : hw.stu_score !== null &&
            hw.stu_score !== undefined &&
            hw.stu_score !== "未公布成绩"
          ? "graded"
          : "not_submitted",
    studentScore:
      hw.stu_score &&
      hw.stu_score !== "未公布成绩" &&
      hw.stu_score !== "暂未公布"
        ? parseFloat(hw.stu_score)
        : null,
    submitDate: hw.subTime ? new Date(hw.subTime).toISOString() : null,
    submittedCount: hw.submitCount,
    totalStudents: hw.allCount,
    type: convertHomeworkType(hw.homeworkType || 0),
    submissionId: hw.snId?.toString() || hw.subId?.toString() || null,
    userId: hw.user_id?.toString() || "0",
  };
};

/**
 * Sanitization function for homework attachments
 */
export const sanitizeHomeworkAttachment = (attachment: any): any => {
  return {
    id: attachment.id,
    url: attachment.url,
    fileName: attachment.file_name,
    convertUrl: attachment.convert_url,
    fileSize: attachment.pic_size,
    type: attachment.type,
  };
};

/**
 * Sanitization function for homework details
 */
export const sanitizeHomeworkDetails = (details: any): HomeworkDetails => {
  return {
    id: details.id.toString(),
    createdDate: new Date(details.create_date).toISOString(),
    courseId: details.course_id.toString(),
    courseSchedId: details.course_sched_id,
    content: details.content,
    title: details.title,
    dueDate: new Date(details.end_time).toISOString(),
    openDate: new Date(details.open_date).toISOString(),
    isFinalExam: Boolean(details.is_fz),
    maxScore: parseFloat(details.score) || 0,
    moduleId: details.moudel_id.toString(),
    isOpen: Boolean(details.isOpen),
    isAnswerPublished:
      details.is_publish_answer === "1" || details.is_publish_answer === 1,
    status: details.status,
    referenceAnswer: details.ref_answer,
    reviewMethod: details.review_method,
    url: details.url,
    fileName: details.file_name,
    convertUrl: details.convert_url,
    fileSize: details.pic_size,
    makeupTime: details.makeup_time
      ? new Date(details.makeup_time).toISOString()
      : null,
    isRepeatAllowed: Boolean(details.is_repeat),
    makeupFlag: details.makeup_flag,
    selectedIds: details.xzIds?.toString(),
    isGroupAssignment:
      details.is_group_stu === "1" || details.is_group_stu === 1,
    teacherWeight: details.teacher_weight,
    studentWeight: details.stu_weight,
    studentCompletion: Boolean(details.stu_completion),
    evaluationNumber: details.evaluation_num,
    attachments: details.attachments?.map(sanitizeHomeworkAttachment) || [],
  };
};

/**
 * Sanitization function for course documents
 */
export const sanitizeCourseDocument = (
  doc: any,
  documentType: CourseDocumentType
): any => {
  // Map audit status numbers to readable strings
  const getAuditStatus = (
    status: number
  ): "pending" | "approved" | "rejected" => {
    switch (status) {
      case 1:
        return "approved";
      case 2:
        return "rejected";
      case 0:
      default:
        return "pending";
    }
  };

  // Map share type numbers to readable strings
  const getShareType = (type: number): "private" | "public" | "course" => {
    switch (type) {
      case 1:
        return "public";
      case 2:
        return "course";
      case 0:
      default:
        return "private";
    }
  };

  return {
    id: String(doc.rpId),
    auditStatus: getAuditStatus(doc.auditStatus),
    name: doc.rpName,
    size: doc.rpSize,
    playUrl: doc.play_url,
    resourceUrl: doc.res_url,
    isPublic: Boolean(doc.isPublic),
    uploadTime: new Date(doc.inputTime).toISOString(),
    clickCount: doc.clicks,
    downloadCount: doc.downloadNum,
    resourceId: doc.resId,
    teacherId: doc.teacherId,
    teacherName: doc.teacherName,
    documentType,
    fileExtension: doc.extName,
    shareType: getShareType(doc.share_type),
    studentDownloadCount: doc.stu_download,
  };
};
