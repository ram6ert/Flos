import React from 'react';
import { Course, Document } from '../shared-types';

interface DocumentListProps {
  documents: Document[];
  selectedCourse: Course | null;
  courses: Course[];
  onCourseSelect: (course: Course) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  selectedCourse,
  courses,
  onCourseSelect,
}) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'lecture':
        return '🎓';
      case 'assignment':
        return '📝';
      case 'reading':
        return '📖';
      case 'reference':
        return '📋';
      default:
        return '📄';
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const result = await window.electronAPI.downloadDocument(document.url);
      if (result.success) {
        console.log('Document downloaded successfully');
      }
    } catch (error) {
      console.error('Failed to download document:', error);
    }
  };

  // Mock documents for development
  const mockDocuments: Document[] = selectedCourse ? [
    {
      id: '1',
      courseId: selectedCourse.id,
      title: 'Lecture 1: Introduction to Programming',
      type: 'lecture',
      url: '/documents/lecture1.pdf',
      uploadedAt: new Date('2024-09-01'),
      size: 2048576
    },
    {
      id: '2',
      courseId: selectedCourse.id,
      title: 'Assignment 1 Instructions',
      type: 'assignment',
      url: '/documents/assignment1.pdf',
      uploadedAt: new Date('2024-09-05'),
      size: 1024000
    },
    {
      id: '3',
      courseId: selectedCourse.id,
      title: 'Recommended Reading: Chapter 1',
      type: 'reading',
      url: '/documents/chapter1.pdf',
      uploadedAt: new Date('2024-09-01'),
      size: 5242880
    }
  ] : [];

  const displayDocuments = documents.length > 0 ? documents : mockDocuments;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Documents</h2>
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
        {displayDocuments.length === 0 ? (
          <p>{selectedCourse ? 'No documents for this course.' : 'Select a course to view documents.'}</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {displayDocuments.map((doc) => (
              <div
                key={doc.id}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '1rem',
                  backgroundColor: 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <span style={{ fontSize: '2rem', marginRight: '1rem' }}>
                    {getDocumentIcon(doc.type)}
                  </span>
                  <div>
                    <h4 style={{ margin: 0, marginBottom: '0.25rem' }}>{doc.title}</h4>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                      <span style={{ textTransform: 'capitalize' }}>{doc.type}</span>
                      <span style={{ margin: '0 0.5rem' }}>•</span>
                      <span>Uploaded {formatDate(doc.uploadedAt)}</span>
                      {doc.size && (
                        <>
                          <span style={{ margin: '0 0.5rem' }}>•</span>
                          <span>{formatFileSize(doc.size)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handleDownload(doc)}
                  style={{ marginLeft: '1rem' }}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentList;