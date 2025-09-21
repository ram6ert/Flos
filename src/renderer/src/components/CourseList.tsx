import React from 'react';
import { Course } from '../shared-types';

interface CourseListProps {
  courses: Course[];
  onCourseSelect: (course: Course) => void;
}

const CourseList: React.FC<CourseListProps> = ({ courses, onCourseSelect }) => {
  return (
    <div>
      <h2>My Courses</h2>
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