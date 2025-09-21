export const API_CONFIG = {
  BASE_URL: "http://123.121.147.7:88/ve",
  USER_AGENT:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
  TIMEOUT: 30000,

  // Session IDs for different request types
  // These are static identifiers sent as "Sessionid" headers (not related to JSESSIONID cookies)
  // The backend requires these specific values for certain API endpoints
  SESSION_IDS: {
    GET_COURSE_LIST: "06E588F49BBB5D7CCF299C45D4C0468A", // Required for getCourseList endpoint
    GET_HOMEWORK_LIST: "06E588F49BBB5D7CCF299C45D4C0468A", // Required for getHomeWorkList endpoint
  },
  ENDPOINTS: {
    // Authentication endpoints
    LOGIN: "/s.shtml",
    CAPTCHA: "/GetImg",

    // Backend API endpoints (under /back)
    SEMESTER_INFO: "/back/rp/common/teachCalendar.shtml?method=queryCurrentXq",
    COURSE_LIST: "/back/coursePlatform/course.shtml?method=getCourseList",
    HOMEWORK_LIST: "/back/coursePlatform/homeWork.shtml?method=getHomeWorkList",
  },

  // Helper methods for building URLs with parameters
  buildCourseListUrl: (pageSize = 100, page = 1, xqCode?: string) => {
    const params = new URLSearchParams({
      method: "getCourseList",
      pagesize: pageSize.toString(),
      page: page.toString(),
    });
    if (xqCode) {
      params.append("xqCode", xqCode);
    }
    return `/back/coursePlatform/course.shtml?${params.toString()}`;
  },

  buildHomeworkListUrl: (
    courseId: string,
    subType: number,
    pageSize = 100,
    page = 1
  ) => {
    const params = new URLSearchParams({
      method: "getHomeWorkList",
      cId: courseId,
      subType: subType.toString(),
      page: page.toString(),
      pagesize: pageSize.toString(),
    });
    return `/back/coursePlatform/homeWork.shtml?${params.toString()}`;
  },
};
