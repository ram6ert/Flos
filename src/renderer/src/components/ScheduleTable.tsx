import React, { useState, useEffect } from "react";
import { ScheduleData, ScheduleEntry } from "../shared-types";
import { Container, PageHeader, Button, Loading, ErrorDisplay, InfoBanner, Card } from "./common/StyledComponents";

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
      <Container padding="lg">
        <PageHeader title="📅 Course Schedule" />
        <Loading message="Loading schedule..." />
      </Container>
    );
  }

  if (error) {
    return (
      <Container padding="lg">
        <PageHeader
          title="📅 Course Schedule"
          actions={
            <Button onClick={handleRefresh} variant="primary" size="sm">
              Refresh
            </Button>
          }
        />
        <ErrorDisplay
          title="Failed to Load Schedule"
          message={error}
          onRetry={handleRefresh}
          retryLabel="Try Again"
        />
      </Container>
    );
  }

  if (!scheduleData || !currentWeek) {
    return (
      <Container padding="lg">
        <PageHeader
          title="📅 Course Schedule"
          actions={
            <Button onClick={handleRefresh} variant="primary" size="sm">
              Refresh
            </Button>
          }
        />
        <p className="text-gray-600 text-center py-12">No schedule data available</p>
      </Container>
    );
  }

  return (
    <Container padding="lg">
      <PageHeader
        title="📅 Course Schedule"
        subtitle={`Week ${currentWeek.weekNumber} • ${formatDate(currentWeek.startDate)} - ${formatDate(currentWeek.endDate)}`}
        actions={
          <Button onClick={handleRefresh} variant="primary" size="sm">
            Refresh
          </Button>
        }
      />

      <InfoBanner variant="info">
        <div className="flex flex-wrap gap-4 text-sm">
          <span><strong>{scheduleData.statistics.totalCourses}</strong> courses</span>
          <span><strong>{currentWeek.metadata.totalHours}</strong> hours</span>
          {hasConflicts && (
            <span className="text-amber-700 font-semibold">
              ⚠️ {currentWeek.metadata.conflicts.length} conflict(s)
            </span>
          )}
          {scheduleData.semester && (
            <span><strong>Semester:</strong> {scheduleData.semester.name}</span>
          )}
        </div>
      </InfoBanner>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-gray-100 text-gray-900 p-3 text-center font-semibold min-w-24 w-32 border-b border-gray-200">
                  Time
                </th>
                {weekdays.map((day) => (
                  <th key={day.index} className="bg-gray-100 text-gray-900 p-3 text-center font-semibold min-w-36 border-b border-gray-200">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-sm font-semibold">{day.short}</span>
                      <span className="text-xs text-gray-600">{getDateForDay(day.index)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standardTimeSlots.map((timeSlot, index) => (
                <tr key={timeSlot.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="bg-white border-r border-gray-200 p-3 text-center font-medium text-gray-700 align-middle">
                    <div className="text-sm leading-tight">
                      {timeSlot.displayTime}
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
                        className={`border border-gray-200 p-0 align-top relative ${
                          entry ? (hasConflict ? 'bg-red-50' : 'bg-blue-50') : ''
                        }`}
                      >
                        {entry ? (
                          <div
                            className="p-3 h-full flex flex-col gap-1 cursor-pointer transition-colors duration-150 hover:bg-blue-100"
                            title={`${entry.course.name}\nTeacher: ${entry.course.teacher}\nClass: ${entry.course.className}\nRoom: ${entry.course.classroom}\nStudents: ${entry.course.studentCount}${hasConflict ? "\n⚠️ Time conflict detected" : ""}`}
                          >
                            <div className="font-semibold text-gray-900 text-sm leading-tight mb-1">
                              {entry.course.name}
                            </div>
                            <div className="text-emerald-600 text-xs leading-tight">
                              👨‍🏫 {entry.course.teacher}
                            </div>
                            <div className="text-orange-600 text-xs leading-tight">
                              📍 {entry.course.classroom}
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-gray-600 text-xs leading-tight">
                                📚 {entry.course.className}
                              </span>
                              <span className="text-gray-600 text-xs leading-tight">
                                👥 {entry.course.studentCount}
                              </span>
                            </div>
                            {hasConflict && (
                              <div className="text-red-700 text-xs font-semibold mt-1">
                                ⚠️ Conflict
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-20 flex items-center justify-center">
                            <span className="text-gray-300 text-xl">—</span>
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
      </Card>

      {hasConflicts && (
        <Card className="mt-4">
          <h3 className="text-lg font-bold text-red-700 mb-4 flex items-center gap-2">
            ⚠️ Schedule Conflicts
          </h3>
          <div className="space-y-3">
            {currentWeek.metadata.conflicts.map((conflict, index) => (
              <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="font-semibold text-red-800 mb-2">{conflict.message}</div>
                <div className="flex flex-wrap gap-2">
                  {conflict.conflictingEntries.map((entry, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded"
                    >
                      {entry.course.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </Container>
  );
};

export default ScheduleTable;
