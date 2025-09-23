import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const resources = {
  en: {
    translation: {
      // Navigation and Layout
      myCourses: "My Courses",
      refresh: "Refresh",
      refreshing: "Refreshing...",
      noCourses: "No courses available.",

      // Course Details
      courseNumber: "Course Number",
      instructor: "Instructor",
      semester: "Semester",

      // Common Actions
      back: "Back",
      loading: "Loading...",
      error: "Error",

      // Login
      login: "Login",
      username: "Username",
      password: "Password",
      loginButton: "Sign In",
      loginFailed: "Login Failed",
      signingIn: "Signing in...",
      verificationCode: "Verification Code",
      enterStudentId: "Enter your student ID",
      enterPassword: "Enter your password",
      enterCaptcha: "Enter captcha",
      clickToRefresh: "Click to refresh",

      // Course Content
      assignments: "Assignments",
      announcements: "Announcements",
      materials: "Course Materials",
      schedule: "Schedule",
      homework: "Homework",
      documents: "Documents",
      courses: "Courses",
      flowSchedule: "Course Flow Schedule",

      // Actions
      download: "Download",
      downloading: "Downloading...",
      retry: "Retry",
      viewDetails: "View Details",
      hideDetails: "Hide Details",

      // Error Messages
      unableToLoadDocuments: "Unable to Load Documents",
      unableToLoadHomework: "Unable to Load Homework",
      failedToLoadSchedule: "Failed to Load Schedule",
      tryAgain: "Try Again",

      // Schedule
      week: "Week",
      teacher: "Teacher",
      room: "Room",
      currentlyOngoing: "Currently ongoing!",

      // Status
      completed: "Completed",
      pending: "Pending",
      overdue: "Overdue",
      submitted: "Submitted",
      notSubmitted: "Not Submitted",
      graded: "Graded",
      gradeNotPublished: "Grade not published",
      notPublishedYet: "Not published yet",
      yes: "Yes",
      no: "No",

      // Settings
      settings: "Settings",
      language: "Language",
      theme: "Theme",

      // Logout
      logout: "Logout",
      logoutAndClear: "Logout & clear",

      // Homework List
      loadingHomework: "Loading homework...",
      filter: "Filter",
      sortBy: "Sort by",
      remainingTime: "Remaining Time",
      dueDate: "Due Date",
      course: "Course",
      status: "Status",
      type: "Type",
      normalHomework: "Normal Homework",
      courseReport: "Course Report",
      experimentHomework: "Experiment Homework",
      regularQuiz: "Regular Quiz",
      finalAssessment: "Final Assessment",
      unknownType: "Unknown Type",
      noHomeworkFound: "No homework found for the selected filter.",
      maxScore: "Max Score",
      due: "Due",
      students: "students",
      grade: "Grade",
      submittedAt: "Submitted at",
      homeworkDetails: "Homework Details",
      created: "Created",
      openDate: "Open Date",
      answer: "Answer",
      repeatAllowed: "Repeat Allowed",
      fullDescription: "Full Description",
      attachments: "Attachments",
      size: "Size",
      showingCachedData: "Showing cached data ({{minutes}} minutes old)",
      showingFreshData: "Showing fresh data",
      noHomeworkDataAvailable: "No homework data available",
      authenticationRequired:
        "Please log in to view homework data. Authentication required.",
      sessionExpired: "Your session has expired. Please log in again.",
      failedToFetchHomework:
        "Failed to fetch homework data. Please try again later.",
      unexpectedError: "An unexpected error occurred while fetching homework.",
      dataUpdatedInBackground: "Data updated in background",
      failedToLoadHomeworkDetails:
        "Failed to load homework details. Please try again.",
      overdueDaysHours: "Overdue {{days}}d {{hours}}h",
      overdueHours: "Overdue {{hours}}h",
      daysHoursLeft: "{{days}}d {{hours}}h left",
      hoursMinutesLeft: "{{hours}}h {{minutes}}m left",
      minutesLeft: "{{minutes}}m left",
      all: "All",

      // Update functionality
      updateAvailable: "Update Available",
      newVersionFound: "New version {{version}} found",
      currentVersion: "Current version",
      updateNotes: "Update notes",
      fileSize: "File size",
      publishedAt: "Published at",
      updateNow: "Update Now",
      remindLater: "Remind Later",
      skipVersion: "Skip Version",
      checkingForUpdates: "Checking for updates...",
      checkUpdates: "Check for Updates",
      startedUpdateCheck: "Started checking for updates",
      downloadingUpdate: "Downloading update...",
      downloadProgress:
        "Download progress: {{percent}}% ({{downloadedMB}}MB / {{totalMB}}MB)",
      downloadStarted: "Started downloading {{fileName}} ({{fileSize}}MB)",
      downloadCompleted: "Download completed: {{fileName}}",
      downloadFailed: "Download failed: {{error}}",
      installingUpdate: "Installing update...",
      installationCompleted: "Installation completed",
      installationFailed: "Installation failed: {{error}}",
      updateCheckFailed: "Update check failed: {{error}}",
      alreadyLatestVersion: "Already using the latest version ({{version}})",
      noUpdateFileFound: "No suitable update file found for current platform",
      fileSizeMismatch: "File size mismatch, download may be incomplete",
      unsupportedPlatform: "Unsupported operating system",
      unknownUpdateError: "Unknown error occurred during update",
      autoUpdateCheckFailed: "Auto update check failed",
      skipAutoUpdateCheck:
        "Skipping auto update check (checked less than 24 hours ago)",
      startingAutoUpdateCheck: "Starting auto update check...",
      updateCheckComplete: "Update check complete",
      updateCheckError: "Update check error",
      mb: "MB",
      latestVersion: "Latest version",

      // Update error messages
      NO_SUITABLE_FILE: "No suitable update file found for current platform",
      UNKNOWN_CHECK_ERROR: "Unknown error occurred during update check",
      DOWNLOAD_TIMEOUT: "Download timeout - no progress update in 5 minutes",
      FILE_SIZE_MISMATCH: "File size mismatch, download may be incomplete",
      FILE_WRITE_ERROR: "File write failed",
      DOWNLOAD_STREAM_ERROR: "Download stream error",
      UNKNOWN_DOWNLOAD_ERROR: "Unknown error occurred during update download",
      UNSUPPORTED_PLATFORM: "Unsupported operating system",
      UNKNOWN_INSTALL_ERROR:
        "Unknown error occurred during update installation",

      // Days of the week - short forms
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
      sun: "Sun",

      // Days of the week - full forms
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday",

      // Document types
      electronicCourseware: "Electronic Courseware",
      experimentGuide: "Experiment Guide",
      unknownDocumentType: "Unknown Document Type",
      loadingDocuments: "Loading documents",
      currentlyFetching: "Currently fetching",
    },
  },
  zh: {
    translation: {
      // Navigation and Layout
      myCourses: "我的课程",
      refresh: "刷新",
      refreshing: "刷新中...",
      noCourses: "暂无课程。",

      // Course Details
      courseNumber: "课程号",
      instructor: "授课教师",
      semester: "学期",

      // Common Actions
      back: "返回",
      loading: "加载中...",
      error: "错误",

      // Login
      login: "登录",
      username: "用户名",
      password: "密码",
      loginButton: "登录",
      loginFailed: "登录失败",
      signingIn: "登录中...",
      verificationCode: "验证码",
      enterStudentId: "请输入学号",
      enterPassword: "请输入密码",
      enterCaptcha: "请输入验证码",
      clickToRefresh: "点击刷新",

      // Course Content
      assignments: "作业",
      announcements: "公告",
      materials: "课程资料",
      schedule: "课程表",
      homework: "作业",
      documents: "文档",
      courses: "课程",
      flowSchedule: "🌊 课程流程表",

      // Actions
      download: "下载",
      downloading: "下载中...",
      retry: "重试",
      viewDetails: "查看详情",
      hideDetails: "隐藏详情",

      // Error Messages
      unableToLoadDocuments: "无法加载文档",
      unableToLoadHomework: "无法加载作业",
      failedToLoadSchedule: "加载课程表失败",
      tryAgain: "重试",

      // Schedule
      week: "第",
      teacher: "教师",
      room: "教室",
      currentlyOngoing: "正在进行中！",

      // Status
      completed: "已完成",
      pending: "待完成",
      overdue: "已逾期",
      submitted: "已提交",
      notSubmitted: "未提交",
      graded: "已评分",
      gradeNotPublished: "成绩未公布",
      notPublishedYet: "尚未公布",
      yes: "是",
      no: "否",

      // Settings
      settings: "设置",
      language: "语言",
      theme: "主题",

      // Logout
      logout: "登出",
      logoutAndClear: "登出并清除",

      // Homework List
      loadingHomework: "正在加载作业...",
      filter: "筛选",
      sortBy: "排序方式",
      remainingTime: "剩余时间",
      dueDate: "截止日期",
      course: "课程",
      status: "状态",
      type: "类型",
      normalHomework: "普通作业",
      courseReport: "课程报告",
      experimentHomework: "实验作业",
      regularQuiz: "平时测验",
      finalAssessment: "结课考核",
      unknownType: "未知类型",
      noHomeworkFound: "未找到符合筛选条件的作业。",
      maxScore: "满分",
      due: "截止时间",
      students: "学生",
      grade: "成绩",
      submittedAt: "提交时间",
      homeworkDetails: "作业详情",
      created: "创建时间",
      openDate: "开放时间",
      answer: "答案",
      repeatAllowed: "允许重复",
      fullDescription: "完整描述",
      attachments: "附件",
      size: "大小",
      showingCachedData: "显示缓存数据（{{minutes}}分钟前）",
      showingFreshData: "显示最新数据",
      noHomeworkDataAvailable: "无作业数据",
      authenticationRequired: "请登录以查看作业数据。需要身份验证。",
      sessionExpired: "会话已过期。请重新登录。",
      failedToFetchHomework: "获取作业数据失败。请稍后重试。",
      unexpectedError: "获取作业时发生未预期的错误。",
      dataUpdatedInBackground: "后台数据已更新",
      failedToLoadHomeworkDetails: "加载作业详情失败。请重试。",
      overdueDaysHours: "逾期{{days}}天{{hours}}小时",
      overdueHours: "逾期{{hours}}小时",
      daysHoursLeft: "剩余{{days}}天{{hours}}小时",
      hoursMinutesLeft: "剩余{{hours}}小时{{minutes}}分钟",
      minutesLeft: "剩余{{minutes}}分钟",
      all: "全部",

      // Update functionality
      updateAvailable: "有可用更新",
      newVersionFound: "发现新版本 {{version}}",
      currentVersion: "当前版本",
      updateNotes: "更新说明",
      fileSize: "文件大小",
      publishedAt: "发布时间",
      updateNow: "立即更新",
      remindLater: "稍后提醒",
      skipVersion: "跳过此版本",
      checkingForUpdates: "正在检查更新...",
      checkUpdates: "检查更新",
      startedUpdateCheck: "开始检查更新",
      downloadingUpdate: "正在下载更新...",
      downloadProgress:
        "下载进度: {{percent}}% ({{downloadedMB}}MB / {{totalMB}}MB)",
      downloadStarted: "开始下载 {{fileName}} ({{fileSize}}MB)",
      downloadCompleted: "下载完成: {{fileName}}",
      downloadFailed: "下载失败: {{error}}",
      installingUpdate: "正在安装更新...",
      installationCompleted: "安装完成",
      installationFailed: "安装失败: {{error}}",
      updateCheckFailed: "检查更新失败: {{error}}",
      alreadyLatestVersion: "已是最新版本 ({{version}})",
      noUpdateFileFound: "未找到适合当前平台的更新文件",
      fileSizeMismatch: "文件大小不匹配，下载可能不完整",
      unsupportedPlatform: "不支持的操作系统",
      unknownUpdateError: "更新时发生未知错误",
      autoUpdateCheckFailed: "自动更新检查失败",
      skipAutoUpdateCheck: "跳过自动更新检查（距离上次检查不足24小时）",
      startingAutoUpdateCheck: "开始自动检查更新...",
      updateCheckComplete: "更新检查完成",
      updateCheckError: "更新检查错误",
      mb: "MB",
      latestVersion: "最新版本",

      // Update error messages
      NO_SUITABLE_FILE: "未找到适合当前平台的更新文件",
      UNKNOWN_CHECK_ERROR: "检查更新时发生未知错误",
      DOWNLOAD_TIMEOUT: "下载超时 - 5分钟内没有进度更新",
      FILE_SIZE_MISMATCH: "文件大小不匹配，下载可能不完整",
      FILE_WRITE_ERROR: "写入文件失败",
      DOWNLOAD_STREAM_ERROR: "下载流错误",
      UNKNOWN_DOWNLOAD_ERROR: "下载更新时发生未知错误",
      UNSUPPORTED_PLATFORM: "不支持的操作系统",
      UNKNOWN_INSTALL_ERROR: "安装更新时发生未知错误",

      // Days of the week - short forms
      mon: "周一",
      tue: "周二",
      wed: "周三",
      thu: "周四",
      fri: "周五",
      sat: "周六",
      sun: "周日",

      // Days of the week - full forms
      monday: "星期一",
      tuesday: "星期二",
      wednesday: "星期三",
      thursday: "星期四",
      friday: "星期五",
      saturday: "星期六",
      sunday: "星期日",

      // Document types
      electronicCourseware: "电子课件",
      experimentGuide: "实验指导书",
      unknownDocumentType: "未知文档类型",
      loadingDocuments: "正在加载文档",
      currentlyFetching: "正在获取",
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    debug: false,

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },

    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
  });

export default i18n;
