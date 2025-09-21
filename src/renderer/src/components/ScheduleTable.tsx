import React, { useState, useEffect } from 'react';
import { WeekSchedule, ScheduleEntry } from '../shared-types';
import './ScheduleTable.css';

interface ScheduleTableProps {
  onRefresh?: () => void;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ onRefresh }) => {
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timeSlots = [
    "08:00-09:50",
    "10:10-12:00",
    "10:30-12:20",
    "12:10-14:00",
    "14:10-16:00",
    "16:20-18:10",
    "19:00-20:50",
    "21:00-21:50"
  ];

  const weekdays = [
    { short: "Mon", full: "Monday", index: 0 },
    { short: "Tue", full: "Tuesday", index: 1 },
    { short: "Wed", full: "Wednesday", index: 2 },
    { short: "Thu", full: "Thursday", index: 3 },
    { short: "Fri", full: "Friday", index: 4 },
    { short: "Sat", full: "Saturday", index: 5 },
    { short: "Sun", full: "Sunday", index: 6 },
  ];

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const scheduleResponse = forceRefresh
        ? await window.electronAPI.refreshSchedule()
        : await window.electronAPI.getSchedule();

      if (scheduleResponse.STATUS === "0") {
        setSchedule(scheduleResponse.schedule);
      } else {
        setError(scheduleResponse.message || "Failed to load schedule");
      }
    } catch (error) {
      console.error('Failed to load schedule:', error);
      setError('Failed to load schedule. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadSchedule(true);
    onRefresh?.();
  };

  const getScheduleEntryForSlot = (timeSlot: string, dayIndex: number): ScheduleEntry | null => {
    if (!schedule) return null;

    return schedule.entries.find(entry =>
      entry.timeSlot === timeSlot && entry.dayOfWeek === dayIndex
    ) || null;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDateForDay = (dayIndex: number) => {
    if (!schedule?.beginDate) return '';

    const beginDate = new Date(schedule.beginDate);
    const targetDate = new Date(beginDate);
    targetDate.setDate(beginDate.getDate() + dayIndex);

    return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="schedule-container">
        <div className="schedule-header">
          <h2>📅 Course Schedule</h2>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="schedule-container">
        <div className="schedule-header">
          <h2>📅 Course Schedule</h2>
          <button onClick={handleRefresh} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
        <div className="error-container">
          <p>❌ {error}</p>
          <button onClick={handleRefresh} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="schedule-container">
        <div className="schedule-header">
          <h2>📅 Course Schedule</h2>
          <button onClick={handleRefresh} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
        <div className="empty-container">
          <p>No schedule data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-container">
      <div className="schedule-header">
        <div>
          <h2>📅 Course Schedule</h2>
          <p className="schedule-week-info">
            Week {schedule.weekNumber} • {formatDate(schedule.beginDate)} - {formatDate(schedule.endDate)}
          </p>
        </div>
        <button onClick={handleRefresh} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>


      <div className="schedule-table-wrapper">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="time-header">Time</th>
              {weekdays.map(day => (
                <th key={day.index} className="day-header">
                  <div className="day-header-content">
                    <span className="day-name">{day.short}</span>
                    <span className="day-date">{getDateForDay(day.index)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((timeSlot, timeIndex) => (
              <tr key={timeIndex} className="schedule-row">
                <td className="time-cell">
                  <div className="time-content">
                    {timeSlot}
                  </div>
                </td>
                {weekdays.map(day => {
                  const entry = getScheduleEntryForSlot(timeSlot, day.index);
                  return (
                    <td key={`${timeIndex}-${day.index}`} className={`schedule-cell ${entry ? 'has-course' : ''}`}>
                      {entry ? (
                        <div className="course-entry" title={`${entry.courseName}\nTeacher: ${entry.teacherName}\nClass: ${entry.className}\nRoom: ${entry.classroom}\nStudents: ${entry.studentCount}`}>
                          <div className="course-name">{entry.courseName}</div>
                          <div className="course-teacher">👨‍🏫 {entry.teacherName}</div>
                          <div className="course-room">📍 {entry.classroom}</div>
                          <div className="course-details">
                            <span className="course-class">📚 {entry.className}</span>
                            <span className="course-students">👥 {entry.studentCount}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="empty-cell">
                          <span className="empty-text">—</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default ScheduleTable;