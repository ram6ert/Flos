import React, { useState, useEffect } from "react";
import { Course, CourseDocument, UserSession } from "./shared-types";
import CourseList from "./components/CourseList";
import HomeworkList from "./components/HomeworkList";
import DocumentList from "./components/DocumentList";
import Sidebar from "./components/Sidebar";
import Login from "./components/Login";
import ScheduleTable from "./components/ScheduleTable";

type ActiveView = "courses" | "homework" | "documents" | "schedule";

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>("courses");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [documents, setDocuments] = useState<CourseDocument[]>([]);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  useEffect(() => {
    if (userSession?.isLoggedIn) {
      loadCourses();
    }
  }, [userSession]);

  useEffect(() => {
    // Listen for cache updates
    const handleCacheUpdate = (
      event: any,
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

    window.electronAPI.onCacheUpdate?.(handleCacheUpdate);
    window.electronAPI.onSessionExpired?.(handleSessionExpired);

    return () => {
      window.electronAPI.removeAllListeners?.("cache-updated");
      window.electronAPI.removeAllListeners?.("session-expired");
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
    } catch (error) {
      console.error("Error during logout:", error);
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
      case "schedule":
        return <ScheduleTable />;
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
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2>Smart Course Platform</h2>
          <p>Loading...</p>
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1>Smart Course Platform</h1>
            <p>Welcome back, {userSession.username}!</p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="main-content">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <main className="content">{renderContent()}</main>
      </div>
    </div>
  );
};

export default App;
