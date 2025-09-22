// Improved schedule data structures

export interface TimeSlot {
  id: string; // e.g., "1-2" for periods 1-2
  startPeriod: number; // 1-based period number
  endPeriod: number;
  startTime: string; // "08:00"
  endTime: string; // "09:40"
  label: string; // "第1-2节"
}

export interface ScheduleCourse {
  id: string;
  name: string;
  teacher: string;
  classroom: string;
  className: string;
  studentCount: number;
  credits?: number;
  courseType?: string; // "必修" | "选修" | "实践"
}

export interface ScheduleEntry {
  id: string; // unique identifier
  course: ScheduleCourse;
  timeSlot: TimeSlot;
  dayOfWeek: number; // 0 = Monday, 6 = Sunday
  weekNumbers: number[]; // [1, 3, 5] for weeks when this course occurs
  recurrence?: {
    type: "weekly" | "biweekly" | "custom";
    pattern?: string;
  };
}

export interface DaySchedule {
  dayOfWeek: number;
  date: string; // "2025-09-22"
  entries: ScheduleEntry[];
  conflicts: ScheduleConflict[];
}

export interface ScheduleConflict {
  timeSlot: TimeSlot;
  conflictingEntries: ScheduleEntry[];
  severity: "warning" | "error";
  message: string;
}

export interface WeekSchedule {
  weekNumber: number;
  year: number;
  startDate: string; // "2025-09-22"
  endDate: string; // "2025-09-28"
  days: DaySchedule[];
  metadata: {
    totalCourses: number;
    totalHours: number;
    conflicts: ScheduleConflict[];
    lastUpdated: string;
  };
}

export interface ScheduleData {
  semester: {
    id: string;
    name: string; // "2025-2026学年第一学期"
    startDate: string;
    endDate: string;
  };
  weeks: WeekSchedule[];
  courses: { [courseId: string]: ScheduleCourse };
  timeSlots: { [timeSlotId: string]: TimeSlot };
  statistics: {
    totalWeeks: number;
    totalCourses: number;
    averageHoursPerWeek: number;
    busyDays: number[];
    freeDays: number[];
  };
}

// Standard time slot definitions (matching server data)
export const DEFAULT_TIME_SLOTS: { [key: string]: TimeSlot } = {
  "1": {
    id: "1",
    startPeriod: 1,
    endPeriod: 1,
    startTime: "08:00",
    endTime: "09:50",
    label: "08:00-09:50"
  },
  "2": {
    id: "2",
    startPeriod: 2,
    endPeriod: 2,
    startTime: "10:10",
    endTime: "12:00",
    label: "10:10-12:00"
  },
  "3": {
    id: "3",
    startPeriod: 3,
    endPeriod: 3,
    startTime: "10:30",
    endTime: "12:20",
    label: "10:30-12:20"
  },
  "4": {
    id: "4",
    startPeriod: 4,
    endPeriod: 4,
    startTime: "12:10",
    endTime: "14:00",
    label: "12:10-14:00"
  },
  "5": {
    id: "5",
    startPeriod: 5,
    endPeriod: 5,
    startTime: "14:10",
    endTime: "16:00",
    label: "14:10-16:00"
  },
  "6": {
    id: "6",
    startPeriod: 6,
    endPeriod: 6,
    startTime: "16:20",
    endTime: "18:10",
    label: "16:20-18:10"
  },
  "7": {
    id: "7",
    startPeriod: 7,
    endPeriod: 7,
    startTime: "19:00",
    endTime: "20:50",
    label: "19:00-20:50"
  },
  "8": {
    id: "8",
    startPeriod: 8,
    endPeriod: 8,
    startTime: "21:00",
    endTime: "21:50",
    label: "21:00-21:50"
  }
};