import { API_CONFIG, courseAPI, courseBase, courseVe } from "./constants";
import {
  currentSession,
  captchaSession,
  updateSessionCookies,
  handleSessionExpired,
} from "./auth";
import {
  getCachedData,
  setCachedData,
  COURSE_CACHE_DURATION,
  SCHEDULE_CACHE_DURATION,
} from "./cache";
import * as iconv from "iconv-lite";
import { ScheduleParser } from "./schedule-parser";
import { CourseDocumentType, ScheduleData } from "../shared/types";
import { Logger } from "./logger";

// Install axios interceptors to detect session expiration globally
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

      // For 200 responses, sometimes HTML is returned instead of JSON → expired
      const contentType = response.headers?.["content-type"] || "";
      const isHtml =
        typeof contentType === "string" && contentType.includes("text/html");
      if (response.status === 200 && isHtml) {
        Logger.event("HTML response detected - possible session expired");
        await handleSessionExpired();
        return Promise.reject(new Error("SESSION_EXPIRED"));
      }

      // If body is string and looks like HTML, also consider expired
      if (
        response.status === 200 &&
        typeof response.data === "string" &&
        (response.data.includes("<!DOCTYPE") || response.data.includes("<html"))
      ) {
        Logger.event("HTML body detected - possible session expired");
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

// File upload API function
export async function uploadFile(filePath: string, fileName: string) {
  if (!currentSession || !captchaSession) {
    throw new Error("Not logged in");
  }

  const FormData = require("form-data");
  const fs = require("fs");

  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), fileName);

  const url = `/rp/common/rpUpload.shtml;jsessionid=${captchaSession.jsessionId}`;

  const response = await courseAPI.post(url, form, {
    headers: {
      ...form.getHeaders(),
      Accept: "application/json, text/javascript, */*; q=0.01",
      Cookie: captchaSession.cookies.join("; "),
      Origin: API_CONFIG.ORIGIN,
      Referer: `${API_CONFIG.API_BASE_URL}/ve/`,
      "X-Requested-With": "XMLHttpRequest",
    },
    validateStatus: () => true,
  });

  if (response.status >= 200 && response.status < 300) {
    updateSessionCookies(response);

    if (typeof response.data === "object" && response.data.STATUS === "0") {
      return {
        success: true,
        data: response.data,
      };
    } else {
      return {
        success: false,
        error: "File upload failed",
      };
    }
  }

  throw new Error(`Upload failed with status: ${response.status}`);
}

// Homework submission API function
export async function submitHomework(submission: {
  upId: string;
  courseId: string;
  content?: string;
  fileList: Array<{
    fileNameNoExt: string;
    fileExtName: string;
    fileSize: string;
    visitName: string;
    pid: string;
    ftype: string;
  }>;
  groupName?: string;
  groupId?: string;
  jxrl_id?: string;
}) {
  if (!currentSession || !captchaSession) {
    throw new Error("Not logged in");
  }

  const formData = new URLSearchParams();
  formData.append("content", submission.content || "");
  formData.append("groupName", submission.groupName || "");
  formData.append("groupId", submission.groupId || "");
  formData.append("courseId", submission.courseId);
  formData.append("contentType", "0"); // 0=作业提交
  formData.append("fz", "0"); // 0=个人作业
  formData.append("jxrl_id", submission.jxrl_id || "");
  formData.append("upId", submission.upId);
  formData.append("return_num", "0");
  formData.append("isTeacher", "0"); // 0=学生
  formData.append("fileList", JSON.stringify(submission.fileList));

  const url = `/course/courseWorkInfo.shtml?method=sendStuHomeWorks`;

  const response = await courseAPI.post(url, formData, {
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: captchaSession.cookies.join("; "),
      Origin: API_CONFIG.ORIGIN,
      Referer: `${API_CONFIG.API_BASE_URL}/ve/`,
      "X-Requested-With": "XMLHttpRequest",
    },
    validateStatus: () => true,
  });

  if (response.status >= 200 && response.status < 300) {
    updateSessionCookies(response);

    // Empty response body indicates success
    return {
      success: true,
      message: "Homework submitted successfully",
    };
  }

  throw new Error(`Homework submission failed with status: ${response.status}`);
}

// Sanitization function for upload response
const _sanitizeUploadResponse = (uploadData: any): any => {
  return {
    id: uploadData.resSerId,
    fileName: decodeURIComponent(uploadData.fileNameNoExt),
    fileExtension: uploadData.fileExtName,
    fileSize: parseInt(uploadData.fileSize) || 0,
    serverPath: uploadData.visitName,
    relativePath: uploadData.path,
    uploadTime: uploadData.time,
    status: uploadData.STATUS === "0" ? "success" : "failed",
  };
};

// Sanitization function for submission response
const _sanitizeSubmissionResponse = (
  responseData: any,
  uploadedFilesCount: number
): any => {
  return {
    success: true,
    message: "Homework submitted successfully",
    submissionTime: new Date().toISOString(),
    filesSubmitted: uploadedFilesCount,
  };
};

// Helper function to fetch homework details
export async function fetchHomeworkDetails(
  homeworkId: string,
  courseId: string,
  teacherId: string
) {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  const url = `/coursePlatform/homeWork.shtml?method=queryStudentCourseNote&id=${homeworkId}&courseId=${courseId}&teacherId=${teacherId}`;

  const data = await authenticatedAPIRequest(url, true); // Use session ID

  if (data && data.homeWork) {
    // Process multiple attachments from picList and answerPicList
    const attachments: any[] = [];

    // Add attachments from picList (homework files)
    if (data.picList && Array.isArray(data.picList)) {
      attachments.push(
        ...data.picList.map((pic: any) => ({
          ...pic,
          type: "homework",
        }))
      );
    }

    // Add attachments from answerPicList (answer files)
    if (data.answerPicList && Array.isArray(data.answerPicList)) {
      attachments.push(
        ...data.answerPicList.map((pic: any) => ({
          ...pic,
          type: "answer",
        }))
      );
    }

    // If homework details has a single attachment (legacy format), add it too
    if (data.homeWork.url && data.homeWork.file_name) {
      const existingAttachment = attachments.find(
        (att) => att.url === data.homeWork.url
      );
      if (!existingAttachment) {
        attachments.push({
          id: data.homeWork.id,
          url: data.homeWork.url,
          file_name: data.homeWork.file_name,
          convert_url: data.homeWork.convert_url,
          pic_size: data.homeWork.pic_size,
          type: "homework",
        });
      }
    }

    // Add the processed attachments to homework details
    data.homeWork.attachments = attachments;

    // Sanitize the homework details
    const sanitizedDetails = sanitizeHomeworkDetails(data.homeWork);

    // Sanitize the response structure
    return {
      homeWork: sanitizedDetails,
      picList: data.picList?.map(sanitizeHomeworkAttachment) || [],
      answerPicList: data.answerPicList?.map(sanitizeHomeworkAttachment) || [],
      STATUS: data.STATUS,
      message: data.message,
    };
  }

  throw new Error("Failed to fetch homework details");
}

// Rate limiting queue
class RateLimitedQueue {
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

// Helper function for authenticated requests
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

// Helper function to fetch course list with proper semester code
export async function fetchCourseList() {
  // First get semester info
  const semesterUrl = `/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
  const semesterData = await authenticatedAPIRequest(semesterUrl);

  if (!semesterData.result || semesterData.result.length === 0) {
    throw new Error("Failed to get semester info");
  }

  const xqCode = semesterData.result[0].xqCode;
  const url = `/coursePlatform/course.shtml?method=getCourseList&pagesize=100&page=1&xqCode=${xqCode}`;
  const data = await authenticatedAPIRequest(url, true); // Use dynamic session ID

  if (data.courseList) {
    // Try to enrich course data with schedule information
    try {
      const scheduleData = await fetchScheduleData(false);

      // Create a map of schedule courses for quick lookup
      const scheduleCourseMap = new Map();
      scheduleData.weeks.forEach((week) => {
        week.days.forEach((day) => {
          day.entries.forEach((entry) => {
            const courseKey = entry.course.name.toLowerCase().trim();
            if (!scheduleCourseMap.has(courseKey)) {
              scheduleCourseMap.set(courseKey, []);
            }
            scheduleCourseMap.get(courseKey).push({
              dayOfWeek: entry.dayOfWeek,
              timeSlotId: entry.timeSlot.id,
              classroom: entry.course.classroom,
              weekNumbers: entry.weekNumbers,
              className: entry.course.className,
              studentCount: entry.course.studentCount,
            });
          });
        });
      });

      // Enrich course list with schedule info and sanitize
      const enrichedCourses = data.courseList.map((course: any) => {
        const courseKey = course.name.toLowerCase().trim();
        const scheduleInfo = scheduleCourseMap.get(courseKey);

        if (scheduleInfo && scheduleInfo.length > 0) {
          const courseWithSchedule = {
            ...course,
            schedule: {
              timeSlots: scheduleInfo,
              className: scheduleInfo[0].className,
              studentCount: scheduleInfo[0].studentCount,
            },
          };
          return sanitizeCourse(courseWithSchedule);
        }

        return sanitizeCourse(course);
      });

      Logger.event(
        `Enriched ${enrichedCourses.filter((c: any) => c.schedule).length} courses with schedule data`
      );
      return enrichedCourses;
    } catch (scheduleError) {
      Logger.warn(
        "Failed to enrich courses with schedule data, returning basic course list",
        scheduleError
      );
      // Still sanitize the basic course list
      return data.courseList.map(sanitizeCourse);
    }
  }
  throw new Error("Failed to get course list");
}

// Helper function to convert numeric type to English enum
const convertHomeworkType = (
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

// Helper function to convert document type string to English enum
const convertDocumentType = (docType: string): CourseDocumentType => {
  switch (docType) {
    case "1":
      return "courseware";
    case "10":
      return "experiment_guide";
    default:
      return "courseware";
  }
};

// Sanitization function to transform server response to clean structure
const sanitizeHomeworkItem = (hw: any): any => {
  return {
    id: hw.id,
    courseId: hw.course_id,
    courseName: hw.course_name || hw.courseName,
    title: hw.title,
    content: hw.content,
    dueDate: new Date(hw.end_time).toISOString(), // Serialize to ISO string for IPC
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
    submitDate: hw.subTime ? new Date(hw.subTime).toISOString() : null, // Serialize to ISO string for IPC
    submittedCount: hw.submitCount,
    totalStudents: hw.allCount,
    type: convertHomeworkType(hw.homeworkType || 0),
  };
};

// Sanitization function for homework details
const sanitizeHomeworkDetails = (details: any): any => {
  return {
    id: details.id,
    createdDate: new Date(details.create_date).toISOString(),
    courseId: details.course_id,
    courseSchedId: details.course_sched_id,
    content: details.content,
    title: details.title,
    dueDate: new Date(details.end_time).toISOString(),
    openDate: new Date(details.open_date).toISOString(),
    isFinalExam: Boolean(details.is_fz),
    maxScore: parseFloat(details.score) || 0,
    moduleId: details.moudel_id,
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
    selectedIds: details.xzIds,
    isGroupAssignment:
      details.is_group_stu === "1" || details.is_group_stu === 1,
    teacherWeight: details.teacher_weight,
    studentWeight: details.stu_weight,
    studentCompletion: Boolean(details.stu_completion),
    evaluationNumber: details.evaluation_num,
    attachments: details.attachments?.map(sanitizeHomeworkAttachment) || [],
  };
};

// Sanitization function for homework attachments
const sanitizeHomeworkAttachment = (attachment: any): any => {
  return {
    id: attachment.id,
    url: attachment.url,
    fileName: attachment.file_name,
    convertUrl: attachment.convert_url,
    fileSize: attachment.pic_size,
    type: attachment.type,
  };
};

// Helper function to fetch homework data
export async function fetchHomeworkData(courseId?: string) {
  const homeworkTypes = [
    { subType: 0, name: "普通作业" },
    { subType: 1, name: "课程报告" },
    { subType: 2, name: "实验作业" },
    { subType: 3, name: "平时测验" },
    { subType: 4, name: "结课考核" },
  ];
  if (courseId) {
    // Get homework for specific course
    const allHomework: any[] = [];
    for (const type of homeworkTypes) {
      const url = `/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${courseId}&subType=${type.subType}&page=1&pagesize=100`;

      try {
        const data = await authenticatedAPIRequest(url, true); // Use dynamic session ID
        if (data.courseNoteList && data.courseNoteList.length > 0) {
          const homework = data.courseNoteList.map((hw: any) =>
            sanitizeHomeworkItem({
              ...hw,
              homeworkType: type.subType,
            })
          );
          allHomework.push(...homework);
        }
      } catch (error) {
        Logger.error(`Failed to get ${type.name} for course`, error);
      }

      // Add delay between requests
      await new Promise((resolve) =>
        setTimeout(resolve, Math.floor(Math.random() * 951) + 50)
      );
    }

    return allHomework;
  } else {
    // Get all homework for all courses
    let courseList = getCachedData("courses", COURSE_CACHE_DURATION);

    if (!courseList) {
      Logger.event("Fetching fresh course list for homework");
      courseList = await fetchCourseList();
      setCachedData("courses", courseList);
    } else {
      Logger.event("Using cached course list for homework");
    }

    Logger.debug(`Found ${courseList.length} courses for homework fetching`);

    const allHomework: any[] = [];
    for (const course of courseList) {
      // Get homework for this course using the same method as above
      for (const type of homeworkTypes) {
        const url = `/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${course.id}&subType=${type.subType}&page=1&pagesize=100`;

        try {
          const data = await authenticatedAPIRequest(url, true); // Use dynamic session ID
          if (data.courseNoteList && data.courseNoteList.length > 0) {
            const homework = data.courseNoteList.map((hw: any) =>
              sanitizeHomeworkItem({
                ...hw,
                courseName: course.name,
                homeworkType: type.subType,
              })
            );
            allHomework.push(...homework);
          }
        } catch (error) {
          Logger.error(`Failed to get ${type.name} for course`, error);
        }

        // Add delay between requests
        await new Promise((resolve) =>
          setTimeout(resolve, Math.floor(Math.random() * 951) + 50)
        );
      }
    }

    return allHomework;
  }
}

// Track ongoing streaming operations to prevent race conditions
const ongoingStreamingOps = new Map<string, Promise<any>>();

// Streaming homework fetcher that yields results progressively
export async function* fetchHomeworkStreaming(
  courseId?: string,
  onProgress?: (progress: {
    completed: number;
    total: number;
    currentCourse?: string;
  }) => void,
  skipCache: boolean = false
) {
  const streamingKey = courseId ? `homework_${courseId}` : "all_homework";

  // Check if there's already an ongoing streaming operation for this key
  if (ongoingStreamingOps.has(streamingKey)) {
    Logger.debug(
      `Streaming operation already in progress for ${streamingKey}, waiting...`
    );
    await ongoingStreamingOps.get(streamingKey);
    return; // Exit early if operation was already in progress
  }

  const allHomework: any[] = []; // Accumulate all homework for complete cache update

  try {
    // Mark this streaming operation as in progress
    const streamingPromise = Promise.resolve();
    ongoingStreamingOps.set(streamingKey, streamingPromise);

    const homeworkTypes = [
      { subType: 0, name: "普通作业", priority: 1 },
      { subType: 3, name: "平时测验", priority: 0 }, // High priority for quizzes
      { subType: 4, name: "结课考核", priority: 0 }, // High priority for assessments
      { subType: 1, name: "课程报告", priority: 2 },
      { subType: 2, name: "实验作业", priority: 2 },
    ];

    if (courseId) {
      // Get homework for specific course
      const totalTasks = homeworkTypes.length;
      let completed = 0;

      // Sort by priority (urgent types first)
      const sortedTypes = [...homeworkTypes].sort(
        (a, b) => a.priority - b.priority
      );

      for (const type of sortedTypes) {
        if (onProgress) {
          onProgress({ completed, total: totalTasks, currentCourse: courseId });
        }

        const url = `/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${courseId}&subType=${type.subType}&page=1&pagesize=100`;

        try {
          const data = await authenticatedAPIRequest(url, true);
          if (data.courseNoteList && data.courseNoteList.length > 0) {
            const homework = data.courseNoteList.map((hw: any) =>
              sanitizeHomeworkItem({
                ...hw,
                homeworkType: type.subType,
              })
            );

            // Add to accumulated homework for cache
            allHomework.push(...homework);

            yield {
              homework,
              courseId,
              courseName: null,
              type: type.name,
            };
          }
        } catch (error) {
          Logger.error(`Failed to get ${type.name} for course`, error);
        }

        completed++;
        // Shorter delay for single course
        await new Promise((resolve) =>
          setTimeout(resolve, Math.floor(Math.random() * 301) + 50)
        );
      }
    } else {
      // Get all homework for all courses with intelligent batching
      let courseList = getCachedData("courses", COURSE_CACHE_DURATION);

      if (!courseList) {
        Logger.event("Fetching fresh course list for homework streaming");
        courseList = await fetchCourseList();
        setCachedData("courses", courseList);
      } else {
        Logger.event("Using cached course list for homework streaming");
      }

      Logger.debug(
        `Found ${courseList.length} courses for streaming homework fetching`
      );

      // Prioritize courses by recency (recent courses first)
      const sortedCourses = [...courseList].sort((a: any, b: any) => {
        const dateA = new Date(a.endDate || a.beginDate).getTime();
        const dateB = new Date(b.endDate || b.beginDate).getTime();
        return dateB - dateA; // Recent first
      });

      // Create batches of course-type combinations
      const batches: { course: any; type: any }[] = [];
      for (const course of sortedCourses) {
        const sortedTypes = [...homeworkTypes].sort(
          (a, b) => a.priority - b.priority
        );
        for (const type of sortedTypes) {
          batches.push({ course, type });
        }
      }

      const totalTasks = batches.length;
      let completed = 0;

      // Process batches with controlled concurrency
      const batchSize = 6; // Process 6 course-type combinations concurrently

      for (let i = 0; i < batches.length; i += batchSize) {
        const currentBatch = batches.slice(i, i + batchSize);

        // Process batch in parallel
        const batchPromises = currentBatch.map(async ({ course, type }) => {
          if (onProgress) {
            onProgress({
              completed,
              total: totalTasks,
              currentCourse: course.name,
            });
          }

          const url = `/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${course.id}&subType=${type.subType}&page=1&pagesize=100`;

          try {
            const data = await requestQueue.add(() =>
              authenticatedAPIRequest(url, true)
            );
            if (data.courseNoteList && data.courseNoteList.length > 0) {
              const homework = data.courseNoteList.map((hw: any) =>
                sanitizeHomeworkItem({
                  ...hw,
                  courseName: course.name,
                  homeworkType: type.subType,
                })
              );
              return {
                homework,
                courseId: course.id,
                courseName: course.name,
                type: type.name,
              };
            }
          } catch (error) {
            Logger.error(
              `Failed to get ${type.name} for course ${course.name}`,
              error
            );
          }
          return null;
        });

        // Wait for current batch to complete and yield results
        const batchResults = await Promise.all(batchPromises);

        for (const result of batchResults) {
          if (result && result.homework.length > 0) {
            // Add to accumulated homework for cache
            allHomework.push(...result.homework);

            yield result;
          }
          completed++;
        }

        // Small delay between batches to prevent overwhelming the server
        if (i + batchSize < batches.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Indicate completion for all courses
      if (onProgress) {
        onProgress({ completed: totalTasks, total: totalTasks });
      }
    }
  } finally {
    // Clean up and update cache with complete data (unless skipping cache)
    ongoingStreamingOps.delete(streamingKey);

    if (!skipCache && allHomework.length > 0) {
      setCachedData(streamingKey, allHomework);
      Logger.debug(
        `Updated cache for ${streamingKey} with ${allHomework.length} homework items`
      );
    } else {
      Logger.debug(
        `Completed homework streaming for ${streamingKey} with ${allHomework.length} homework items (cache ${skipCache ? "skipped" : "not updated due to no data"})`
      );
    }
  }
}

// Sanitization function for course documents
const sanitizeCourseDocument = (
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

// Sanitization function for courses
const sanitizeCourse = (course: any): any => {
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
    courseNumber: course.course_num,
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

// Helper function to fetch course documents with sanitization (fetches all document types)
export async function fetchCourseDocuments(courseCode: string) {
  const documentTypes = ["1", "10"]; // Electronic Courseware and Experiment Guide
  const allDocuments: any[] = [];

  for (const docType of documentTypes) {
    try {
      const documents = await fetchCourseDocumentsByType(courseCode, docType);
      allDocuments.push(...documents);
    } catch (error) {
      Logger.error(
        `Failed to fetch documents of type ${docType} for course ${courseCode}`,
        error
      );
      // Continue with other types even if one fails
    }
  }

  return allDocuments;
}

// Streaming document fetcher that yields results progressively
export async function* fetchDocumentsStreaming(
  courseId?: string,
  onProgress?: (progress: {
    completed: number;
    total: number;
    currentCourse?: string;
  }) => void,
  skipCache: boolean = false
) {
  const streamingKey = courseId ? `documents_${courseId}` : "all_documents";

  // Check if there's already an ongoing streaming operation for this key
  if (ongoingStreamingOps.has(streamingKey)) {
    Logger.debug(
      `Streaming operation already in progress for ${streamingKey}, waiting...`
    );
    await ongoingStreamingOps.get(streamingKey);
    return; // Exit early if operation was already in progress
  }

  const allDocuments: any[] = []; // Accumulate all documents for complete cache update

  try {
    // Mark this streaming operation as in progress
    const streamingPromise = Promise.resolve();
    ongoingStreamingOps.set(streamingKey, streamingPromise);

    const documentTypes = [
      { docType: "1", name: "Electronic Courseware" },
      { docType: "10", name: "Experiment Guide" },
    ];

    if (courseId) {
      // Get documents for specific course
      const totalTasks = documentTypes.length;
      let completed = 0;

      // Sort by priority
      for (const type of documentTypes) {
        if (onProgress) {
          onProgress({ completed, total: totalTasks, currentCourse: courseId });
        }

        try {
          const documents = await fetchCourseDocumentsByType(
            courseId,
            type.docType
          );

          // Add to accumulated documents for cache (even if empty)
          allDocuments.push(...documents);

          // Always yield, even if no documents found
          yield {
            documents,
            courseId,
            courseName: null,
            type: type.name,
          };
        } catch (error) {
          Logger.error(`Failed to get ${type.name} for course`, error);
          // Still yield empty result for this type
          yield {
            documents: [],
            courseId,
            courseName: null,
            type: type.name,
          };
        }

        completed++;
        // Add delay between requests
        await new Promise((resolve) =>
          setTimeout(resolve, Math.floor(Math.random() * 301) + 50)
        );
      }
    } else {
      // Get all documents for all courses
      let courseList = getCachedData("courses", COURSE_CACHE_DURATION);

      if (!courseList) {
        Logger.event("Fetching fresh course list for document streaming");
        courseList = await fetchCourseList();
        setCachedData("courses", courseList);
      } else {
        Logger.event("Using cached course list for document streaming");
      }

      Logger.debug(
        `Found ${courseList.length} courses for streaming document fetching`
      );

      // Create batches of course-type combinations
      const batches: { course: any; type: any }[] = [];
      for (const course of courseList) {
        for (const type of documentTypes) {
          batches.push({ course, type });
        }
      }

      const totalTasks = batches.length;
      let completed = 0;

      // Process batches with controlled concurrency
      const batchSize = 4; // Process 4 course-type combinations concurrently

      for (let i = 0; i < batches.length; i += batchSize) {
        const currentBatch = batches.slice(i, i + batchSize);

        // Process batch in parallel
        const batchPromises = currentBatch.map(async ({ course, type }) => {
          if (onProgress) {
            onProgress({
              completed,
              total: totalTasks,
              currentCourse: course.name,
            });
          }

          try {
            const documents = await requestQueue.add(() =>
              fetchCourseDocumentsByType(course.courseNumber, type.docType)
            );

            if (documents.length > 0) {
              return {
                documents,
                courseId: course.courseNumber,
                courseName: course.name,
                type: type.name,
                isComplete: false,
              };
            }
          } catch (error) {
            Logger.error(
              `Failed to get ${type.name} for course ${course.name}`,
              error
            );
          }
          return null;
        });

        // Wait for current batch to complete and yield results
        const batchResults = await Promise.all(batchPromises);

        for (const result of batchResults) {
          if (result && result.documents.length > 0) {
            // Add to accumulated documents for cache
            allDocuments.push(...result.documents);

            yield result;
          }
          completed++;
        }

        // Small delay between batches to prevent overwhelming the server
        if (i + batchSize < batches.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Indicate completion for all courses
      if (onProgress) {
        onProgress({ completed: totalTasks, total: totalTasks });
      }
    }
  } finally {
    // Clean up and update cache with complete data (unless skipping cache)
    ongoingStreamingOps.delete(streamingKey);

    if (!skipCache && allDocuments.length > 0) {
      setCachedData(streamingKey, allDocuments);
      Logger.debug(
        `Updated cache for ${streamingKey} with ${allDocuments.length} document items`
      );
    } else {
      Logger.debug(
        `Completed document streaming for ${streamingKey} with ${allDocuments.length} document items (cache ${skipCache ? "skipped" : "not updated due to no data"})`
      );
    }
  }
}

// Helper function to fetch course documents by type
async function fetchCourseDocumentsByType(courseCode: string, docType: string) {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  // Get semester info first to get xqCode
  const semesterUrl = `/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
  const semesterData = await authenticatedAPIRequest(semesterUrl);

  if (!semesterData.result || semesterData.result.length === 0) {
    throw new Error("Failed to get semester info");
  }

  const xqCode = semesterData.result[0].xqCode;

  // Get course list to find the full course details (prefer cache)
  let courseList = getCachedData("courses", COURSE_CACHE_DURATION);
  if (!courseList) {
    courseList = await fetchCourseList();
    setCachedData("courses", courseList);
  }

  const course = courseList.find((c: any) => c.courseNumber === courseCode);
  if (!course) {
    throw new Error(`Course not found: ${courseCode}`);
  }

  // Construct xkhId using course information
  const xkhId = course.facilityId || `${xqCode}-${courseCode}`;

  // Construct the course documents URL with specific docType
  const url = `/coursePlatform/courseResource.shtml?method=stuQueryUploadResourceForCourseList&courseId=${courseCode}&cId=${courseCode}&xkhId=${xkhId}&xqCode=${xqCode}&docType=${docType}&up_id=0&searchName=`;

  const data = await authenticatedAPIRequest(url, true); // Use session ID

  if (data && Array.isArray(data.resList)) {
    // Sanitize all documents
    const sanitizedDocuments = data.resList.map((a: any) =>
      sanitizeCourseDocument(a, convertDocumentType(docType))
    );
    return sanitizedDocuments;
  }

  return []; // No documents
}

// Helper function to fetch and parse schedule data
export async function fetchScheduleData(
  forceRefresh: boolean = false
): Promise<ScheduleData> {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  const sessionId = "2021112401";
  const cacheKey = `schedule_${sessionId}`;

  // Check cache first unless force refresh is requested
  if (!forceRefresh) {
    const cachedData = getCachedData(cacheKey, SCHEDULE_CACHE_DURATION);
    if (cachedData) {
      Logger.event("Using cached schedule data");
      return cachedData;
    }
  }

  const url = `/rp/common/myTimeTableDetail.shtml?method=skipIndex&sessionId=${sessionId}`;

  try {
    const response = await courseAPI.get(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        Cookie: captchaSession ? captchaSession.cookies.join("; ") : "",
        Referer: `${API_CONFIG.API_BASE_URL}/ve/`,
        "User-Agent": API_CONFIG.HEADERS["User-Agent"],
      },
      responseType: "arraybuffer", // Get raw bytes for GBK decoding
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 300) {
      updateSessionCookies(response);

      // Decode GBK content to UTF-8
      const decodedHtml = iconv.decode(Buffer.from(response.data), "gbk");

      // Use new parser to transform HTML into structured data
      const scheduleData = await ScheduleParser.parseAndTransform(decodedHtml);

      // Cache the result with custom TTL
      setCachedData(cacheKey, scheduleData, SCHEDULE_CACHE_DURATION);

      Logger.event(
        `Schedule data transformed: ${scheduleData.statistics.totalCourses} courses, ${scheduleData.weeks[0]?.metadata.conflicts.length || 0} conflicts`
      );
      return scheduleData;
    }

    throw new Error(`Request failed with status: ${response.status}`);
  } catch (error) {
    Logger.error("Failed to fetch schedule", error);
    throw error;
  }
}
