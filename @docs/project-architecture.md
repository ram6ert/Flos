# Smart Course Platform - Project Architecture

## Overview

Smart Course Platform (BAKA Course Platform) is an Electron-based desktop application that provides convenient access to course information, homework, and documents. The application follows a modern desktop app architecture with clear separation between main process (backend) and renderer process (frontend).

## Technology Stack

### Core Technologies
- **Electron** - Desktop application framework
- **React 18** - Frontend UI framework with React.StrictMode
- **TypeScript** - Type-safe development across all modules
- **Vite** - Fast development and build tooling
- **TailwindCSS** - Utility-first CSS framework

### Build & Development Tools
- **ESBuild** - Main process bundling and minification
- **Concurrently** - Parallel development server execution
- **Cross-env** - Cross-platform environment variables
- **Electron Builder** - Application packaging and distribution

### Additional Libraries
- **Axios** - HTTP client with session management
- **Cheerio** - Server-side HTML parsing
- **Crypto-js** - Cryptographic functions
- **i18next** - Internationalization support
- **iconv-lite** - Character encoding conversion (GBK to UTF-8)
- **node-cache** - In-memory caching system

## Application Architecture

### Directory Structure
```
src/
├── main/           # Electron main process (Node.js backend)
├── renderer/       # React frontend application
└── shared/         # Shared types and utilities
```

### Main Process Architecture (Backend)
Located in `src/main/`, handles system integration and API communication:

#### Core Modules
- **index.ts** - Application entry point and IPC handler setup
- **window.ts** - Main window creation and management
- **api.ts** - API communication and session management
- **auth.ts** - Authentication and session handling
- **cache.ts** - User-specific caching system
- **logger.ts** - Application logging utilities
- **updater.ts** - Auto-update functionality
- **constants.ts** - Configuration and API endpoints

#### Handler Modules
- **handlers/auth.ts** - Authentication IPC handlers
- **handlers/course.ts** - Course data IPC handlers
- **handlers/homework.ts** - Homework management IPC handlers
- **handlers/document.ts** - Document handling IPC handlers
- **handlers/schedule.ts** - Schedule parsing IPC handlers
- **handlers/update.ts** - Update notification IPC handlers

#### Specialized Parsers
- **schedule-parser.ts** - HTML schedule parsing and transformation

### Renderer Process Architecture (Frontend)
Located in `src/renderer/`, implements the user interface:

#### Core Application
- **main.tsx** - React application entry point
- **App.tsx** - Main application component with routing logic
- **index.css** - Global styles and Tailwind imports
- **i18n.ts** - Internationalization configuration

#### Component Architecture
```
components/
├── common/
│   └── StyledComponents.tsx  # Reusable UI components
├── CourseList.tsx           # Course listing and management
├── CourseCard.tsx           # Individual course display
├── HomeworkList.tsx         # Homework listing
├── HomeworkCard.tsx         # Individual homework display
├── DocumentList.tsx         # Document management
├── Login.tsx               # Authentication interface
├── Sidebar.tsx             # Navigation sidebar
├── FlowScheduleTable.tsx   # Schedule visualization
├── UpdateNotification.tsx   # Update notifications
└── UpdateStatusNotification.tsx # Update status display
```

### Shared Types System
Located in `src/shared/types/`, provides type safety across processes:

- **auth.ts** - Authentication and session types
- **course.ts** - Course data structures
- **document.ts** - Document and file types
- **homework.ts** - Homework and assignment types
- **schedule.ts** - Schedule and timetable types
- **index.ts** - Unified type exports

## Data Flow Architecture

### IPC Communication Pattern
```
Renderer Process ↔ IPC Channels ↔ Main Process ↔ External APIs
```

### Session Management
1. **Authentication Flow**: Login → Session Creation → Cookie Management
2. **Session Persistence**: JSESSIONID storage and validation
3. **Session Expiry**: Automatic detection and re-authentication prompts

### Caching Strategy
- **User-specific caching**: Separate cache files per username
- **Cache persistence**: File-based storage with TTL
- **Cache categories**: Courses, homework, documents, schedules
- **Refresh mechanisms**: Force refresh capabilities

### API Integration
- **Rate limiting**: Intelligent request queuing
- **Session interceptors**: Automatic session expiry detection
- **Error handling**: Comprehensive error management
- **Data sanitization**: Server response transformation to clean types

## Security Considerations

### Authentication Security
- Secure credential storage with encryption
- Session token management
- Automatic session validation

### API Security
- Dynamic User-Agent generation
- Request rate limiting
- Session cookie management
- HTTPS upgrade enforcement

### Data Security
- Local data encryption
- Secure file operations
- Input sanitization
- XSS prevention in HTML parsing

## Build & Deployment

### Development Workflow
```bash
yarn dev          # Start development servers (Vite + Electron)
yarn dev:vite     # Vite development server only
yarn dev:electron # Electron development process only
```

### Production Build
```bash
yarn build        # Build both Vite and Electron bundles
yarn build:dist   # Create distributable packages
```

### Platform-specific Builds
```bash
yarn build:win    # Windows NSIS installer and portable
yarn build:mac    # macOS DMG and ZIP (ARM64)
yarn build:linux  # Linux AppImage
yarn build:all    # All platforms
```

### Distribution
- **GitHub Releases**: Automated release publishing
- **Auto-updater**: Built-in update mechanism
- **Platform targeting**: Optimized builds per OS architecture

## Performance Optimizations

### Frontend Performance
- React.StrictMode for development debugging
- Component memoization for expensive operations
- Efficient state management patterns
- TailwindCSS for minimal CSS overhead

### Backend Performance
- Request queuing and rate limiting
- Intelligent caching with TTL
- Streaming data fetchers for large datasets
- Concurrent request processing

### Memory Management
- User-specific cache isolation
- Automatic cache cleanup
- Session garbage collection
- Efficient HTML parsing

## Internationalization

### Language Support
- **Primary**: Chinese (zh-CN)
- **Secondary**: English (en-US)
- **Auto-detection**: Browser/system language detection
- **Fallback**: Graceful degradation to English

### Implementation
- i18next integration
- React-i18next hooks
- Dynamic language switching
- Localized date/time formatting