import { platform, arch, release } from "os";
import axios from "axios";
import { app } from "electron";

// Generate randomized User-Agent adapted to user's device
function generateUserAgent(): string {
  const currentPlatform = platform();
  const currentArch = arch();
  const osVersion = release();

  // Chrome version variations (recent stable versions)
  const chromeVersions = ["131.0.0.0", "130.0.0.0", "129.0.0.0", "128.0.0.0"];

  // WebKit versions
  const webkitVersions = ["537.36", "537.35", "537.34"];

  // Safari versions
  const safariVersions = ["537.36", "537.35", "537.34"];

  // Edge versions
  const edgeVersions = ["131.0.0.0", "130.0.0.0", "129.0.0.0"];

  // Randomly select versions
  const chromeVersion =
    chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
  const webkitVersion =
    webkitVersions[Math.floor(Math.random() * webkitVersions.length)];
  const safariVersion =
    safariVersions[Math.floor(Math.random() * safariVersions.length)];
  const edgeVersion =
    edgeVersions[Math.floor(Math.random() * edgeVersions.length)];

  // Generate OS-specific user agent
  switch (currentPlatform) {
    case "darwin": {
      // macOS detection
      const macVersionMap: Record<string, string> = {
        "24": "15_0", // macOS 15 (Sequoia)
        "23": "14_0", // macOS 14 (Sonoma)
        "22": "13_0", // macOS 13 (Ventura)
        "21": "12_0", // macOS 12 (Monterey)
        "20": "11_0", // macOS 11 (Big Sur)
        "19": "10_15_7", // macOS 10.15 (Catalina)
      };

      const majorVersion = osVersion.split(".")[0];
      const macVersion = macVersionMap[majorVersion] || "10_15_7";
      const architecture = currentArch === "arm64" ? "Intel" : "Intel"; // Keep Intel for compatibility

      return `Mozilla/5.0 (Macintosh; ${architecture} Mac OS X ${macVersion}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${safariVersion} Edg/${edgeVersion}`;
    }

    case "win32": {
      const windowsVersions = [
        "Windows NT 10.0; Win64; x64",
        "Windows NT 10.0; WOW64",
        "Windows NT 6.3; Win64; x64",
        "Windows NT 6.1; Win64; x64",
      ];
      const winVersion =
        windowsVersions[Math.floor(Math.random() * windowsVersions.length)];

      return `Mozilla/5.0 (${winVersion}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${safariVersion} Edg/${edgeVersion}`;
    }

    case "linux": {
      const linuxArchs =
        currentArch === "x64" ? "X11; Linux x86_64" : "X11; Linux i686";
      return `Mozilla/5.0 (${linuxArchs}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${safariVersion}`;
    }

    default: {
      // Fallback to a generic modern user agent
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${safariVersion}`;
    }
  }
}

// Generate Accept-Language header based on user's language preference
function getAcceptLanguage() {
  if (app.getLocale().startsWith("zh")) {
    return "zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7,en-GB;q=0.6,en-US;q=0.5";
  } else {
    return "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7";
  }
}

export const API_CONFIG = {
  API_BASE_URL: "http://123.121.147.7:88/ve/back",
  VE_BASE_URL: "http://123.121.147.7:88/ve/back",
  BASE_URL: "http://123.121.147.7:88", // Documents don't use /ve
  ORIGIN: "http://123.121.147.7:88",
  USER_AGENT: generateUserAgent(),
  TIMEOUT: 30000,

  // Common constant HTTP headers
  HEADERS: {
    "User-Agent": generateUserAgent(),
    "Accept-Language": getAcceptLanguage(),
  },

  ENDPOINTS: {
    // Authentication endpoints
    LOGIN: "/s.shtml",
    CAPTCHA: "/GetImg",

    // Backend API endpoints (under /back)
    SEMESTER_INFO: "/back/rp/common/teachCalendar.shtml?method=queryCurrentXq",
    COURSE_LIST: "/back/coursePlatform/course.shtml?method=getCourseList",
    HOMEWORK_LIST: "/back/coursePlatform/homeWork.shtml?method=getHomeWorkList",
    COURSE_DOCUMENTS:
      "/back/coursePlatform/courseResource.shtml?method=stuQueryUploadResourceForCourseList",
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

// Create dedicated axios instance for course platform API calls
export const courseAPI = axios.create({
  baseURL: API_CONFIG.API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    ...API_CONFIG.HEADERS,
  },
});

export const courseVe = axios.create({
  baseURL: API_CONFIG.VE_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    ...API_CONFIG.HEADERS,
  },
});

export const courseBase = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    ...API_CONFIG.HEADERS,
  },
});
