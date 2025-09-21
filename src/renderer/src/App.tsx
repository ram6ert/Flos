import React, { useState, useEffect } from 'react';
import { Course, Homework, Document, UserSession } from '@shared/types';
import CourseList from './components/CourseList';
import HomeworkList from './components/HomeworkList';
import DocumentList from './components/DocumentList';
import Sidebar from './components/Sidebar';
import Login from './components/Login';

type ActiveView = 'courses' | 'homework' | 'documents' | 'announcements';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('courses');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
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

  const checkLoginStatus = async () => {
    try {
      const isLoggedIn = await window.electronAPI.isLoggedIn();
      setIsCheckingLogin(false);

      if (!isLoggedIn) {
        setUserSession(null);
      }
    } catch (error) {
      console.error('Error checking login status:', error);
      setIsCheckingLogin(false);
      setUserSession(null);
    }
  };

  const loadCourses = async () => {
    try {
      const coursesData = await window.electronAPI.getCourses();
      setCourses(coursesData);
    } catch (error) {
      console.error('Failed to load courses:', error);
      // Mock data for development
      setCourses([
        {
          id: '1',
          name: 'Computer Science Fundamentals',
          code: 'CS-101',
          instructor: 'Dr. Smith',
          description: 'Introduction to computer science concepts and programming',
          semester: 'Fall',
          year: 2024
        },
        {
          id: '2',
          name: 'Data Structures and Algorithms',
          code: 'CS-201',
          instructor: 'Prof. Johnson',
          description: 'Advanced programming concepts and algorithm design',
          semester: 'Fall',
          year: 2024
        },
        {
          id: '3',
          name: 'Web Development',
          code: 'CS-301',
          instructor: 'Dr. Williams',
          description: 'Modern web development technologies and frameworks',
          semester: 'Fall',
          year: 2024
        }
      ]);
    }
  };

  const loadHomework = async (courseId: string) => {
    try {
      const homeworkData = await window.electronAPI.getHomework(courseId);
      setHomework(homeworkData);
    } catch (error) {
      console.error('Failed to load homework:', error);
      // Mock data for development
      setHomework([
        {
          id: '1',
          courseId: courseId,
          title: 'Assignment 1: Basic Programming',
          description: 'Complete the programming exercises in Chapter 1',
          dueDate: new Date('2024-10-15'),
          submissionType: 'file',
          maxPoints: 100,
          isCompleted: false
        },
        {
          id: '2',
          courseId: courseId,
          title: 'Quiz 1: Variables and Data Types',
          description: 'Online quiz covering basic programming concepts',
          dueDate: new Date('2024-10-08'),
          submissionType: 'online',
          maxPoints: 50,
          isCompleted: true,
          submittedAt: new Date('2024-10-07')
        }
      ]);
    }
  };

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
    if (activeView === 'homework') {
      loadHomework(course.id);
    }
  };

  const handleLoginSuccess = (session: UserSession) => {
    setUserSession(session);
  };

  const handleLogout = async () => {
    try {
      await window.electronAPI.logout();
      setUserSession(null);
      setCourses([]);
      setHomework([]);
      setDocuments([]);
      setSelectedCourse(null);
      setActiveView('courses');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'courses':
        return <CourseList courses={courses} onCourseSelect={handleCourseSelect} />;
      case 'homework':
        return (
          <HomeworkList
            homework={homework}
            selectedCourse={selectedCourse}
            onCourseSelect={handleCourseSelect}
            courses={courses}
          />
        );
      case 'documents':
        return (
          <DocumentList
            documents={documents}
            selectedCourse={selectedCourse}
            courses={courses}
            onCourseSelect={handleCourseSelect}
          />
        );
      case 'announcements':
        return <div>Announcements coming soon...</div>;
      default:
        return <CourseList courses={courses} onCourseSelect={handleCourseSelect} />;
    }
  };

  // Show loading screen while checking login status
  if (isCheckingLogin) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Smart Course Platform</h1>
            <p>Welcome back, {userSession.username}!</p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="main-content">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <main className="content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;