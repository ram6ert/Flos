# Unified Download System

## Overview

The unified download system provides centralized download management for all file downloads in the Smart Course Platform. It replaces the scattered download implementations with a single, robust system that supports:

- **Streaming Downloads**: All downloads use streaming APIs to avoid memory overflow
- **Multiple Concurrent Downloads**: Up to 3 concurrent downloads are supported
- **Progress Tracking**: Real-time progress updates for all downloads
- **Download Center UI**: Visual interface to monitor and manage all downloads
- **Post-Download Scripts**: Execute custom scripts after download completion

## Architecture

### Components

1. **Download Manager** (`src/main/download-manager.ts`)
   - Centralized download task management
   - Handles streaming downloads with progress tracking
   - Manages concurrent download limits
   - Supports post-download script execution

2. **Download Handlers** (`src/main/handlers/download.ts`)
   - IPC handlers for download operations
   - Convenience methods for specific download types
   - Backward compatibility with old download APIs

3. **Download Types** (`src/shared/types/download.ts`)
   - Type definitions for download system
   - Task states and metadata structures

4. **Download Center** (`src/renderer/src/components/DownloadCenter.tsx`)
   - UI component for monitoring downloads
   - Shows progress, speed, and time remaining
   - Allows cancel, retry, and remove operations

## Download Types

The system supports the following download types:

- `document`: Course documents and courseware
- `homework-attachment`: Homework attachments from teachers (requires numeric IDs as strings)
- `submitted-homework`: Previously submitted homework files
- `update`: Application updates
- `course-image`: Course cover images
- `generic`: Generic file downloads

**Note on IDs**:

- **Internal IDs** (attachmentId, homeworkId, courseId, documentId, etc.) are numeric IDs stored as strings. For example: `"12345"` not `12345`.
- **courseCode** is a human-readable course code (e.g., `"M302005B"`) for display purposes only, not used for internal system identification.

## Usage

### Adding a Download Task

```typescript
// Using the unified API
const result = await window.electronAPI.downloadAddTask({
  type: "document",
  url: "http://example.com/file.pdf", // Absolute URL
  // OR use relative URL: url: '/path/to/file.pdf', (BASE_URL will be prepended automatically)
  fileName: "document.pdf",
  metadata: {
    courseId: "CS101",
    courseName: "Computer Science",
  },
  autoStart: true, // Start immediately (default: true)
});

if (result.success) {
  console.log("Download started:", result.taskId);
}
```

**Note:** If the URL doesn't start with `http://` or `https://`, the system automatically prepends the `BASE_URL` to create a full URL.

### Download Types Examples

All downloads use the unified `downloadAddTask` API:

```typescript
// Download course document
const result = await window.electronAPI.downloadAddTask({
  type: "document",
  url: "/ve/documents/lecture.pdf",
  fileName: "lecture-notes.pdf",
  metadata: {
    courseId: "12345", // Numeric ID as string (internal system ID)
    courseCode: "M302005B", // Human-readable course code (for display only)
    courseName: "Computer Science", // Course name for display
    documentId: "67890", // Numeric ID as string
  },
  autoStart: true,
});

// Download homework attachment
// IMPORTANT: attachmentId and homeworkId are numeric IDs (string type containing numbers)
// Construct the special URL for homework attachments
const downloadUrl = `http://123.121.147.7:88/ve/back/coursePlatform/dataSynAction.shtml?method=downLoadPic&id=${attachmentId}&noteId=${homeworkId}`;
const result = await window.electronAPI.downloadAddTask({
  type: "homework-attachment",
  url: downloadUrl,
  fileName: `attachment_${attachmentId}`, // Fallback, real filename extracted from server
  metadata: {
    homeworkId: homeworkId, // String containing numeric ID
    courseId: courseId,
    attachmentId: attachmentId, // String containing numeric ID
  },
  autoStart: true,
});

// Download submitted homework
const result = await window.electronAPI.downloadAddTask({
  type: "submitted-homework",
  url: submittedHomeworkUrl,
  fileName: fileName,
  metadata: {
    attachmentId: id,
    homeworkId: homeworkId,
  },
  autoStart: true,
});

// Batch download with preset save path
const result = await window.electronAPI.downloadAddTask({
  type: "document",
  url: documentUrl,
  fileName: fileName,
  savePath: "/path/to/save/file.pdf", // Skip save dialog
  metadata: {
    courseId: "12345", // Numeric ID (internal)
    courseCode: "M302005B", // Human-readable code (display)
    documentId: "67890", // Numeric ID (internal)
  },
  autoStart: true,
});
```

### Monitoring Download Progress

```typescript
// Listen for task updates
window.electronAPI.onDownloadTaskUpdate((event, task) => {
  console.log("Task updated:", task);
});

// Listen for progress updates
window.electronAPI.onDownloadProgress((event, progress) => {
  console.log(`Download ${progress.progress}% complete`);
  console.log(`Speed: ${progress.speed} bytes/sec`);
  console.log(`Time remaining: ${progress.timeRemaining} seconds`);
});
```

### Managing Downloads

```typescript
// Cancel a download
await window.electronAPI.downloadCancelTask(taskId);

// Retry a failed download
await window.electronAPI.downloadRetryTask(taskId);

// Remove a task from the list
await window.electronAPI.downloadRemoveTask(taskId);

// Clear all completed tasks
await window.electronAPI.downloadClearCompleted();

// Get all tasks
const result = await window.electronAPI.downloadGetAllTasks();
if (result.success) {
  console.log("All tasks:", result.tasks);
}
```

## Download Manager API

### Main Methods

#### `addTask(params: AddDownloadTaskParams): Promise<string>`

Adds a new download task and returns the task ID.

**Parameters:**

- `type`: Download type (document, homework-attachment, etc.)
- `url`: Download URL
- `fileName`: File name to save as
- `metadata`: Optional metadata object
- `savePath`: Optional save path (if not provided, user will be prompted for large files)
- `autoStart`: Whether to start download immediately (default: true)

#### `startTask(taskId: string): Promise<void>`

Starts a pending download task.

#### `cancelTask(taskId: string): Promise<void>`

Cancels an active download task.

#### `retryTask(taskId: string): Promise<void>`

Retries a failed download task.

#### `getTask(taskId: string): DownloadTask | undefined`

Gets a specific task by ID.

#### `getAllTasks(): DownloadTask[]`

Gets all download tasks.

#### `getTasksByType(type: DownloadType): DownloadTask[]`

Gets tasks filtered by type.

#### `removeTask(taskId: string): void`

Removes a task from the manager.

#### `clearCompleted(): void`

Clears all completed tasks.

#### `registerPostDownloadScript(taskId: string, script: Function): void`

Registers a script to execute after download completion.

## Download States

Downloads go through the following states:

- `pending`: Task created but not started
- `downloading`: Download in progress
- `completed`: Download finished successfully
- `failed`: Download failed with error
- `cancelled`: Download cancelled by user
- `paused`: Download paused (not currently implemented)

## File Saving

All downloads require user interaction to select save location:

- **Smart Filename Detection**: System gets real filename from server's GET response
- **Stream Pause/Resume**: Download stream pauses while waiting for user input
- **Save Dialog**: User is prompted with the real filename from server as default
- **No Memory Buildup**: Stream is paused, not buffered, so no memory overflow
- **Streaming**: All downloads use streaming to avoid memory overflow
- **Progress Tracking**: Real-time progress updates every 500ms
- **Cancellable**: User can cancel during save dialog or while downloading

**Download Flow:**

1. GET request starts → Stream pauses immediately
2. Extract real filename from response headers
3. Show save dialog with real filename
4. User selects location → Stream resumes
5. File downloads to selected location

## Homework Attachment Downloads

Homework attachments use a special download strategy with specific requirements:

**Parameter Requirements:**

- `attachmentId`: **String containing numeric attachment ID** (e.g., `"12345"`) - used as `id` parameter in URL
- `homeworkId`: **String containing numeric homework ID** (e.g., `"67890"`) - used as `noteId` parameter in URL
- **IMPORTANT**: IDs must be numeric values stored as strings, NOT URLs or non-numeric strings

**Download Process:**

1. Constructs download URL: `http://123.121.147.7:88/ve/back/coursePlatform/dataSynAction.shtml?method=downLoadPic&id=[attachmentId]&noteId=[homeworkId]`
2. Starts GET request and pauses the stream
3. Extracts real filename from `Content-Disposition` header in GET response
4. Prompts user to select save location (with real filename as default)
5. Resumes stream and downloads file with proper filename and extension

**Technical Details:**

- No HEAD request is used (some servers may reject it)
- Stream is paused after GET request starts to prevent data loss
- Real filename is extracted from the actual download response
- User sees the correct filename in the save dialog
- Stream resumes after user selects save location

**Example:**

```typescript
// CORRECT: Pass numeric IDs as strings (internal system IDs)
const attachmentId = "12345"; // Numeric ID as string (internal)
const homeworkId = "67890"; // Numeric ID as string (internal)
const courseId = "11111"; // Numeric ID as string (internal)
const courseCode = "M302005B"; // Human-readable code (display only)

const downloadUrl = `http://123.121.147.7:88/ve/back/coursePlatform/dataSynAction.shtml?method=downLoadPic&id=${attachmentId}&noteId=${homeworkId}`;

await window.electronAPI.downloadAddTask({
  type: "homework-attachment",
  url: downloadUrl,
  fileName: `attachment_${attachmentId}`,
  metadata: {
    attachmentId, // Numeric ID (internal)
    homeworkId, // Numeric ID (internal)
    courseId, // Numeric ID (internal)
    courseCode, // Human-readable (display)
  },
  autoStart: true,
});

// WRONG: Don't use non-numeric strings for IDs
// attachmentId = "/some/url" ❌
// homeworkId = "abc123" ❌
// courseId = "M302005B" ❌  (this is courseCode, not courseId!)
```

This ensures that downloaded files have the correct extension and filename from the server.

## Concurrent Download Limits

The download manager enforces a limit of 3 concurrent downloads. Additional downloads are automatically queued and start when a slot becomes available.

## Progress Updates

Progress updates are sent to the renderer process every 500ms and include:

- Progress percentage (0-100)
- Downloaded bytes
- Total bytes
- Download speed (bytes/sec)
- Estimated time remaining (seconds)

## Integration Points

### Main Process

Register download handlers in `src/main/index.ts`:

```typescript
import { setupDownloadHandlers } from "./handlers/download";

// In app.whenReady()
setupDownloadHandlers();
```

### Renderer Process

The Download Center component is integrated into the main App component (`src/renderer/src/App.tsx`):

```typescript
import DownloadCenter from './components/DownloadCenter';

// Rendered at the bottom of the App component
<DownloadCenter />
```

It displays as a floating button in the bottom-right corner showing the number of active downloads. Clicking opens the download center panel.

## API Design

The download system uses a **unified API approach** with `downloadAddTask` as the single entry point for all download operations. This design provides:

- **Consistency**: Same interface for all download types
- **Flexibility**: Full control over download parameters
- **Type Safety**: Strongly typed parameters with TypeScript
- **Maintainability**: Single code path to maintain and debug

## Error Handling

Download errors are captured and stored in the task's `error` field. Failed downloads can be retried using `retryTask()`.

Common errors:

- Network timeout
- File write errors
- Invalid URLs
- Session expired
- User cancelled

## URL Handling

The download manager automatically handles both absolute and relative URLs:

- **Absolute URLs** (`http://...` or `https://...`): Used as-is
- **Relative URLs** (`/path/to/file` or `path/to/file`): Automatically prepended with `BASE_URL`

Example:

```typescript
// These are equivalent if BASE_URL is "http://123.121.147.7:88"
url: "http://123.121.147.7:88/ve/documents/file.pdf";
url: "/ve/documents/file.pdf"; // Auto-prepends BASE_URL
```

## Security Considerations

- All downloads use session cookies for authentication
- URLs are validated and normalized before download
- File paths are sanitized
- Downloads respect session expiration
- User confirmation required for large files

## Performance

- **Streaming**: Prevents memory overflow for large files
- **Concurrent Limits**: Prevents network congestion
- **Progress Throttling**: Updates limited to 500ms intervals
- **Efficient State Management**: Minimal re-renders in UI

## Batch Download Feature

The document list supports batch downloading multiple documents at once:

### User Workflow

1. **Multi-select Documents**: Check the checkbox next to each document you want to download
2. **Select All**: Click the "Select All" button to select all visible documents (respects current search/filter)
3. **Batch Download**: Click "Batch Download" to select a destination folder
4. **Automatic Download**: All selected documents are added to the download center with preset save paths

### Keyboard Shortcuts

- **Cmd-A / Ctrl-A**: Select all documents (or clear selection if all are selected)
- **Cmd-S / Ctrl-S**: Start batch download (only when documents are selected)

### Technical Details

- **Single Folder Selection**: User selects destination folder once
- **Auto-naming**: Files are saved with their default names (`document.name.extension`)
- **Download Center Integration**: All downloads appear in the unified download center
- **Progress Tracking**: Each file download is tracked individually
- **No Dialog Interruption**: Once folder is selected, all files download without further user input

### Implementation

Located in `src/renderer/src/components/DocumentList.tsx`:

- Uses `selectDownloadFolder` IPC handler for folder selection
- Calls `downloadAddTask` with preset `savePath` for each document
- Clears selection after successful batch download

## Future Enhancements

Potential improvements:

- Download pause/resume support
- Download speed limiting
- Download queue prioritization
- Automatic retry on network errors
- Download history persistence
- Bandwidth usage statistics
- Drag-and-drop batch download to folders
