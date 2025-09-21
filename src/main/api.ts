import axios from 'axios';
import { API_CONFIG } from './constants';
import { currentSession, captchaSession, updateSessionCookies } from './auth';
import { getCachedData, setCachedData, CACHE_DURATION, COURSE_CACHE_DURATION } from './cache';

// Rate limiting queue
class RateLimitedQueue {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;
  private maxConcurrency = 2;

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
      // Add random delay between 50-1000ms
      const delay = Math.floor(Math.random() * 951) + 50;
      setTimeout(() => this.process(), delay);
    }
  }
}

export const requestQueue = new RateLimitedQueue();

// Helper function for authenticated requests
export async function authenticatedRequest(url: string, useSessionId: boolean = false): Promise<any> {
  if (!currentSession) {
    throw new Error('Not logged in');
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
          Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7,en-GB;q=0.6,en-US;q=0.5',
          'Cache-Control': 'max-age=0',
          Connection: 'keep-alive',
          Referer: `${API_CONFIG.BASE_URL}/ve/`,
          'User-Agent': API_CONFIG.USER_AGENT,
        },
        responseType: 'arraybuffer',
        validateStatus: () => true,
      }
    );

    updateSessionCookies(captchaResponse, 'authenticated-request-captcha');
    activeSession = captchaSession;
  }

  // Use the session cookies for the actual request
  const cookieHeader = activeSession ? activeSession.cookies.join('; ') : '';

  // Prepare headers
  const headers: any = {
    Accept: '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    Cookie: cookieHeader,
    Referer: `${API_CONFIG.BASE_URL}/ve/`,
    'User-Agent': API_CONFIG.USER_AGENT,
    'X-Requested-With': 'XMLHttpRequest',
  };

  // Add Sessionid header for specific API endpoints that require it
  if (useSessionId && currentSession?.sessionId) {
    headers['Sessionid'] = currentSession.sessionId;
  }

  const response = await axios.get(url, {
    headers,
    validateStatus: () => true,
  });

  if (response.status >= 200 && response.status < 400) {
    // Always update session cookies from successful responses
    updateSessionCookies(response, 'authenticated-request');

    // Check for session expiration indicators
    if (typeof response.data === 'string') {
      if (
        response.data.includes('您还未登录') ||
        response.data.includes('请登录') ||
        response.data.includes('login') ||
        response.data.includes('<title>登录</title>')
      ) {
        throw new Error('Session expired or not logged in');
      }
    }

    // Try to parse as JSON if it's expected to be JSON
    if (
      typeof response.data === 'string' &&
      response.data.trim().startsWith('{')
    ) {
      try {
        return JSON.parse(response.data);
      } catch (parseError) {
        console.warn(
          'Failed to parse JSON response, treating as string:',
          response.data.substring(0, 200)
        );
        // If JSON parsing fails but we got a response, it might indicate session issues
        if (
          response.data.includes('html') ||
          response.data.includes('<!DOCTYPE')
        ) {
          throw new Error(
            'Received HTML response instead of JSON - session likely expired'
          );
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
    throw new Error('Failed to get semester info');
  }

  const xqCode = semesterData.result[0].xqCode;
  const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/course.shtml?method=getCourseList&pagesize=100&page=1&xqCode=${xqCode}`;
  const data = await authenticatedRequest(url, true); // Use dynamic session ID

  if (data.courseList) {
    return data.courseList;
  }
  throw new Error('Failed to get course list');
}

// Helper function to fetch homework data
export async function fetchHomeworkData(courseId?: string) {
  if (courseId) {
    // Get homework for specific course
    const homeworkTypes = [
      { subType: 0, name: '普通作业' },
      { subType: 1, name: '课程报告' },
      { subType: 2, name: '实验作业' },
    ];

    const allHomework = [];
    for (const type of homeworkTypes) {
      const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${courseId}&subType=${type.subType}&page=1&pagesize=100`;

      try {
        const data = await authenticatedRequest(url, true); // Use dynamic session ID
        if (data.courseNoteList && data.courseNoteList.length > 0) {
          const homework = data.courseNoteList.map((hw: any) => ({
            ...hw,
            homeworkType: type.name,
          }));
          allHomework.push(...homework);
        }
      } catch (error) {
        console.error(
          `Failed to get ${type.name} for course ${courseId}:`,
          error
        );
      }

      // Add delay between requests
      await new Promise((resolve) =>
        setTimeout(resolve, Math.floor(Math.random() * 951) + 50)
      );
    }

    return allHomework;
  } else {
    // Get all homework for all courses
    let courseList = getCachedData('courses', COURSE_CACHE_DURATION);

    if (!courseList) {
      console.log('Fetching fresh course list for homework');
      courseList = await fetchCourseList();
      setCachedData('courses', courseList);
    } else {
      console.log('Using cached course list for homework');
    }

    console.log(`Found ${courseList.length} courses for homework fetching`);

    const allHomework = [];
    for (const course of courseList) {
      // Get homework for this course using the same method as above
      const homeworkTypes = [
        { subType: 0, name: '普通作业' },
        { subType: 1, name: '课程报告' },
        { subType: 2, name: '实验作业' },
      ];

      for (const type of homeworkTypes) {
        const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${course.id}&subType=${type.subType}&page=1&pagesize=100`;

        try {
          const data = await authenticatedRequest(url, true); // Use dynamic session ID
          if (data.courseNoteList && data.courseNoteList.length > 0) {
            const homework = data.courseNoteList.map((hw: any) => ({
              ...hw,
              courseName: course.name,
              homeworkType: type.name,
            }));
            allHomework.push(...homework);
          }
        } catch (error) {
          console.error(
            `Failed to get ${type.name} for course ${course.name}:`,
            error
          );
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