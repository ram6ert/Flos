import React, { useEffect } from 'react';
import { Course, Homework } from '@shared/types';

interface HomeworkListProps {
  homework: Homework[];
  selectedCourse: Course | null;
  onCourseSelect: (course: Course) => void;
  courses: Course[];
}

const HomeworkList: React.FC<HomeworkListProps> = ({
  homework,
  selectedCourse,
  onCourseSelect,
  courses,
}) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const isOverdue = (dueDate: Date) => {
    return new Date() > dueDate;
  };

  const getHomeworkClassName = (hw: Homework) => {
    let className = 'homework-item';
    if (hw.isCompleted) {
      className += ' completed';
    } else if (isOverdue(hw.dueDate)) {
      className += ' overdue';
    }
    return className;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Homework</h2>
        <select
          value={selectedCourse?.id || ''}
          onChange={(e) => {
            const course = courses.find(c => c.id === e.target.value);
            if (course) onCourseSelect(course);
          }}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="">Select a course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} - {course.name}
            </option>
          ))}
        </select>
      </div>

      {selectedCourse && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h3>{selectedCourse.name}</h3>
          <p>{selectedCourse.instructor}</p>
        </div>
      )}

      <div>
        {homework.length === 0 ? (
          <p>{selectedCourse ? 'No homework for this course.' : 'Select a course to view homework.'}</p>
        ) : (
          homework.map((hw) => (
            <div key={hw.id} className={getHomeworkClassName(hw)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h4>{hw.title}</h4>
                  <p style={{ margin: '0.5rem 0', color: '#666' }}>{hw.description}</p>
                  <div style={{ fontSize: '0.9rem', color: '#888' }}>
                    <span>Due: {formatDate(hw.dueDate)}</span>
                    <span style={{ marginLeft: '1rem' }}>Points: {hw.maxPoints}</span>
                    <span style={{ marginLeft: '1rem' }}>Type: {hw.submissionType}</span>
                  </div>
                  {hw.isCompleted && hw.submittedAt && (
                    <div style={{ fontSize: '0.9rem', color: '#27ae60', marginTop: '0.5rem' }}>
                      ✓ Submitted on {formatDate(hw.submittedAt)}
                    </div>
                  )}
                </div>
                <div>
                  {hw.isCompleted ? (
                    <span style={{ color: '#27ae60', fontWeight: 'bold' }}>Completed</span>
                  ) : isOverdue(hw.dueDate) ? (
                    <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>Overdue</span>
                  ) : (
                    <button className="btn btn-primary">Submit</button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HomeworkList;