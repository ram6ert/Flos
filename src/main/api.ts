import axios from "axios";
import { API_CONFIG } from "./constants";
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
import { ScheduleData } from "../shared/types";
import { Logger } from "./logger";

// Helper function to fetch homework details
export async function fetchHomeworkDetails(
  homeworkId: string,
  courseId: string,
  teacherId: string
) {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/homeWork.shtml?method=queryStudentCourseNote&id=${homeworkId}&courseId=${courseId}&teacherId=${teacherId}`;

  const data = await authenticatedRequest(url, true); // Use session ID

  if (data && data.homeWork) {
    // Process multiple attachments from picList and answerPicList
    const attachments = [];

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
      message: data.message
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
export async function authenticatedRequest(
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
    const captchaResponse = await axios.get(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CAPTCHA}`,
      {
        headers: {
          Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language":
            "zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7,en-GB;q=0.6,en-US;q=0.5",
          "Cache-Control": "max-age=0",
          Connection: "keep-alive",
          Referer: `${API_CONFIG.BASE_URL}/ve/`,
          "User-Agent": API_CONFIG.USER_AGENT,
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
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    Cookie: cookieHeader,
    Referer: `${API_CONFIG.BASE_URL}/ve/`,
    "User-Agent": API_CONFIG.USER_AGENT,
    "X-Requested-With": "XMLHttpRequest",
  };

  // Add Sessionid header for specific API endpoints that require it
  if (useSessionId && currentSession?.sessionId) {
    headers["Sessionid"] = currentSession.sessionId;
  }

  const response = await axios.get(url, {
    headers,
    validateStatus: () => true,
  });

  if (response.status >= 200 && response.status < 400) {
    // Always update session cookies from successful responses
    updateSessionCookies(response);

    // Check for session expiration indicators
    if (typeof response.data === "string") {
      if (
        response.data.includes("登录") ||
        response.data.includes("login") ||
        response.data.includes("not logged")
      ) {
        Logger.event("Session expiration detected");
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }
    }

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
        // If JSON parsing fails but we got a response, it might indicate session issues
        if (
          response.data.includes("html") ||
          response.data.includes("<!DOCTYPE")
        ) {
          Logger.event("HTML response detected - session expired");
          await handleSessionExpired();
          throw new Error("SESSION_EXPIRED");
        }
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
  const semesterUrl = `${API_CONFIG.BASE_URL}/back/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
  const semesterData = await authenticatedRequest(semesterUrl);

  if (!semesterData.result || semesterData.result.length === 0) {
    throw new Error("Failed to get semester info");
  }

  const xqCode = semesterData.result[0].xqCode;
  const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/course.shtml?method=getCourseList&pagesize=100&page=1&xqCode=${xqCode}`;
  const data = await authenticatedRequest(url, true); // Use dynamic session ID

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
const convertHomeworkType = (numericType: number): 'homework' | 'report' | 'experiment' | 'quiz' | 'assessment' => {
  switch (numericType) {
    case 0: return 'homework';
    case 1: return 'report';
    case 2: return 'experiment';
    case 3: return 'quiz';
    case 4: return 'assessment';
    default: return 'homework';
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
    submissionStatus: hw.subStatus === "已提交" ? 'submitted' :
                     hw.stu_score !== null && hw.stu_score !== undefined && hw.stu_score !== "未公布成绩" ? 'graded' :
                     'not_submitted',
    studentScore: hw.stu_score && hw.stu_score !== "未公布成绩" && hw.stu_score !== "暂未公布" ?
                  parseFloat(hw.stu_score) : null,
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
    isAnswerPublished: details.is_publish_answer === "1" || details.is_publish_answer === 1,
    status: details.status,
    referenceAnswer: details.ref_answer,
    reviewMethod: details.review_method,
    url: details.url,
    fileName: details.file_name,
    convertUrl: details.convert_url,
    fileSize: details.pic_size,
    makeupTime: details.makeup_time ? new Date(details.makeup_time).toISOString() : null,
    isRepeatAllowed: Boolean(details.is_repeat),
    makeupFlag: details.makeup_flag,
    selectedIds: details.xzIds,
    isGroupAssignment: details.is_group_stu === "1" || details.is_group_stu === 1,
    teacherWeight: details.teacher_weight,
    studentWeight: details.stu_weight,
    studentCompletion: Boolean(details.stu_completion),
    evaluationNumber: details.evaluation_num,
    attachments: details.attachments?.map(sanitizeHomeworkAttachment) || []
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
    type: attachment.type
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
    const allHomework = [];
    for (const type of homeworkTypes) {
      const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${courseId}&subType=${type.subType}&page=1&pagesize=100`;

      try {
        const data = await authenticatedRequest(url, true); // Use dynamic session ID
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

    const allHomework = [];
    for (const course of courseList) {
      // Get homework for this course using the same method as above
      for (const type of homeworkTypes) {
        const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${course.id}&subType=${type.subType}&page=1&pagesize=100`;

        try {
          const data = await authenticatedRequest(url, true); // Use dynamic session ID
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

// Sanitization function for course documents
const sanitizeCourseDocument = (doc: any): any => {
  // Map audit status numbers to readable strings
  const getAuditStatus = (status: number): 'pending' | 'approved' | 'rejected' => {
    switch (status) {
      case 1: return 'approved';
      case 2: return 'rejected';
      case 0:
      default: return 'pending';
    }
  };

  // Map share type numbers to readable strings
  const getShareType = (type: number): 'private' | 'public' | 'course' => {
    switch (type) {
      case 1: return 'public';
      case 2: return 'course';
      case 0:
      default: return 'private';
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
    documentType: doc.docType,
    fileExtension: doc.extName,
    shareType: getShareType(doc.share_type),
    studentDownloadCount: doc.stu_download
  };
};

// Sanitization function for courses
const sanitizeCourse = (course: any): any => {
  // Map course type numbers to readable strings
  const getCourseType = (type: number): 'required' | 'elective' | 'practice' => {
    switch (type) {
      case 1: return 'elective';
      case 2: return 'practice';
      case 0:
      default: return 'required';
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
    selectiveCourseId: course.selective_course_id ? String(course.selective_course_id) : null,
    facilityId: course.fz_id,
    semesterCode: course.xq_code,
    boy: course.boy,
    schedule: course.schedule // Keep schedule as-is for now since it's already clean
  };
};

// Helper function to fetch course documents with sanitization
export async function fetchCourseDocuments(courseCode: string) {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  // Get semester info first to get xqCode
  const semesterUrl = `${API_CONFIG.BASE_URL}/back/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
  const semesterData = await authenticatedRequest(semesterUrl);

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

  // Construct the course documents URL
  const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/courseResource.shtml?method=stuQueryUploadResourceForCourseList&courseId=${courseCode}&cId=${courseCode}&xkhId=${xkhId}&xqCode=${xqCode}&docType=1&up_id=0&searchName=`;

  const data = await authenticatedRequest(url, true); // Use session ID

  if (data && Array.isArray(data.resList)) {
    // Sanitize all documents
    const sanitizedDocuments = data.resList.map(sanitizeCourseDocument);
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

  const url = `${API_CONFIG.BASE_URL}/back/rp/common/myTimeTableDetail.shtml?method=skipIndex&sessionId=${sessionId}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        Cookie: captchaSession ? captchaSession.cookies.join("; ") : "",
        Referer: `${API_CONFIG.BASE_URL}/ve/`,
        "User-Agent": API_CONFIG.USER_AGENT,
      },
      responseType: "arraybuffer", // Get raw bytes for GBK decoding
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 400) {
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
