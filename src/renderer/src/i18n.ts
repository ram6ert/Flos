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
