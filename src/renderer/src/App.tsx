import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { UserSession } from "../../shared/types";
import { Course } from "../../shared/types";
import { CourseDocument } from "../../shared/types";
import { Homework } from "../../shared/types";
import { ScheduleData } from "../../shared/types";
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
  const [selectedCourse_Documents, setSelectedCourse_Documents] =
    useState<Course | null>(null);
  const [selectedCourse_Homework, setSelectedCourse_Homework] =
    useState<Course | null>(null);
  const [selectedCourse_Schedule, setSelectedCourse_Schedule] =
    useState<Course | null>(null);
  const [selectedCourse_All, setSelectedCourse_All] = useState<Course | null>(
    null
  );
  const [courses, setCourses] = useState<Course[]>([]);
  const [documents, setDocuments] = useState<CourseDocument[] | null>(null);
  const [homework, setHomework] = useState<Homework[] | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
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

  // Helper function to translate error codes
  const getErrorMessage = useCallback(
    (error: string, errorCode?: string): string => {
      if (errorCode && t(errorCode) !== errorCode) {
        return t(errorCode);
      }
      return error;
    },
    [t]
  );

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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowLogoutDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const api = window.electronAPI;

    if (!api) {
      return undefined;
    }

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
      setSelectedCourse_Documents(null);
      setActiveView("courses");
    };

    // Listen for update status changes
    const handleUpdateStatus = (_event: any, data: any) => {
      console.log("Update status:", data);

      switch (data.type) {
        case "checking":
          setUpdateStatus({
            type: "info",
            title: t("checkingForUpdates"),
            message: `${t("currentVersion")}: v${data.currentVersion}, ${t("checkingForUpdates").toLowerCase()}...`,
          });
          break;

        case "available":
          setUpdateInfo(data);
          setShowUpdateNotification(true);
          break;

        case "up-to-date":
          setUpdateStatus({
            type: "success",
            title: t("updateCheckComplete"),
            message: `${t("currentVersion")}: v${data.currentVersion}${data.latestVersion ? `, ${t("latestVersion")}: v${data.latestVersion}` : ""}`,
          });
          break;

        case "error":
          setUpdateStatus({
            type: "error",
            title: t("updateCheckFailed"),
            message: getErrorMessage(
              data.error || t("unknownUpdateError"),
              data.errorCode
            ),
          });
          break;
      }
    };

    // Listen for download events
    const handleUpdateDownload = (_event: any, data: any) => {
      console.log("Update download:", data);

      switch (data.type) {
        case "started":
          setDownloadProgress({
            percent: 0,
            downloadedMB: "0",
            totalMB: (data.fileSize / 1024 / 1024).toFixed(1),
          });
          break;

        case "progress":
          setDownloadProgress({
            percent: data.percent,
            downloadedMB: data.downloadedMB,
            totalMB: data.totalMB,
          });
          break;

        case "completed":
          setDownloadProgress(null);
          break;

        case "error":
          setDownloadProgress(null);
          setUpdateStatus({
            type: "error",
            title: t("downloadFailed"),
            message: getErrorMessage(
              data.error || t("unknownUpdateError"),
              data.errorCode
            ),
          });
          break;
      }
    };

    api.onCacheUpdate?.(handleCacheUpdate);
    api.onSessionExpired?.(handleSessionExpired);
    api.onUpdateStatus?.(handleUpdateStatus);
    api.onUpdateDownload?.(handleUpdateDownload);

    return () => {
      api.removeAllListeners?.("cache-updated");
      api.removeAllListeners?.("session-expired");
      api.removeAllListeners?.("update-status");
      api.removeAllListeners?.("update-download");
    };
  }, [t, getErrorMessage]);

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

  const handleCourseSelect = (course: Course | null) => {
    setSelectedCourse_Documents(course);
    setSelectedCourse_Homework(course);
    setSelectedCourse_Schedule(course);
    setSelectedCourse_All(course);
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
      setDocuments(null);
      setSelectedCourse_Documents(null);
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
      setDocuments(null);
      setSelectedCourse_Documents(null);
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
            selectedCourse={selectedCourse_All}
            onNavigate={setActiveView}
          />
        );
      case "homework":
        return (
          <HomeworkList
            selectedCourse={selectedCourse_Homework}
            courses={courses}
            onCourseSelect={(v) => setSelectedCourse_Homework(v)}
            homework={homework}
            setHomework={setHomework}
          />
        );
      case "documents":
        return (
          <DocumentList
            documents={documents}
            setDocuments={setDocuments}
            selectedCourse={selectedCourse_Documents}
            courses={courses}
            onCourseSelect={(v) => setSelectedCourse_Documents(v)}
          />
        );
      case "flow-schedule":
        return (
          <FlowScheduleTable
            scheduleData={scheduleData}
            setScheduleData={setScheduleData}
            selectedCourse={selectedCourse_Schedule}
            onCourseSelect={handleCourseSelect}
          />
        );
      default:
        return (
          <CourseList
            courses={courses}
            onCourseSelect={handleCourseSelect}
            onRefresh={handleRefreshCourses}
            selectedCourse={selectedCourse_Documents}
            onNavigate={setActiveView}
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

      {/* notification */}
      {showUpdateNotification && updateInfo && (
        <UpdateNotification
          updateInfo={updateInfo.updateInfo}
          onClose={handleUpdateClose}
          onUpdate={handleUpdate}
          downloadProgress={downloadProgress}
        />
      )}

      {/* status notification */}
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
