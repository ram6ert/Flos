import React, { useState, useEffect } from "react";
import { ScheduleData, ScheduleEntry } from "../shared-types";
import {
  Container,
  PageHeader,
  Button,
  Loading,
  ErrorDisplay,
  Card,
  cn,
} from "./common/StyledComponents";

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
  const [currentTime, setCurrentTime] = useState(new Date());

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

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
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

  // Generate current time indicator
  const generateCurrentTimeIndicator = () => {
    const currentMinutes =
      currentTime.getHours() * 60 + currentTime.getMinutes();

    // Only show if current time is within the timeline
    if (currentMinutes < timelineStart || currentMinutes > timelineEnd) {
      return null;
    }

    const relativePosition =
      ((currentMinutes - timelineStart) / (timelineEnd - timelineStart)) * 100;

    const currentTimeStr = currentTime.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    // Position relative to the timeline height, accounting for header
    const topPosition = 52 + (timelineHeight * relativePosition) / 100;

    return (
      <div
        className="absolute left-0 right-0 z-30 pointer-events-none"
        style={{ top: `${topPosition}px` }}
      >
        <div className="relative">
          <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-lg"></div>
          <div className="absolute left-2 -top-3">
            <span className="bg-red-500 text-white px-2 py-1 rounded-full text-[10px] font-bold shadow-lg">
              NOW {currentTimeStr}
            </span>
          </div>
          <div className="absolute right-2 -top-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-lg"></div>
          </div>
        </div>
      </div>
    );
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
      <Container padding="lg">
        <PageHeader title="🌊 Course Flow Schedule" />
        <Loading message="Loading schedule flow..." />
      </Container>
    );
  }

  if (error) {
    return (
      <Container padding="lg">
        <PageHeader
          title="🌊 Course Flow Schedule"
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
          title="🌊 Course Flow Schedule"
          actions={
            <Button onClick={handleRefresh} variant="primary" size="sm">
              Refresh
            </Button>
          }
        />
        <p className="text-gray-600 text-center py-12">
          No schedule flow data available
        </p>
      </Container>
    );
  }

  // Colors for flow blocks (rotate by index for variety)
  const blockColors = [
    { border: "border-l-red-500", chip: "bg-red-50 text-red-600" },
    { border: "border-l-blue-500", chip: "bg-blue-50 text-blue-600" },
    { border: "border-l-green-500", chip: "bg-green-50 text-green-600" },
    { border: "border-l-amber-500", chip: "bg-amber-50 text-amber-600" },
  ];

  return (
    <Container padding="lg">
      <PageHeader
        title="🌊 Course Flow Schedule"
        subtitle={`Week ${currentWeek.weekNumber} • ${formatDate(currentWeek.startDate)} - ${formatDate(currentWeek.endDate)}`}
        actions={
          <Button onClick={handleRefresh} variant="primary" size="sm">
            Refresh
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div
          className="overflow-x-auto overflow-y-hidden"
          style={{
            transform: "rotateX(180deg)",
          }}
        >
          <div
            className="relative flex min-w-[800px]"
            style={{
              transform: "rotateX(180deg)",
            }}
          >
            {generateCurrentTimeIndicator()}
            <div className="flex gap-0.5 flex-1 relative">
              {weekdays.map((day) => (
                <div key={day.index} className="flex-1 min-w-[120px]">
                  <div className="text-center px-2.5 py-3 bg-gray-100 text-gray-900 border-b border-gray-200 h-[52px] flex flex-col justify-center">
                    <span className="block font-semibold text-sm mb-0.5">
                      {day.short}
                    </span>
                    <span className="block text-xs text-gray-600">
                      {getDateForDay(day.index)}
                    </span>
                  </div>

                  <div
                    className="relative overflow-hidden border border-gray-200 border-t-0 bg-gradient-to-b from-indigo-50/30 via-blue-50/30 to-teal-50/30"
                    style={{ height: `${timelineHeight}px` }}
                  >
                    {getCoursesForDay(day.index).map((flow, index) => {
                      const color = blockColors[index % blockColors.length];
                      return (
                        <div
                          key={`${flow.course.id}-${index}`}
                          className={cn(
                            "absolute left-1 right-1 bg-white/95 rounded-md p-2 cursor-pointer transition shadow",
                            "hover:translate-x-2 hover:shadow-lg hover:bg-blue-50/90",
                            "backdrop-blur-sm",
                            "hover:z-50",
                            color.border
                          )}
                          style={getFlowStyle(flow)}
                          title={`${flow.course.course.name}\n${formatTimeFromMinutes(flow.startMinutes)}-${formatTimeFromMinutes(flow.startMinutes + flow.durationMinutes)}\nTeacher: ${flow.course.course.teacher}\nRoom: ${flow.course.course.classroom}`}
                        >
                          <div className="h-full flex flex-col justify-between">
                            <div className="font-semibold text-[13px] text-gray-900 mb-1 leading-snug line-clamp-2">
                              {flow.course.course.name}
                            </div>
                            <div
                              className={cn(
                                "text-[11px] font-semibold mb-1 px-1.5 py-0.5 rounded text-center",
                                color.chip
                              )}
                            >
                              {formatTimeFromMinutes(flow.startMinutes)}-
                              {formatTimeFromMinutes(
                                flow.startMinutes + flow.durationMinutes
                              )}
                            </div>
                            <div className="text-[10px] text-gray-600 truncate">
                              👨‍🏫 {flow.course.course.teacher}
                            </div>
                            <div className="text-[10px] text-gray-600 truncate">
                              📍 {flow.course.course.classroom}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </Container>
  );
};

export default FlowScheduleTable;
