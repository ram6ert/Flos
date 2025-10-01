# Backend APIs and Services Documentation

## Overview

The backend operates in Electron's main process and handles API communication, session management, data caching, and file operations. It provides a bridge between the React frontend and external course platform APIs.

## Architecture Components

### Core Modules

#### Main Process Entry Point (`src/main/index.ts`)
Application initialization and IPC handler setup.

**Key Functions:**
- Axios configuration with custom User-Agent
- IPC handler registration for all modules
- Auto-update initialization with 5-second delay
- Window lifecycle management

```typescript
// IPC handler setup order
setupAuthHandlers();
setupCourseHandlers();
setupHomeworkHandlers();
setupDocumentHandlers();
setupScheduleHandlers();
setupUpdateHandlers();
```

#### API Configuration (`src/main/constants.ts`)
Central configuration for API endpoints and HTTP clients.

**Key Features:**
- **Dynamic User-Agent Generation**: OS-specific, randomized browser signatures
- **Multi-instance Axios Setup**: Separate clients for different API endpoints
- **Platform Detection**: macOS/Windows/Linux specific configurations
- **Language Headers**: Automatic Accept-Language based on system locale

**API Instances:**
```typescript
export const courseAPI = axios.create({
  baseURL: "http://123.121.147.7:88/ve/back",
  timeout: 30000,
  maxRedirects: 0,
});

export const courseVe = axios.create({
  baseURL: "http://123.121.147.7:88/ve",
  timeout: 30000,
  maxRedirects: 0,
});

export const courseBase = axios.create({
  baseURL: "http://123.121.147.7:88",
  timeout: 30000,
  maxRedirects: 0,
});
```

## Authentication Services

### Session Management (`src/main/auth.ts`)
Handles user authentication, session persistence, and security.

**Key Features:**
- **Credential Storage**: Encrypted local storage with OS keychain integration
- **Session Validation**: JSESSIONID validation and automatic refresh
- **Password Security**: Client-side MD5 hashing before transmission
- **Session Expiry Detection**: Automatic detection and re-authentication prompts

**Session Data Structure:**
```typescript
interface SessionData {
  username: string;
  sessionId: string;
  loginTime: string;
  jsessionId?: string;
}
```

**Security Implementations:**
- Secure credential storage using Electron's safeStorage
- Automatic session cookie management
- Request interception for session expiry detection
- Credential validation on startup

### Authentication Handlers (`src/main/handlers/auth.ts`)
IPC handlers for authentication operations.

**Exposed APIs:**
- `fetch-captcha` - Retrieve login captcha image
- `login` - User authentication with credentials
- `logout` - Session termination and cleanup
- `is-logged-in` - Session status check
- `validate-stored-session` - Stored session validation
- `get-current-session` - Current session retrieval
- `store-credentials` - Secure credential storage
- `get-stored-credentials` - Retrieve stored credentials
- `clear-stored-credentials` - Clear stored credentials

## Data Services

### Caching System (`src/main/cache.ts`)
User-specific, persistent caching with TTL management.

**Features:**
- **User Isolation**: Separate cache files per username
- **TTL Management**: Configurable time-to-live for different data types
- **Atomic Operations**: Safe file operations with temp file staging
- **Cache Validation**: Structure validation and corruption recovery
- **Backup System**: Automatic backup of corrupted cache files

**Cache Structure:**
```typescript
interface CacheFile {
  version: string;
  metadata: {
    created: string;
    lastSaved: string;
    username?: string;
    appVersion: string;
  };
  entries: { [key: string]: CacheEntry };
}
```

**Cache Durations:**
- Homework: 24 hours (86,400,000ms)
- Courses: 7 days (604,800,000ms)
- Schedules: 7 days (604,800,000ms)

### Course Services (`src/main/handlers/course.ts`)
Course data management with intelligent caching.

**Key Features:**
- **Background Refresh**: Non-blocking cache updates
- **Duplicate Prevention**: Request deduplication system
- **Retry Logic**: Exponential backoff for failed requests
- **Cache-First Strategy**: Immediate cached data return with background refresh

**Exposed APIs:**
- `get-semester-info` - Current semester information
- `get-courses` - Course list with caching options
- `refresh-courses` - Force course data refresh

**Background Refresh Implementation:**
```typescript
async function refreshCacheInBackground(
  cacheKey: string,
  refreshFunction: () => Promise<any>,
  retries = 2
) {
  // Prevent duplicate refreshes
  // Retry logic with exponential backoff
  // Renderer notification on completion
}
```

### Homework Services (`src/main/handlers/homework.ts`)
Comprehensive homework management with streaming capabilities.

**Advanced Features:**
- **Streaming Data**: Progressive data loading with real-time updates
- **File Upload/Download**: Multi-file homework submission support
- **Request Queuing**: Rate-limited request processing
- **Progress Tracking**: Real-time progress reporting
- **Size Validation**: File size limits and validation

**Exposed APIs:**
- `get-homework` - Homework retrieval with caching
- `refresh-homework` - Force refresh with streaming
- `stream-homework` - Progressive homework loading
- `get-homework-details` - Detailed homework information
- `download-homework-attachment` - File download with size limits
- `submit-homework` - Multi-file homework submission
- `get-homework-download-urls` - Submitted homework download URLs
- `download-submitted-homework` - Download submitted files

**Streaming Implementation:**
```typescript
// Real-time progress updates
event.sender.send("homework-stream-progress", {
  completed: number,
  total: number,
  currentCourse: string,
  responseId: string
});

// Data chunks as they arrive
event.sender.send("homework-stream-chunk", {
  homework: Homework[],
  courseId: string,
  courseName: string,
  fromCache: boolean,
  responseId: string
});
```

**File Handling:**
- **Size Limits**: 50MB maximum file size
- **Smart Download**: Small files in-memory, large files to disk
- **Stream Processing**: Direct file streaming for large downloads
- **Format Support**: All file types with MIME type detection

## API Communication

### Request Management (`src/main/api.ts`)
Central API communication hub with advanced features.

**Core Features:**
- **Session Interceptors**: Automatic session expiry detection
- **Rate Limiting**: Intelligent request queuing
- **Response Sanitization**: Data transformation and cleaning
- **Error Handling**: Comprehensive error management
- **Cookie Management**: Automatic session cookie updates

### Rate Limiting System
```typescript
class RateLimitedQueue {
  private maxConcurrency = 3;
  private queue: (() => Promise<any>)[] = [];

  async add<T>(task: () => Promise<T>): Promise<T> {
    // Queue management with controlled concurrency
    // Random delays between requests (30-500ms)
  }
}
```

### Session Interceptors
```typescript
export function setupAxiosSessionInterceptors(): void {
  // 3xx redirect detection → session expired
  // HTML response detection → possible session expired
  // Automatic session expiry handling
  // Global interceptor installation
}
```

### Data Sanitization
**IMPORTANT: All data from the server MUST be sanitized before being used by the application.** This is critical for security and type safety.

All server responses are sanitized before reaching the frontend:

**Course Sanitization:**
```typescript
const sanitizeCourse = (course: any): Course => {
  return {
    id: String(course.id),
    name: course.name,
    courseNumber: course.course_num,
    type: getCourseType(course.type), // Convert numbers to enums
    // ... additional transformations
  };
};
```

**Homework Sanitization:**
```typescript
const sanitizeHomeworkItem = (hw: any): Homework => {
  return {
    submissionStatus: hw.subStatus === "已提交"
      ? "submitted"
      : "not_submitted",
    dueDate: new Date(hw.end_time).toISOString(),
    // ... type-safe transformations
  };
};
```

## Specialized Services

### Schedule Parser (`src/main/schedule-parser.ts`)
HTML schedule parsing and data transformation.

**Features:**
- **GBK Decoding**: Chinese character encoding handling
- **Conflict Detection**: Overlapping course detection
- **Time Slot Parsing**: Complex schedule pattern extraction
- **Data Enrichment**: Course information enhancement

### Document Handlers (`src/main/handlers/document.ts`)
Document management with streaming capabilities.

**Features:**
- **Multi-type Support**: Courseware and experiment guides
- **Streaming Fetching**: Progressive document loading
- **File Categorization**: Document type classification
- **Access Control**: Permission-based document access

### Update Management (`src/main/handlers/update.ts`)
Auto-update system integration.

**Features:**
- **Background Checking**: Non-intrusive update detection
- **Progress Tracking**: Download progress monitoring
- **Version Comparison**: Semantic version checking
- **User Notification**: Update availability alerts

## Error Handling & Logging

### Logging System (`src/main/logger.ts`)
Comprehensive logging with multiple levels.

**Log Levels:**
- **Event**: Application events and milestones
- **Debug**: Development debugging information
- **Warn**: Warning conditions
- **Error**: Error conditions with stack traces

### Error Propagation
```typescript
// Session expiry handling
if (!currentSession) {
  await handleSessionExpired();
  throw new Error("SESSION_EXPIRED");
}

// API error transformation
catch (error) {
  Logger.error("Operation failed", error);
  return {
    success: false,
    error: error instanceof Error ? error.message : "Unknown error"
  };
}
```

## Security Features

### Request Security
- **User-Agent Rotation**: Dynamic user agent generation
- **Session Protection**: Secure session token handling
- **Rate Limiting**: Request throttling and queuing
- **Input Validation**: Data sanitization and validation

### Data Security
- **Local Encryption**: Secure credential storage
- **Session Management**: Automatic session lifecycle
- **Error Sanitization**: Safe error message handling
- **File Validation**: Upload/download validation

## Performance Optimizations

### Caching Strategy
- **Multi-level Caching**: Memory and disk caching
- **Background Refresh**: Non-blocking cache updates
- **TTL Management**: Intelligent cache expiration
- **User Isolation**: Per-user cache segregation

### Request Optimization
- **Connection Pooling**: HTTP connection reuse
- **Concurrent Limiting**: Controlled request concurrency
- **Queue Management**: Intelligent request ordering
- **Response Streaming**: Large data streaming

### Memory Management
- **Cache Size Limits**: Automatic cache cleanup
- **Resource Disposal**: Proper resource cleanup
- **Stream Handling**: Efficient large file processing
- **Error Recovery**: Graceful failure handling

## Integration Points

### IPC Communication
All backend services expose their functionality through IPC handlers:

```typescript
// Handler registration pattern
ipcMain.handle("handler-name", async (event, ...args) => {
  // Authentication check
  // Request processing
  // Response sanitization
  // Error handling
});
```

### Frontend Integration
Backend services integrate with frontend through:
- **Event Emitters**: Real-time progress updates
- **Streaming APIs**: Progressive data loading
- **Cache Notifications**: Automatic UI updates
- **Error Propagation**: Consistent error handling

### External API Integration
- **Course Platform APIs**: Primary educational platform integration
- **Update Services**: GitHub releases integration
- **File Services**: Document and media handling
- **Authentication Services**: Login and session management