import { API_CONFIG, courseAPI } from "../constants";
import {
  currentSession,
  captchaSession,
  updateSessionCookies,
} from "../auth";
import { Logger } from "../logger";
import * as cheerio from "cheerio";
import * as iconv from "iconv-lite";
import axios from "axios";
import { Homework } from "../../shared/types";
import {
  authenticatedAPIRequest,
  requestQueue,
  sanitizeHomeworkItem,
  sanitizeHomeworkDetails,
} from "./utils";

/**
 * Upload file for homework submission
 */
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

/**
 * Submit homework with content and files
 */
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

/**
 * Fetch detailed homework information
 */
export async function fetchHomeworkDetails(
  homeworkId: string,
  courseId: string,
  teacherId: string
) {
  if (!currentSession) {
    throw new Error("Not logged in");
  }

  const url = `/coursePlatform/homeWork.shtml?method=queryStudentCourseNote&id=${homeworkId}&courseId=${courseId}&teacherId=${teacherId}`;

  const data = await authenticatedAPIRequest(url, true);

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
    return sanitizedDetails;
  }

  throw new Error("Failed to fetch homework details");
}

/**
 * Fetch homework list for a specific course or all courses
 */
export async function fetchHomeworkList(courseId?: string) {
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
        const data = await authenticatedAPIRequest(url, true);
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
    // Import getCourseList dynamically to avoid circular dependency
    const { getCourseList } = await import("./course");
    let courseList = await getCourseList();
    Logger.debug(`Found ${courseList.length} courses for homework fetching`);

    const allHomework: any[] = [];
    for (const course of courseList) {
      for (const type of homeworkTypes) {
        const url = `/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${course.id}&subType=${type.subType}&page=1&pagesize=100`;

        try {
          const data = await authenticatedAPIRequest(url, true);
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

/**
 * Streaming homework fetcher that yields results progressively
 */
export async function* fetchHomeworkStreaming(
  courseId?: string,
  onProgress?: (progress: {
    completed: number;
    total: number;
    currentCourse?: string;
  }) => void
) {
  const allHomework: Homework[] = [];

  try {
    const homeworkTypes = [
      { subType: 0, name: "普通作业", priority: 1 },
      { subType: 3, name: "平时测验", priority: 0 },
      { subType: 4, name: "结课考核", priority: 0 },
      { subType: 1, name: "课程报告", priority: 2 },
      { subType: 2, name: "实验作业", priority: 2 },
    ];

    if (courseId) {
      // Get homework for specific course
      const totalTasks = homeworkTypes.length;
      let completed = 0;

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
        await new Promise((resolve) =>
          setTimeout(resolve, Math.floor(Math.random() * 301) + 50)
        );
      }
    } else {
      // Get all homework for all courses
      const { getCourseList } = await import("./course");
      let courseList = await getCourseList();

      Logger.debug(
        `Found ${courseList.length} courses for streaming homework fetching`
      );

      const sortedCourses = [...courseList].sort((a: any, b: any) => {
        const dateA = new Date(a.endDate || a.beginDate).getTime();
        const dateB = new Date(b.endDate || b.beginDate).getTime();
        return dateB - dateA;
      });

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
      const batchSize = 6;

      for (let i = 0; i < batches.length; i += batchSize) {
        const currentBatch = batches.slice(i, i + batchSize);

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

        const batchResults = await Promise.all(batchPromises);

        for (const result of batchResults) {
          if (result && result.homework.length > 0) {
            allHomework.push(...result.homework);
            yield result;
          }
          completed++;
        }

        if (i + batchSize < batches.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (onProgress) {
        onProgress({ completed: totalTasks, total: totalTasks });
      }
    }
  } catch (error) {
    Logger.error("Error during homework streaming", error);
  }
}

/**
 * Fetch homework download page HTML
 */
export async function fetchHomeworkDownloadPage(
  upId: string,
  id: string,
  userId: string,
  score: string
) {
  if (!currentSession || !captchaSession) {
    throw new Error("Not logged in");
  }

  const url = `/course/courseWorkInfo.shtml?method=piGaiDiv&upId=${upId}&id=${id}&userId=${userId}&score=${score}&uLevel=1&type=1&username=null`;

  const response = await courseAPI.get(url, {
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      Cookie: captchaSession.cookies.join("; "),
      Referer: `${API_CONFIG.API_BASE_URL}/ve/`,
      "User-Agent": API_CONFIG.HEADERS["User-Agent"],
      sessionId: currentSession.sessionId,
    },
    responseType: "arraybuffer",
    validateStatus: () => true,
  });

  if (response.status >= 200 && response.status < 300) {
    updateSessionCookies(response);

    // Decode GBK content to UTF-8
    const decodedHtml = iconv.decode(Buffer.from(response.data), "gbk");
    return decodedHtml;
  }

  throw new Error(`Request failed with status: ${response.status}`);
}

/**
 * Parse HTML to extract homework download URLs
 */
export function parseHomeworkDownloadUrls(html: string) {
  const $ = cheerio.load(html);
  const downloadUrls: Array<{
    fileName: string;
    url: string;
    id: string;
    type: "my_homework";
  }> = [];

  // Look for download links using regex
  const downloadFileRegex = /downloadFile\('([^']+)','([^']+)','([^']+)'\)/g;
  let match;

  while ((match = downloadFileRegex.exec(html)) !== null) {
    const [, url, fileName, id] = match;
    downloadUrls.push({
      fileName,
      url,
      id,
      type: "my_homework",
    });
  }

  // Look for download links in onclick attributes
  $('.homeworkContent[onclick*="downloadFile"]').each((index, element) => {
    const onclickAttr = $(element).attr("onclick");
    if (onclickAttr) {
      const match = onclickAttr.match(
        /downloadFile\('([^']+)','([^']+)','([^']+)'\)/
      );
      if (match) {
        const [, url, fileName, id] = match;
        if (!downloadUrls.some((item) => item.url === url)) {
          downloadUrls.push({
            fileName,
            url,
            id,
            type: "my_homework",
          });
        }
      }
    }
  });

  // Look for attachment divs with picUrlaaa class
  $(".picUrlaaa").each((index, element) => {
    const url = $(element).text().trim();
    if (url) {
      const fileName =
        $(element).siblings(".homeworkContent").text().trim() ||
        `homework_${index + 1}`;
      const idElement = $(element).siblings(".picIdaaa");
      const id =
        idElement.length > 0 ? idElement.text().trim() : `id_${index + 1}`;

      if (!downloadUrls.some((item) => item.url === url)) {
        downloadUrls.push({
          fileName,
          url,
          id,
          type: "my_homework",
        });
      }
    }
  });

  return downloadUrls;
}

/**
 * Download submitted homework file
 */
export async function downloadSubmittedHomeworkFile(
  url: string,
  fileName: string,
  id: string
) {
  if (!currentSession || !captchaSession) {
    throw new Error("Not logged in");
  }

  try {
    const downloadUrl = `${API_CONFIG.VE_BASE_URL}//downloadZyFj.shtml?path=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName)}&id=${id}`;
    if (
      !downloadUrl.startsWith("/") &&
      !downloadUrl.startsWith(API_CONFIG.VE_BASE_URL)
    ) {
      throw new Error("Invalid download URL");
    }

    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      headers: {
        Cookie: captchaSession.cookies.join("; "),
        sessionId: currentSession.sessionId,
        ...API_CONFIG.HEADERS,
      },
      timeout: 60000,
    });

    if (response.status >= 200 && response.status < 300) {
      updateSessionCookies(response);

      const buffer = Buffer.from(response.data);
      const base64 = buffer.toString("base64");
      const contentType =
        response.headers["content-type"] || "application/octet-stream";

      return {
        success: true,
        data: base64,
        contentType,
        fileName,
        fileSize: buffer.length,
      };
    }

    throw new Error(`Download failed with status: ${response.status}`);
  } catch (error) {
    Logger.error("Failed to download submitted homework file:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}
