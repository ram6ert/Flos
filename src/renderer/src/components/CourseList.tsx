import React from 'react';
import { Course } from '../shared-types';

interface CourseListProps {
  courses: Course[];
  onCourseSelect: (course: Course) => void;
  onRefresh?: () => Promise<void>;
}

const CourseList: React.FC<CourseListProps> = ({ courses, onCourseSelect, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Failed to refresh courses:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>My Courses</h2>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isRefreshing ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>
      <div style={{ marginTop: '1.5rem' }}>
        {courses.length === 0 ? (
          <p>No courses available.</p>
        ) : (
          courses.map((course) => (
            <div
              key={course.id}
              className="course-card"
              onClick={() => onCourseSelect(course)}
              style={{ cursor: 'pointer' }}
            >
              <h3>{course.name}</h3>
              <p style={{ color: '#666', marginBottom: '0.5rem' }}>
                {course.code} • {course.instructor}
              </p>
              <p style={{ color: '#888', fontSize: '0.9rem' }}>
                {course.semester} {course.year}
              </p>
              {course.description && (
                <p style={{ marginTop: '1rem', color: '#555' }}>
                  {course.description}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CourseList;