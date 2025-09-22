import React, { useState, useEffect } from "react";
import { ScheduleData, ScheduleEntry } from "../shared-types";
import "./FlowScheduleTable.css";

interface FlowScheduleTableProps {
  onRefresh?: () => void;
}

interface CourseFlow {
  course: ScheduleEntry;
  startMinutes: number;
  durationMinutes: number;
  dayIndex: number;
}

const FlowScheduleTable: React.FC<FlowScheduleTableProps> = ({ onRefresh }) => {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timeline configuration
  const timelineStart = 8 * 60; // 8:00 AM in minutes
  const timelineEnd = 22 * 60; // 10:00 PM in minutes
  const timelineHeight = 800; // pixels

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

  // Convert time string to minutes since midnight
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Convert minutes back to time string
  const formatTimeFromMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  // Convert course entries to flow objects and concatenate neighboring same courses
  const getCoursesForDay = (dayIndex: number): CourseFlow[] => {
    if (!scheduleData?.weeks[0]) return [];

    const daySchedule = scheduleData.weeks[0].days.find(
      (day) => day.dayOfWeek === dayIndex
    );
    if (!daySchedule) return [];

    const flows = daySchedule.entries
      .map((entry) => {
        const startMinutes = timeToMinutes(entry.timeSlot.startTime);
        const endMinutes = timeToMinutes(entry.timeSlot.endTime);
        const durationMinutes = endMinutes - startMinutes;

        return {
          course: entry,
          startMinutes,
          durationMinutes,
          dayIndex,
        };
      })
      .sort((a, b) => a.startMinutes - b.startMinutes);

    // Concatenate neighboring same courses
    const concatenatedFlows: CourseFlow[] = [];

    for (let i = 0; i < flows.length; i++) {
      const currentFlow = flows[i];
      let endMinutes = currentFlow.startMinutes + currentFlow.durationMinutes;

      // Look for consecutive same courses
      let j = i + 1;
      while (
        j < flows.length &&
        flows[j].course.course.name === currentFlow.course.course.name &&
        flows[j].startMinutes <= endMinutes + 30
      ) {
        // Allow up to 30 min gap
        endMinutes = flows[j].startMinutes + flows[j].durationMinutes;
        j++;
      }

      // Create concatenated flow
      const concatenatedFlow: CourseFlow = {
        course: currentFlow.course,
        startMinutes: currentFlow.startMinutes,
        durationMinutes: endMinutes - currentFlow.startMinutes,
        dayIndex,
      };

      concatenatedFlows.push(concatenatedFlow);
      i = j - 1; // Skip the courses we just concatenated
    }

    return concatenatedFlows;
  };

  // Calculate position and height based on time flow
  const getFlowStyle = (flow: CourseFlow) => {
    const relativeStart = flow.startMinutes - timelineStart;
    const timelineSpan = timelineEnd - timelineStart;

    const topPercent = (relativeStart / timelineSpan) * 100;
    const heightPercent = (flow.durationMinutes / timelineSpan) * 100;

    return {
      top: `${Math.max(0, topPercent)}%`,
      height: `${heightPercent}%`,
      minHeight: "40px", // Ensure readability
    };
  };

  // Generate time markers for the timeline
  const generateTimeMarkers = () => {
    const markers = [];
    for (let hour = 8; hour <= 22; hour++) {
      const minutes = hour * 60;
      const relativePosition =
        ((minutes - timelineStart) / (timelineEnd - timelineStart)) * 100;

      markers.push(
        <div
          key={hour}
          className="time-marker"
          style={{ top: `${relativePosition}%` }}
        >
          <span className="time-label">{`${hour.toString().padStart(2, "0")}:00`}</span>
          <div className="time-line"></div>
        </div>
      );
    }
    return markers;
  };

  // Get current week
  const currentWeek = scheduleData?.weeks[0];

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

  if (isLoading) {
    return (
      <div className="flow-schedule-container">
        <div className="schedule-header">
          <h2>🌊 Course Flow Schedule</h2>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading schedule flow...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flow-schedule-container">
        <div className="schedule-header">
          <h2>🌊 Course Flow Schedule</h2>
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
      <div className="flow-schedule-container">
        <div className="schedule-header">
          <h2>🌊 Course Flow Schedule</h2>
          <button onClick={handleRefresh} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
        <div className="empty-container">
          <p>No schedule flow data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-schedule-container">
      <div className="schedule-header">
        <div>
          <h2>🌊 Course Flow Schedule</h2>
          <div className="schedule-info">
            <p className="schedule-week-info">
              Week {currentWeek.weekNumber} •{" "}
              {formatDate(currentWeek.startDate)} -{" "}
              {formatDate(currentWeek.endDate)}
            </p>
            <p className="schedule-stats">
              {scheduleData.statistics.totalCourses} courses flowing •{" "}
              {currentWeek.metadata.totalHours} hours
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

      <div className="flow-schedule-wrapper">
        <div className="timeline-container">
          <div className="timeline-markers">{generateTimeMarkers()}</div>

          <div className="flow-columns">
            {weekdays.map((day) => (
              <div key={day.index} className="day-column">
                <div className="day-header">
                  <span className="day-name">{day.short}</span>
                  <span className="day-date">{getDateForDay(day.index)}</span>
                </div>

                <div
                  className="course-flow-area"
                  style={{ height: `${timelineHeight}px` }}
                >
                  {getCoursesForDay(day.index).map((flow, index) => (
                    <div
                      key={`${flow.course.id}-${index}`}
                      className="course-flow-block"
                      style={getFlowStyle(flow)}
                      title={`${flow.course.course.name}\n${formatTimeFromMinutes(flow.startMinutes)}-${formatTimeFromMinutes(flow.startMinutes + flow.durationMinutes)}\nTeacher: ${flow.course.course.teacher}\nRoom: ${flow.course.course.classroom}`}
                    >
                      <div className="course-flow-content">
                        <div className="course-name">
                          {flow.course.course.name}
                        </div>
                        <div className="course-time">
                          {formatTimeFromMinutes(flow.startMinutes)}-
                          {formatTimeFromMinutes(
                            flow.startMinutes + flow.durationMinutes
                          )}
                        </div>
                        <div className="course-teacher">
                          👨‍🏫 {flow.course.course.teacher}
                        </div>
                        <div className="course-room">
                          📍 {flow.course.course.classroom}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowScheduleTable;
