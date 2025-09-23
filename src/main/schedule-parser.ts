import * as cheerio from "cheerio";
import { Logger } from "./logger";
import {
  ScheduleData,
  WeekSchedule,
  DaySchedule,
  ScheduleEntry,
  ScheduleCourse,
  TimeSlot,
  ScheduleConflict,
  DEFAULT_TIME_SLOTS,
} from "../shared/types";

// Raw schedule entry from server HTML parsing
interface RawScheduleEntry {
  courseId: string;
  courseName: string;
  teacherName: string;
  className: string;
  studentCount: number;
  classroom: string;
  timeSlot: string;
  dayOfWeek: number;
}

// Raw schedule response from server
interface RawScheduleResponse {
  schedule: {
    weekNumber: number;
    beginDate: string;
    endDate: string;
    entries: RawScheduleEntry[];
  };
  STATUS: string;
  message: string;
}

export class ScheduleParser {
  private static parseTimeSlot(timeSlotStr: string): TimeSlot | null {
    // Clean up the time slot string
    const cleanStr = timeSlotStr
      .replace(/\s+/g, " ")
      .replace(/- /g, "-")
      .trim();

    // First try to match time range patterns like "8:00-9:50", "14:00-15:40"
    const timeRangeMatch = cleanStr.match(
      /(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/
    );
    if (timeRangeMatch) {
      const startHour = parseInt(timeRangeMatch[1]);
      const startMin = parseInt(timeRangeMatch[2]);
      const endHour = parseInt(timeRangeMatch[3]);
      const endMin = parseInt(timeRangeMatch[4]);

      const startTime = `${startHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}`;
      const endTime = `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;

      // Map actual time ranges from server to period IDs
      const timeSlotMap: {
        [key: string]: { id: string; period: number; label: string };
      } = {
        "08:00-09:50": { id: "1", period: 1, label: "08:00-09:50" },
        "10:10-12:00": { id: "2", period: 2, label: "10:10-12:00" },
        "10:30-12:20": { id: "3", period: 3, label: "10:30-12:20" },
        "12:10-14:00": { id: "4", period: 4, label: "12:10-14:00" },
        "14:10-16:00": { id: "5", period: 5, label: "14:10-16:00" },
        "16:20-18:10": { id: "6", period: 6, label: "16:20-18:10" },
        "19:00-20:50": { id: "7", period: 7, label: "19:00-20:50" },
        "21:00-21:50": { id: "8", period: 8, label: "21:00-21:50" },
      };

      const timeKey = `${startTime}-${endTime}`;
      const mappedSlot = timeSlotMap[timeKey];

      if (mappedSlot) {
        return {
          id: mappedSlot.id,
          startPeriod: mappedSlot.period,
          endPeriod: mappedSlot.period,
          startTime,
          endTime,
          label: mappedSlot.label,
        };
      }

      // If not in predefined map, create a custom time slot
      // Estimate period number based on start time
      const period = this.estimatePeriodFromTime(startHour, startMin);

      return {
        id: period.toString(),
        startPeriod: period,
        endPeriod: period,
        startTime,
        endTime,
        label: `${startTime}-${endTime}`,
      };
    }

    // Fallback: try to match period patterns like "第1-2节"
    const periodMatch = cleanStr.match(/第(\d+)-(\d+)节/);
    if (periodMatch) {
      const startPeriod = parseInt(periodMatch[1]);
      const endPeriod = parseInt(periodMatch[2]);
      const id = `${startPeriod}-${endPeriod}`;

      if (DEFAULT_TIME_SLOTS[id]) {
        return DEFAULT_TIME_SLOTS[id];
      }

      // Create custom time slot if not in defaults
      return {
        id,
        startPeriod,
        endPeriod,
        startTime: this.calculateTimeFromPeriod(startPeriod),
        endTime: this.calculateTimeFromPeriod(endPeriod + 1),
        label: cleanStr,
      };
    }

    Logger.warn(`Unable to parse time slot: ${timeSlotStr}`);
    return null;
  }

  private static calculateTimeFromPeriod(period: number): string {
    // Standard schedule: 8:00, 9:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00, 19:00, 20:00
    const times = [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
    ];

    return times[period - 1] || "00:00";
  }

  private static estimatePeriodFromTime(hour: number, minute: number): number {
    const timeInMinutes = hour * 60 + minute;

    // Map time ranges to periods based on actual server schedule
    if (timeInMinutes >= 8 * 60 && timeInMinutes < 10 * 60) return 1; // 08:00-09:50
    if (timeInMinutes >= 10 * 60 + 10 && timeInMinutes < 12 * 60) return 2; // 10:10-12:00
    if (timeInMinutes >= 10 * 60 + 30 && timeInMinutes < 12 * 60 + 20) return 3; // 10:30-12:20
    if (timeInMinutes >= 12 * 60 + 10 && timeInMinutes < 14 * 60) return 4; // 12:10-14:00
    if (timeInMinutes >= 14 * 60 + 10 && timeInMinutes < 16 * 60) return 5; // 14:10-16:00
    if (timeInMinutes >= 16 * 60 + 20 && timeInMinutes < 18 * 60 + 10) return 6; // 16:20-18:10
    if (timeInMinutes >= 19 * 60 && timeInMinutes < 20 * 60 + 50) return 7; // 19:00-20:50
    if (timeInMinutes >= 21 * 60 && timeInMinutes < 21 * 60 + 50) return 8; // 21:00-21:50

    // Default fallback - estimate based on hour
    if (timeInMinutes < 10 * 60) return 1;
    if (timeInMinutes < 14 * 60) return 2;
    if (timeInMinutes < 19 * 60) return 5;
    if (timeInMinutes < 21 * 60) return 7;
    return 8;
  }

  private static detectConflicts(entries: ScheduleEntry[]): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = [];
    const timeSlotMap = new Map<string, ScheduleEntry[]>();

    // Group entries by day and time slot
    entries.forEach((entry) => {
      const key = `${entry.dayOfWeek}-${entry.timeSlot.id}`;
      if (!timeSlotMap.has(key)) {
        timeSlotMap.set(key, []);
      }
      timeSlotMap.get(key)!.push(entry);
    });

    // Find conflicts
    timeSlotMap.forEach((conflictingEntries, key) => {
      if (conflictingEntries.length > 1) {
        const [dayOfWeek, _timeSlotId] = key.split("-");
        conflicts.push({
          timeSlot: conflictingEntries[0].timeSlot,
          conflictingEntries,
          severity: "error",
          message: `Time conflict on ${this.getDayName(parseInt(dayOfWeek))} at ${conflictingEntries[0].timeSlot.label}`,
        });
      }
    });

    return conflicts;
  }

  private static getDayName(dayOfWeek: number): string {
    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    return days[dayOfWeek] || "Unknown";
  }

  private static generateEntryId(rawEntry: RawScheduleEntry): string {
    return `${rawEntry.courseId}_${rawEntry.dayOfWeek}_${rawEntry.timeSlot.replace(/\s+/g, "")}`;
  }

  private static calculateWeekDates(startDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }

    return dates;
  }

  static transformRawSchedule(rawResponse: RawScheduleResponse): ScheduleData {
    const { schedule } = rawResponse;

    // Extract unique courses
    const courses: { [courseId: string]: ScheduleCourse } = {};
    const timeSlots: { [timeSlotId: string]: TimeSlot } = {
      ...DEFAULT_TIME_SLOTS,
    };

    // Process raw entries
    const scheduleEntries: ScheduleEntry[] = [];

    schedule.entries.forEach((rawEntry) => {
      // Create course if not exists
      if (!courses[rawEntry.courseId]) {
        courses[rawEntry.courseId] = {
          id: rawEntry.courseId,
          name: rawEntry.courseName,
          teacher: rawEntry.teacherName,
          classroom: rawEntry.classroom,
          className: rawEntry.className,
          studentCount: rawEntry.studentCount,
        };
      }

      // Parse time slot
      const timeSlot = this.parseTimeSlot(rawEntry.timeSlot);
      if (!timeSlot) return;

      // Add time slot to collection
      timeSlots[timeSlot.id] = timeSlot;

      // Create schedule entry
      const entry: ScheduleEntry = {
        id: this.generateEntryId(rawEntry),
        course: courses[rawEntry.courseId],
        timeSlot,
        dayOfWeek: rawEntry.dayOfWeek,
        weekNumbers: [schedule.weekNumber], // For now, assume single week
      };

      scheduleEntries.push(entry);
    });

    // Group entries by day
    const weekDates = this.calculateWeekDates(schedule.beginDate);
    const days: DaySchedule[] = [];

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const dayEntries = scheduleEntries.filter(
        (entry) => entry.dayOfWeek === dayOfWeek
      );
      const dayConflicts = this.detectConflicts(dayEntries);

      days.push({
        dayOfWeek,
        date: weekDates[dayOfWeek],
        entries: dayEntries,
        conflicts: dayConflicts,
      });
    }

    // Create week schedule
    const allConflicts = days.flatMap((day) => day.conflicts);
    const weekSchedule: WeekSchedule = {
      weekNumber: schedule.weekNumber,
      year: new Date(schedule.beginDate).getFullYear(),
      startDate: schedule.beginDate,
      endDate: schedule.endDate,
      days,
      metadata: {
        totalCourses: Object.keys(courses).length,
        totalHours: scheduleEntries.reduce(
          (sum, entry) =>
            sum + (entry.timeSlot.endPeriod - entry.timeSlot.startPeriod + 1),
          0
        ),
        conflicts: allConflicts,
        lastUpdated: new Date().toISOString(),
      },
    };

    // Calculate statistics
    const busyDays = days
      .filter((day) => day.entries.length > 0)
      .map((day) => day.dayOfWeek);

    const freeDays = days
      .filter((day) => day.entries.length === 0)
      .map((day) => day.dayOfWeek);

    // Create final schedule data
    const scheduleData: ScheduleData = {
      semester: {
        id: `${weekSchedule.year}-${Math.ceil(schedule.weekNumber / 20)}`,
        name: `${weekSchedule.year}学年第${Math.ceil(schedule.weekNumber / 20)}学期`,
        startDate: schedule.beginDate,
        endDate: schedule.endDate,
      },
      weeks: [weekSchedule],
      courses,
      timeSlots,
      statistics: {
        totalWeeks: 1,
        totalCourses: Object.keys(courses).length,
        averageHoursPerWeek: weekSchedule.metadata.totalHours,
        busyDays,
        freeDays,
      },
    };

    Logger.event(
      `Transformed schedule: ${scheduleEntries.length} entries, ${allConflicts.length} conflicts`
    );
    return scheduleData;
  }

  // Parse HTML and transform in one step
  static async parseAndTransform(html: string): Promise<ScheduleData> {
    const rawResponse = this.parseScheduleHTML(html);
    return this.transformRawSchedule(rawResponse);
  }

  // Original HTML parsing logic (refactored from api.ts)
  private static parseScheduleHTML(html: string): RawScheduleResponse {
    const $ = cheerio.load(html);

    // Debug: Log some basic info about the HTML structure
    Logger.debug(`HTML length: ${html.length} characters`);
    Logger.debug(`Document title: ${$("title").text()}`);

    // Check for alternative selectors
    const allTables = $("table");
    const allDivs = $("div");
    Logger.debug(
      `Found ${allTables.length} tables and ${allDivs.length} divs in HTML`
    );

    // Extract week info
    const beginTimeInput = $("#begin_time");
    let weekNumber = 2; // Default
    let beginDate = "";
    let endDate = "";

    if (beginTimeInput.length > 0) {
      beginDate = beginTimeInput.attr("value") || "";
    }

    // Parse schedule entries
    const entries: RawScheduleEntry[] = [];

    // Helper function to sanitize time slots
    const sanitizeTimeSlot = (timeSlot: string): string => {
      return timeSlot.replace(/\s+/g, " ").replace(/- /g, "-").trim();
    };

    // Get all time slot containers
    const timeSlotContainers = $("ul.timetable-tabletlist");

    Logger.event(
      `Found ${timeSlotContainers.length} time slot containers in HTML`
    );

    timeSlotContainers.each((containerIndex, container) => {
      const $container = $(container);

      // Get the time slot from the first li element
      const timeSlotElement = $container.find(
        "li.table-list span.table-listsp1"
      );
      let currentTimeSlot = "Unknown";

      if (timeSlotElement.length > 0) {
        const rawTimeSlot = timeSlotElement.text().trim() || "";
        currentTimeSlot = sanitizeTimeSlot(rawTimeSlot);
      }

      // Get all day cells (should be 7 for Monday-Sunday)
      const dayCells = $container.find("li.table-list2");

      Logger.event(
        `Time slot ${containerIndex + 1}: "${currentTimeSlot}" with ${dayCells.length} day cells`
      );

      dayCells.each((dayIndex, cell) => {
        const $cell = $(cell);
        const courseTitle = $cell.find(".table-t");
        if (courseTitle.length > 0) {
          const courseName =
            courseTitle.text().replace("课程：", "").trim() || "";

          // Get teacher info (first .table-b element)
          const teacherSpans = $cell.find(".table-b");
          const teacherName =
            teacherSpans.eq(0).text().replace("教师：", "").trim() || "";

          // Get class info (second .table-b element)
          const className =
            teacherSpans.eq(1).text().replace("班级：", "").trim() || "";

          // Get student count
          const studentSpan = $cell.find(".table-m");
          const studentText =
            studentSpan.text().replace("学生：", "").replace("人", "").trim() ||
            "0";
          const studentCount = parseInt(studentText) || 0;

          // Get classroom
          const classroomSpan = $cell.find(".table-j:not([onclick])");
          const classroom =
            classroomSpan.text().replace("教室：", "").trim() || "";

          // Extract course ID from onclick attribute
          let courseId = "";
          const onclickAttr = courseTitle.attr("onclick");
          if (onclickAttr) {
            const match = onclickAttr.match(/'([^']+)'/);
            if (match) {
              courseId = match[1];
            }
          }

          if (courseName) {
            const entry: RawScheduleEntry = {
              courseId,
              courseName: courseName.trim(),
              teacherName: teacherName.trim(),
              className: className.trim(),
              studentCount,
              classroom: classroom.trim(),
              timeSlot: currentTimeSlot,
              dayOfWeek: dayIndex,
            };
            entries.push(entry);
            Logger.event(
              `Added course: ${courseName} at ${currentTimeSlot} on day ${dayIndex}`
            );
          }
        }
      });
    });

    // Calculate end date
    if (beginDate) {
      const beginDateObj = new Date(beginDate);
      const endDateObj = new Date(beginDateObj);
      endDateObj.setDate(beginDateObj.getDate() + 6);
      endDate = endDateObj.toISOString().split("T")[0];
    }

    Logger.event(
      `Parsing completed: Found ${entries.length} total course entries`
    );

    return {
      schedule: {
        weekNumber,
        beginDate,
        endDate,
        entries,
      },
      STATUS: "0",
      message: "Schedule parsed successfully",
    };
  }
}
