# Data Models and Types Documentation

## Overview

The Smart Course Platform uses a comprehensive type system defined in TypeScript to ensure type safety across the application. All data models are located in `src/shared/types/` and are shared between the main process (backend) and renderer process (frontend).

### Important: ID Field Conventions

The application uses two types of identifiers:

1. **Internal System IDs** (courseId, homeworkId, documentId, attachmentId, teacherId, etc.)
   - These are **numeric IDs stored as strings** (e.g., `"12345"`)
   - Used internally by the system for database references and API calls
   - Always numeric values, never contain letters or special characters
   - Example: `courseId: "12345"`, `homeworkId: "67890"`

2. **Human-Readable Identifiers** (courseCode, courseCode, etc.)
   - These are **alphanumeric strings for display purposes** (e.g., `"M302005B"`)
   - Used for user-facing displays and human identification
   - Not used for internal system operations or API calls
   - Example: `courseCode: "M302005B"`, `courseCode: "CS101"`

**Critical Distinction:**

```typescript
// ✅ CORRECT
courseId: "12345"; // Internal numeric ID (string type)
courseCode: "M302005B"; // Human-readable course code

// ❌ WRONG
courseId: "M302005B"; // This is courseCode, not courseId!
courseCode: "12345"; // This is courseId, not courseCode!
```

## Type System Architecture

### Shared Types Structure

```
src/shared/types/
├── index.ts          # Central type exports
├── auth.ts           # Authentication and session types
├── course.ts         # Course and academic data types
├── document.ts       # Document and file types
├── homework.ts       # Assignment and submission types
└── schedule.ts       # Timetable and schedule types
```

## Authentication Types (`auth.ts`)

### LoginCredentials

User authentication input structure.

```typescript
interface LoginCredentials {
  username: string; // Student ID or username
  password: string; // MD5 hashed password
  passcode: string; // Captcha verification code
}
```

### LoginResponse

Authentication result from server.

```typescript
interface LoginResponse {
  success: boolean; // Authentication success status
  message?: string; // Error message or additional info
  requestId?: string; // Session request identifier
}
```

### UserSession

Active user session data.

```typescript
interface UserSession {
  username: string; // Authenticated username
  requestId: string; // Session request ID
  isLoggedIn: boolean; // Current login status
  loginTime: Date; // Session start timestamp
}
```

**Usage Examples:**

```typescript
// Login flow
const credentials: LoginCredentials = {
  username: "student123",
  password: "hashedPassword",
  passcode: "captcha123",
};

// Session management
const session: UserSession = {
  username: "student123",
  requestId: "session_abc123",
  isLoggedIn: true,
  loginTime: new Date(),
};
```

## Course Types (`course.ts`)

### Course

Primary course data structure with complete academic information.

```typescript
interface Course {
  id: string; // Internal numeric ID (string, e.g., "12345")
  name: string; // Course display name
  courseCode: string; // Human-readable course code (e.g., "M302005B")
  picture: string; // Course image URL
  teacherId: string; // Internal numeric teacher ID (string, e.g., "67890")
  teacherName: string; // Instructor display name
  beginDate: string; // Course start date (ISO string)
  endDate: string; // Course end date (ISO string)
  type: "required" | "elective" | "practice"; // Course category
  selectiveCourseId: string | null; // Internal numeric ID (string) if elective
  facilityId: string; // Internal facility ID
  semesterCode: string; // Academic semester code
  boy: string; // Legacy field (purpose unclear)
  schedule?: CourseScheduleInfo; // Optional schedule information
}
```

### CourseScheduleInfo

Detailed scheduling information for courses.

```typescript
interface CourseScheduleInfo {
  timeSlots: Array<{
    dayOfWeek: number; // 0 = Monday, 6 = Sunday
    timeSlotId: string; // Time period identifier (e.g., "1-2")
    classroom: string; // Classroom location
    weekNumbers: number[]; // Applicable week numbers
  }>;
  className?: string; // Class section name
  studentCount?: number; // Enrolled student count
}
```

### CourseListResponse

Server response structure for course lists.

```typescript
interface CourseListResponse {
  courses: Course[]; // Array of sanitized courses
  status: string; // Server response status
  message: string; // Response message
  totalRows: number; // Total available courses
  currentPage: number; // Current pagination page
  currentRows: number; // Courses in current response
  totalItems: number; // Total course count
  totalPages: number; // Total pagination pages
}
```

**Data Transformation:**
The system transforms server responses to clean, type-safe structures:

```typescript
// Server response (raw)
{
  id: 12345,                    // Numeric ID from database
  course_num: "M302005B",       // Human-readable course code
  teacher_id: 67890,            // Numeric teacher ID
  begin_date: "2024-09-01T00:00:00Z",
  type: 0
}

// Sanitized course (application)
{
  id: "12345",                  // Internal ID: numeric as string
  courseCode: "M302005B",     // Human-readable: course code for display
  teacherId: "67890",           // Internal ID: numeric as string
  beginDate: "2024-09-01T00:00:00.000Z",
  type: "required"
}
```

**ID Field Types:**

- `id: "12345"` - Internal numeric ID (for system/API use)
- `courseCode: "M302005B"` - Human-readable code (for display)
- `teacherId: "67890"` - Internal numeric ID (for system/API use)

## Document Types (`document.ts`)

### CourseDocument

Document and file attachment structure.

```typescript
interface CourseDocument {
  id: string; // Internal numeric document ID (string, e.g., "12345")
  auditStatus: "pending" | "approved" | "rejected"; // Review status
  name: string; // Document display name
  size: number; // File size in bytes
  playUrl: string; // Preview/play URL
  resourceUrl: string; // Download URL
  isPublic: boolean; // Public accessibility
  uploadTime: string; // Upload timestamp (ISO)
  clickCount: number; // View/access count
  downloadCount: number; // Download count
  resourceId: string; // Internal numeric resource ID (string)
  teacherId: string; // Internal numeric teacher ID (string, e.g., "67890")
  teacherName: string; // Uploader teacher name
  documentType: CourseDocumentType; // Document category
  fileExtension: string; // File extension
  shareType: "private" | "public" | "course"; // Sharing scope
  studentDownloadCount: number; // Student download count
}
```

### CourseDocumentType

Document categorization enum.

```typescript
type CourseDocumentType =
  | "courseware" // Electronic courseware
  | "experiment_guide"; // Laboratory/experiment guides
```

**Document Processing:**
Documents are categorized and sanitized from server responses:

```typescript
// Server document type mapping
const convertDocumentType = (docType: string): CourseDocumentType => {
  switch (docType) {
    case "1":
      return "courseware";
    case "10":
      return "experiment_guide";
    default:
      return "courseware";
  }
};
```

## Homework Types (`homework.ts`)

### Homework

Core homework/assignment data structure.

```typescript
interface Homework {
  id: string; // Internal numeric homework ID (string, e.g., "12345")
  courseId: string; // Internal numeric course ID (string, e.g., "67890")
  courseName: string; // Course display name
  title: string; // Assignment title
  content: string; // Assignment description
  dueDate: string; // Due date (ISO string)
  maxScore: number; // Maximum possible score
  submissionStatus: "not_submitted" | "submitted" | "graded"; // Current status
  studentScore: number | null; // Achieved score
  submitDate: string | null; // Submission timestamp (ISO)
  submittedCount: number; // Class submission count
  totalStudents: number; // Total enrolled students
  type: "homework" | "report" | "experiment" | "quiz" | "assessment"; // Assignment type
  submissionId: string | null; // Internal numeric submission ID (string, if submitted)
  userId: string; // Internal numeric student ID (string)
}
```

### HomeworkDetails

Extended homework information with attachments.

```typescript
interface HomeworkDetails {
  id: string; // Internal numeric homework ID (string)
  createdDate: string; // Creation timestamp (ISO)
  courseId: string; // Internal numeric course ID (string)
  courseSchedId: string; // Internal numeric schedule ID (string)
  content: string; // Full assignment description
  title: string; // Assignment title
  dueDate: string; // Due date (ISO)
  openDate: string; // Available from date (ISO)
  isFinalExam: boolean; // Final examination flag
  maxScore: number; // Maximum score
  moduleId: string; // Internal numeric module ID (string)
  isOpen: boolean; // Currently available flag
  isAnswerPublished: boolean; // Answer key published flag
  status: string; // Assignment status
  referenceAnswer: string; // Reference solution
  reviewMethod: string; // Grading method
  url: string; // Assignment resource URL
  fileName: string; // Attachment filename
  convertUrl: string; // Converted document URL
  fileSize: number; // Attachment size
  makeupTime: string | null; // Makeup deadline (ISO)
  isRepeatAllowed: boolean; // Re-submission allowed
  makeupFlag: string; // Makeup status flag
  selectedIds: string; // Comma-separated numeric student IDs
  isGroupAssignment: boolean; // Group work flag
  teacherWeight: number; // Teacher evaluation weight
  studentWeight: number; // Student evaluation weight
  studentCompletion: boolean; // Student completion status
  evaluationNumber: number; // Evaluation count
  attachments: HomeworkAttachment[]; // Attached files
}
```

### HomeworkAttachment

File attachment structure for homework.

```typescript
interface HomeworkAttachment {
  id: string; // Internal numeric attachment ID (string, e.g., "12345")
  url: string; // Download URL
  fileName: string; // Original filename
  convertUrl: string; // Converted/preview URL
  fileSize: number; // File size in bytes
  type: "homework" | "answer" | "my_homework"; // Attachment category
}
```

**Homework Status Logic:**

```typescript
// Status determination from server data
submissionStatus: hw.subStatus === "已提交"
  ? "submitted"
  : hw.stu_score !== null && hw.stu_score !== "未公布成绩"
    ? "graded"
    : "not_submitted";
```

## Schedule Types (`schedule.ts`)

### ScheduleData

Complete schedule/timetable structure.

```typescript
interface ScheduleData {
  weeks: WeekData[]; // Weekly schedule data
  statistics: ScheduleStats; // Schedule statistics
  metadata: ScheduleMetadata; // Schedule metadata
}
```

### WeekData

Individual week schedule information.

```typescript
interface WeekData {
  weekNumber: number; // Academic week number
  startDate: string; // Week start date (ISO)
  endDate: string; // Week end date (ISO)
  days: DayData[]; // Daily schedule data
  metadata: WeekMetadata; // Week-specific metadata
}
```

### DayData

Daily schedule structure.

```typescript
interface DayData {
  date: string; // Date (ISO string)
  dayOfWeek: number; // Day number (0=Monday)
  dayName: string; // Day name (localized)
  entries: ScheduleEntry[]; // Schedule entries for the day
}
```

### ScheduleEntry

Individual schedule entry (class/event).

```typescript
interface ScheduleEntry {
  id: string; // Internal numeric entry ID (string)
  course: CourseInfo; // Course information
  timeSlot: TimeSlot; // Time period
  dayOfWeek: number; // Day of week
  weekNumbers: number[]; // Applicable weeks
  conflicts?: ConflictInfo; // Scheduling conflicts
}
```

### CourseInfo

Course information within schedule context.

```typescript
interface CourseInfo {
  name: string; // Course name
  teacher: string; // Instructor name
  classroom: string; // Location
  courseCode?: string; // Course code
  className?: string; // Class section
  studentCount?: number; // Enrollment count
}
```

### TimeSlot

Time period specification.

```typescript
interface TimeSlot {
  id: string; // Time slot identifier
  startTime: string; // Start time (HH:mm)
  endTime: string; // End time (HH:mm)
  period: string; // Period description
}
```

### Schedule Metadata and Statistics

```typescript
interface ScheduleStats {
  totalCourses: number; // Total course count
  totalSessions: number; // Total class sessions
  conflictCount: number; // Number of conflicts
  averageSessionsPerDay: number; // Daily session average
}

interface ScheduleMetadata {
  generatedAt: string; // Generation timestamp (ISO)
  academicYear: string; // Academic year
  semester: string; // Semester identifier
  conflicts: ConflictInfo[]; // Detected conflicts
}

interface WeekMetadata {
  isExamWeek: boolean; // Examination week flag
  isHoliday: boolean; // Holiday week flag
  specialEvents: string[]; // Special events
  conflicts: ConflictInfo[]; // Week-specific conflicts
}

interface ConflictInfo {
  type: "time_overlap" | "room_conflict" | "instructor_conflict";
  severity: "low" | "medium" | "high";
  description: string; // Conflict description
  affectedEntries: string[]; // Affected entry IDs
}
```

## Data Flow and Transformations

### Server Response Sanitization

All server responses undergo sanitization to ensure type safety:

```typescript
// Authentication transformation
const sanitizeSession = (serverData: any): UserSession => ({
  username: serverData.username,
  requestId: serverData.sessionId || "",
  isLoggedIn: true,
  loginTime: new Date(serverData.loginTime || Date.now()),
});

// Course transformation
const sanitizeCourse = (course: any): Course => ({
  id: String(course.id),
  name: course.name,
  courseCode: course.course_num,
  teacherId: String(course.teacher_id),
  beginDate: new Date(course.begin_date).toISOString(),
  type: convertCourseType(course.type),
  // ... additional transformations
});
```

### Type Guards and Validation

Type guards ensure runtime type safety:

```typescript
// Type guard functions
const isValidCourse = (obj: any): obj is Course => {
  return (
    obj &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.courseCode === "string" &&
    ["required", "elective", "practice"].includes(obj.type)
  );
};

const isValidHomework = (obj: any): obj is Homework => {
  return (
    obj &&
    typeof obj.id === "string" &&
    typeof obj.dueDate === "string" &&
    ["not_submitted", "submitted", "graded"].includes(obj.submissionStatus)
  );
};
```

### Enum Mappings

Server numeric values are mapped to readable enums:

```typescript
// Course type mapping
const getCourseType = (type: number): "required" | "elective" | "practice" => {
  switch (type) {
    case 0:
      return "required";
    case 1:
      return "elective";
    case 2:
      return "practice";
    default:
      return "required";
  }
};

// Homework type mapping
const convertHomeworkType = (
  numericType: number
): "homework" | "report" | "experiment" | "quiz" | "assessment" => {
  switch (numericType) {
    case 0:
      return "homework";
    case 1:
      return "report";
    case 2:
      return "experiment";
    case 3:
      return "quiz";
    case 4:
      return "assessment";
    default:
      return "homework";
  }
};
```

## Error Handling Types

### API Response Types

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

interface CacheResponse<T> {
  data: T;
  fromCache: boolean;
  age: number;
}

interface StreamingResponse<T> {
  data: T;
  courseId?: string;
  courseName?: string;
  type: string;
  fromCache: boolean;
  responseId: string;
}
```

### Error Types

```typescript
interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

interface ValidationError extends AppError {
  field: string;
  value: any;
  constraint: string;
}

interface NetworkError extends AppError {
  statusCode?: number;
  url?: string;
  method?: string;
}
```

## Type Utilities

### Common Utility Types

```typescript
// Optional fields utility
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// API data wrapper
type APIData<T> = {
  data: T;
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
};

// Timestamp conversion utility
type WithTimestamps<T> = T & {
  createdAt: string;
  updatedAt: string;
};
```

### Type Exports

All types are centrally exported from `src/shared/types/index.ts`:

```typescript
// Authentication types
export * from "./auth";

// Course types
export * from "./course";

// Document types
export * from "./document";

// Homework types
export * from "./homework";

// Schedule types
export * from "./schedule";
```

This comprehensive type system ensures type safety across the entire application, from server responses to UI components, providing excellent developer experience and runtime reliability.
