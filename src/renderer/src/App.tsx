import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Course, CourseDocument, UserSession } from "./shared-types";
import CourseList from "./components/CourseList";
import HomeworkList from "./components/HomeworkList";
import DocumentList from "./components/DocumentList";
import Sidebar from "./components/Sidebar";
import Login from "./components/Login";
import FlowScheduleTable from "./components/FlowScheduleTable";
import UpdateNotification from "./components/UpdateNotification";
import UpdateStatusNotification from "./components/UpdateStatusNotification";
import { Button, Loading } from "./components/common/StyledComponents";

type ActiveView = "courses" | "homework" | "documents" | "flow-schedule";

const App: React.FC = () => {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<ActiveView>("courses");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [documents, setDocuments] = useState<CourseDocument[]>([]);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
  } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    downloadedMB: string;
    totalMB: string;
  } | null>(null);
  useEffect(() => {
    checkLoginStatus();
  }, []);

  useEffect(() => {
    if (userSession?.isLoggedIn) {
      loadCourses();
    }
  }, [userSession]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLogoutDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Listen for cache updates
    const handleCacheUpdate = (
      _event: any,
      payload: { key: string; data: any }
    ) => {
      if (payload.key === "courses") {
        setCourses(payload.data || []);
      }
    };

    // Listen for session expiration
    const handleSessionExpired = () => {
      console.log("Session expired, prompting for re-login");
      setUserSession(null);
      // Don't clear cached data - keep it available until user explicitly refreshes
      setSelectedCourse(null);
      setActiveView("courses");
    };

    // Listen for update notifications
    const handleUpdateAvailable = (_event: any, data: any) => {
      console.log("Update available:", data);
      setUpdateInfo(data);
      setShowUpdateNotification(true);
    };

    // Listen for update check completion
    const handleUpdateCheckComplete = (_event: any, data: any) => {
      console.log("Update check complete:", data);
      setUpdateStatus({
        type: "success",
        title: "检查更新完成",
        message: `当前版本: v${data.currentVersion}${data.latestVersion ? `，最新版本: v${data.latestVersion}` : ""}`
      });
    };

    // Listen for update check errors
    const handleUpdateCheckError = (_event: any, data: any) => {
      console.log("Update check error:", data);
      setUpdateStatus({
        type: "error",
        title: "检查更新失败",
        message: data.error || "检查更新时发生未知错误"
      });
    };

    // Listen for update checking status
    const handleUpdateChecking = (_event: any, data: any) => {
      console.log("Checking for updates:", data);
      setUpdateStatus({
        type: "info",
        title: "正在检查更新",
        message: `当前版本: v${data.currentVersion}，正在检查最新版本...`
      });
    };

    // Listen for download events
    const handleDownloadStarted = (_event: any, data: any) => {
      console.log("Download started:", data);
      setDownloadProgress({
        percent: 0,
        downloadedMB: "0",
        totalMB: (data.fileSize / 1024 / 1024).toFixed(1)
      });
    };

    const handleDownloadProgress = (_event: any, data: any) => {
      console.log("Download progress:", data);
      setDownloadProgress({
        percent: data.percent,
        downloadedMB: data.downloadedMB,
        totalMB: data.totalMB
      });
    };

    const handleDownloadCompleted = (_event: any, data: any) => {
      console.log("Download completed:", data);
      setDownloadProgress(null);
    };

    const handleDownloadError = (_event: any, data: any) => {
      console.log("Download error:", data);
      setDownloadProgress(null);
      setUpdateStatus({
        type: "error",
        title: "下载失败",
        message: data.error || "下载过程中发生未知错误"
      });
    };

    window.electronAPI.onCacheUpdate?.(handleCacheUpdate);
    window.electronAPI.onSessionExpired?.(handleSessionExpired);
    window.electronAPI.onUpdateAvailable?.(handleUpdateAvailable);
    window.electronAPI.onUpdateCheckComplete?.(handleUpdateCheckComplete);
    window.electronAPI.onUpdateCheckError?.(handleUpdateCheckError);
    window.electronAPI.onUpdateChecking?.(handleUpdateChecking);
    window.electronAPI.onDownloadStarted?.(handleDownloadStarted);
    window.electronAPI.onDownloadProgress?.(handleDownloadProgress);
    window.electronAPI.onDownloadCompleted?.(handleDownloadCompleted);
    window.electronAPI.onDownloadError?.(handleDownloadError);

    return () => {
      window.electronAPI.removeAllListeners?.("cache-updated");
      window.electronAPI.removeAllListeners?.("session-expired");
      window.electronAPI.removeAllListeners?.("update-available");
      window.electronAPI.removeAllListeners?.("update-check-complete");
      window.electronAPI.removeAllListeners?.("update-check-error");
      window.electronAPI.removeAllListeners?.("update-checking");
      window.electronAPI.removeAllListeners?.("download-started");
      window.electronAPI.removeAllListeners?.("download-progress");
      window.electronAPI.removeAllListeners?.("download-completed");
      window.electronAPI.removeAllListeners?.("download-error");
    };
  }, []);

  const checkLoginStatus = async () => {
    try {
      // First, try to validate stored session (JSESSIONID)
      const storedSessionValid =
        await window.electronAPI.validateStoredSession();

      if (storedSessionValid) {
        console.log("Restored session from stored JSESSIONID");
        const session = await window.electronAPI.getCurrentSession();
        if (session) {
          setUserSession({
            username: session.username,
            requestId: session.sessionId || "",
            isLoggedIn: true,
            loginTime: session.loginTime
              ? new Date(session.loginTime)
              : new Date(),
          });
        }
      } else {
        // Fallback to regular login check
        const isLoggedIn = await window.electronAPI.isLoggedIn();

        if (isLoggedIn) {
          const session = await window.electronAPI.getCurrentSession();
          if (session) {
            setUserSession({
              username: session.username,
              requestId: session.sessionId || "",
              isLoggedIn: true,
              loginTime: session.loginTime
                ? new Date(session.loginTime)
                : new Date(),
            });
          }
        } else {
          setUserSession(null);
        }
      }

      setIsCheckingLogin(false);
    } catch (error) {
      console.error("Error checking login status:", error);
      setIsCheckingLogin(false);
      setUserSession(null);
    }
  };

  const loadCourses = async (forceRefresh = false) => {
    try {
      const coursesResponse = forceRefresh
        ? await window.electronAPI.refreshCourses()
        : await window.electronAPI.getCourses();
      setCourses(coursesResponse.data || []);
    } catch (error) {
      console.error("Failed to load courses:", error);
      setCourses([]);
    }
  };

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
  };

  const handleRefreshCourses = async () => {
    await loadCourses(true);
  };

  const handleLoginSuccess = (session: UserSession) => {
    setUserSession(session);
  };

  const handleLogout = async () => {
    try {
      await window.electronAPI.logout();
      setUserSession(null);
      setCourses([]);
      setDocuments([]);
      setSelectedCourse(null);
      setActiveView("courses");
      setShowLogoutDropdown(false);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const handleUpdateClose = () => {
    setShowUpdateNotification(false);
    setUpdateInfo(null);
  };

  const handleUpdate = () => {
    // 下载和安装由更新通知组件处理
    console.log("Starting update process...");
  };

  const handleUpdateStatusClose = () => {
    setUpdateStatus(null);
  };

  const handleLogoutAndClearCredentials = async () => {
    try {
      await window.electronAPI.logout();
      await window.electronAPI.clearStoredCredentials?.();
      setUserSession(null);
      setCourses([]);
      setDocuments([]);
      setSelectedCourse(null);
      setActiveView("courses");
      setShowLogoutDropdown(false);
    } catch (error) {
      console.error("Error during logout and clear credentials:", error);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case "courses":
        return (
          <CourseList
            courses={courses}
            onCourseSelect={handleCourseSelect}
            onRefresh={handleRefreshCourses}
          />
        );
      case "homework":
        return <HomeworkList />;
      case "documents":
        return (
          <DocumentList
            documents={documents}
            selectedCourse={selectedCourse}
            courses={courses}
            onCourseSelect={handleCourseSelect}
          />
        );
      case "flow-schedule":
        return <FlowScheduleTable />;
      default:
        return (
          <CourseList
            courses={courses}
            onCourseSelect={handleCourseSelect}
            onRefresh={handleRefreshCourses}
          />
        );
    }
  };

  // Show loading screen while checking login status
  if (isCheckingLogin) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 text-white">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">BAKA Course Platform</h2>
          <Loading message="Checking authentication..." />
        </div>
      </div>
    );
  }

  // Show login screen if not logged in
  if (!userSession?.isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Show main app if logged in
  return (
    <div className="app">
      <header className="header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white m-0">
              BAKA Course Platform
            </h1>
            <p className="text-blue-100 m-0 mt-1">
              Welcome back, {userSession.username}!
            </p>
          </div>
          <div className="relative" ref={dropdownRef}>
            <Button
              onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
              variant="secondary"
              size="sm"
              className="bg-white/20 hover:bg-white/30 border-white/30"
            >
              {t("logout")} ▼
            </Button>
            {showLogoutDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {t("logout")}
                  </button>
                  <button
                    onClick={handleLogoutAndClearCredentials}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {t("logoutAndClear")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="main-content">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <main className="content">{renderContent()}</main>
      </div>

      {/* 更新通知 */}
      {showUpdateNotification && updateInfo && (
        <UpdateNotification
          updateInfo={updateInfo.updateInfo}
          onClose={handleUpdateClose}
          onUpdate={handleUpdate}
          downloadProgress={downloadProgress}
        />
      )}

      {/* 更新状态通知 */}
      {updateStatus && (
        <UpdateStatusNotification
          type={updateStatus.type}
          title={updateStatus.title}
          message={updateStatus.message}
          onClose={handleUpdateStatusClose}
        />
      )}
    </div>
  );
};

export default App;
