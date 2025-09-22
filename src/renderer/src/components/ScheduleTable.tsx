import React, { useState, useEffect } from "react";
import { ScheduleData, ScheduleEntry } from "../shared-types";
import "./ScheduleTable.css";

interface ScheduleTableProps {
  onRefresh?: () => void;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ onRefresh }) => {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Standard time slots in display order (matching server data)
  const standardTimeSlots = [
    { id: "1", label: "08:00-09:50", displayTime: "08:00-09:50" },
    { id: "2", label: "10:10-12:00", displayTime: "10:10-12:00" },
    { id: "3", label: "10:30-12:20", displayTime: "10:30-12:20" },
    { id: "4", label: "12:10-14:00", displayTime: "12:10-14:00" },
    { id: "5", label: "14:10-16:00", displayTime: "14:10-16:00" },
    { id: "6", label: "16:20-18:10", displayTime: "16:20-18:10" },
    { id: "7", label: "19:00-20:50", displayTime: "19:00-20:50" },
    { id: "8", label: "21:00-21:50", displayTime: "21:00-21:50" },
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

  const loadSchedule = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const scheduleResponse = forceRefresh
        ? await window.electronAPI.refreshSchedule()
        : await window.electronAPI.getSchedule();

      // Validate schedule response format
      if (
        scheduleResponse &&
        typeof scheduleResponse === "object" &&
        "weeks" in scheduleResponse &&
        "courses" in scheduleResponse
      ) {
        setScheduleData(scheduleResponse as ScheduleData);
      } else {
        console.error("Invalid schedule response format:", scheduleResponse);
        setError("Invalid schedule response format");
      }
    } catch (error) {
      console.error("Failed to load schedule:", error);
      setError("Failed to load schedule. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const handleRefresh = () => {
    loadSchedule(true);
    onRefresh?.();
  };

  // Get current week (using first week if available)
  const currentWeek = scheduleData?.weeks[0];

  const getScheduleEntryForSlot = (
    timeSlotId: string,
    dayIndex: number
  ): ScheduleEntry | null => {
    if (!currentWeek) return null;

    const daySchedule = currentWeek.days.find(
      (day) => day.dayOfWeek === dayIndex
    );
    if (!daySchedule) return null;

    return (
      daySchedule.entries.find((entry) => entry.timeSlot.id === timeSlotId) ||
      null
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getDateForDay = (dayIndex: number) => {
    if (!currentWeek) return "";

    const daySchedule = currentWeek.days.find(
      (day) => day.dayOfWeek === dayIndex
    );
    return daySchedule ? formatDate(daySchedule.date) : "";
  };

  // Check for conflicts
  const hasConflicts = (currentWeek?.metadata.conflicts?.length || 0) > 0;

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

  if (!scheduleData || !currentWeek) {
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
          <div className="schedule-info">
            <p className="schedule-week-info">
              Week {currentWeek.weekNumber} •{" "}
              {formatDate(currentWeek.startDate)} -{" "}
              {formatDate(currentWeek.endDate)}
            </p>
            <p className="schedule-stats">
              {scheduleData.statistics.totalCourses} courses •{" "}
              {currentWeek.metadata.totalHours} hours
              {hasConflicts && (
                <span className="conflict-warning">
                  ⚠️ {currentWeek.metadata.conflicts.length} conflict(s)
                </span>
              )}
            </p>
            {scheduleData.semester && (
              <p className="semester-info">{scheduleData.semester.name}</p>
            )}
          </div>
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
              {weekdays.map((day) => (
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
            {standardTimeSlots.map((timeSlot) => (
              <tr key={timeSlot.id} className="schedule-row">
                <td className="time-cell">
                  <div className="time-content">
                    <div className="time-display">{timeSlot.displayTime}</div>
                  </div>
                </td>
                {weekdays.map((day) => {
                  const entry = getScheduleEntryForSlot(timeSlot.id, day.index);
                  const daySchedule = currentWeek.days.find(
                    (d) => d.dayOfWeek === day.index
                  );
                  const hasConflict = daySchedule?.conflicts.some(
                    (c) => c.timeSlot.id === timeSlot.id
                  );

                  return (
                    <td
                      key={`${timeSlot.id}-${day.index}`}
                      className={`schedule-cell ${entry ? "has-course" : ""} ${hasConflict ? "has-conflict" : ""}`}
                    >
                      {entry ? (
                        <div
                          className="course-entry"
                          title={`${entry.course.name}\nTeacher: ${entry.course.teacher}\nClass: ${entry.course.className}\nRoom: ${entry.course.classroom}\nStudents: ${entry.course.studentCount}${hasConflict ? "\n⚠️ Time conflict detected" : ""}`}
                        >
                          <div className="course-name">{entry.course.name}</div>
                          <div className="course-teacher">
                            👨‍🏫 {entry.course.teacher}
                          </div>
                          <div className="course-room">
                            📍 {entry.course.classroom}
                          </div>
                          <div className="course-details">
                            <span className="course-class">
                              📚 {entry.course.className}
                            </span>
                            <span className="course-students">
                              👥 {entry.course.studentCount}
                            </span>
                          </div>
                          {hasConflict && (
                            <div className="conflict-indicator">
                              ⚠️ Conflict
                            </div>
                          )}
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

      {hasConflicts && (
        <div className="conflicts-summary">
          <h3>⚠️ Schedule Conflicts</h3>
          <ul>
            {currentWeek.metadata.conflicts.map((conflict, index) => (
              <li key={index} className="conflict-item">
                <strong>{conflict.message}</strong>
                <div className="conflict-courses">
                  {conflict.conflictingEntries.map((entry, i) => (
                    <span key={i} className="conflict-course">
                      {entry.course.name}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ScheduleTable;
