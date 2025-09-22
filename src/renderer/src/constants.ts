export const API_CONFIG = {
  BASE_URL: "http://123.121.147.7:88",
  USER_AGENT:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
  TIMEOUT: 30000,
  ENDPOINTS: {
    // Authentication endpoints (under /ve)
    LOGIN: "/ve/s.shtml",
    CAPTCHA: "/ve/GetImg",
    VE_ROOT: "/ve/",

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
