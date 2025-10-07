# Frontend Components Documentation

## Overview

The frontend is built with React 18 and TypeScript, featuring a modular component architecture with reusable UI components, internationalization support, and responsive design using TailwindCSS.

## Component Architecture

### Entry Point
- **main.tsx** - React application bootstrap with StrictMode
- **App.tsx** - Main application container with routing and state management
- **index.css** - Global styles and TailwindCSS imports

## Core UI Components (`components/common/StyledComponents.tsx`)

### Layout Components

#### Container
Responsive wrapper component with configurable padding.
```typescript
<Container padding="lg" className="custom-class">
  {children}
</Container>
```
- **Props**: `padding` (sm|md|lg|xl), `className`
- **Purpose**: Consistent spacing and layout structure

#### PageHeader
Standardized page header with title, subtitle, and action buttons.
```typescript
<PageHeader
  title="Page Title"
  subtitle="Optional subtitle"
  actions={<Button>Action</Button>}
/>
```
- **Features**: Flexible layout, border separator, responsive design

#### Grid
Responsive grid layout with auto-fill columns.
```typescript
<Grid columns="repeat(auto-fill, minmax(320px, 1fr))" gap="md">
  {children}
</Grid>
```
- **Props**: `columns`, `gap` (sm|md|lg)
- **Utility**: `createGridColumns(minWidth)` helper function

### Interactive Components

#### Button
Comprehensive button component with multiple variants and sizes.
```typescript
<Button
  variant="primary|secondary|success|danger|warning"
  size="sm|md|lg"
  disabled={boolean}
  onClick={handler}
>
  Button Text
</Button>
```
- **Features**: Hover states, focus rings, disabled states, full accessibility

#### Input
Styled input field with focus states and validation support.
```typescript
<Input
  type="text|password|email"
  value={value}
  onChange={handler}
  placeholder="Enter text"
  required={boolean}
  disabled={boolean}
/>
```
- **Styling**: TailwindCSS classes, focus rings, error states

#### FileInput
Specialized file upload component with custom styling.
```typescript
<FileInput
  onChange={handler}
  multiple={boolean}
  accept="image/*,.pdf"
  disabled={boolean}
/>
```
- **Features**: Drag-and-drop styling, file type restrictions

#### Checkbox
Custom checkbox with consistent styling.
```typescript
<Checkbox
  checked={boolean}
  onChange={handler}
  disabled={boolean}
/>
```

### Display Components

#### Card
Flexible card component with hover effects and shadows.
```typescript
<Card
  padding="sm|md|lg"
  shadow="sm|md|lg"
  onClick={handler}
  className="additional-styles"
>
  {content}
</Card>
```
- **Features**: Hover animations, click handlers, customizable shadows

#### Loading
Animated loading spinner with message.
```typescript
<Loading message="Loading courses..." />
```
- **Animation**: CSS spinning animation with consistent styling

#### ErrorDisplay
Error message component with retry functionality.
```typescript
<ErrorDisplay
  title="Error Title"
  message="Error description"
  onRetry={retryHandler}
  retryLabel="Try Again"
/>
```
- **Features**: Contextual styling, action buttons, dismissible

#### InfoBanner
Informational banner with variant styling.
```typescript
<InfoBanner variant="info|warning|success">
  {message}
</InfoBanner>
```

### Form Components

#### FormGroup
Form field wrapper with label and error display.
```typescript
<FormGroup label="Field Label" error="Error message">
  <Input {...inputProps} />
</FormGroup>
```
- **Features**: Consistent spacing, error handling, accessibility labels

## Feature Components

### Navigation (`Sidebar.tsx`)

Responsive sidebar navigation with active states and update checking.

**Features:**
- **Menu Items**: Courses, Homework, Documents, Schedule
- **Active States**: Visual feedback for current view
- **Update Checker**: Built-in update check functionality
- **Internationalization**: Full i18n support
- **Responsive Design**: Hover states and transitions

**Props:**
```typescript
interface SidebarProps {
  activeView: "courses" | "homework" | "documents" | "flow-schedule";
  onViewChange: (view: ActiveView) => void;
}
```

**Update Checking:**
- Integrates with Electron's auto-updater
- Loading states with spinner animation
- Error handling for update failures
- Version comparison and notification

### Authentication (`Login.tsx`)

Comprehensive login form with credential management and security features.

**Features:**
- **Auto-fill Password**: Default pattern `Bjtu@{username}`
- **Credential Storage**: Optional encrypted credential persistence
- **Password Hashing**: Client-side MD5 hashing
- **Captcha Integration**: Visual captcha with refresh capability
- **Error Handling**: Detailed error messages with internationalization
- **Form Validation**: Required field validation
- **Loading States**: Disabled form during authentication

**Security Features:**
- MD5 password hashing before transmission
- Secure credential storage via Electron's secure storage
- Session token management
- Automatic captcha refresh on failed attempts

**Props:**
```typescript
interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}
```

**State Management:**
```typescript
// Credential state
const [username, setUsername] = useState("");
const [password, setPassword] = useState("");
const [passcode, setPasscode] = useState("");
const [rememberCredentials, setRememberCredentials] = useState(false);
const [isPasswordHashed, setIsPasswordHashed] = useState(false);

// UI state
const [captchaUrl, setCaptchaUrl] = useState("");
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState("");
```

### Data Display Components

#### CourseList (`CourseList.tsx`)
- Course grid display with filtering
- Refresh functionality
- Course selection handling
- Navigation integration

#### CourseCard (`CourseCard.tsx`)
- Individual course information display
- Teacher details and course metadata
- Click-to-select functionality
- Responsive card layout

#### HomeworkList (`HomeworkList.tsx`)
- Homework filtering by course
- Due date visualization
- Submission status indicators
- Streaming data loading

#### HomeworkCard (`HomeworkCard.tsx`)
- Individual homework display
- Due date countdown
- Submission status
- File attachment handling

#### DocumentList (`DocumentList.tsx`)
- Document browsing by course
- File type categorization
- Download functionality
- Search and filtering
- **Batch download with multi-select**:
  - Checkbox-based multi-select
  - Select all / Clear selection controls
  - Batch download to single folder
  - Keyboard shortcuts (Cmd-A, Cmd-S)

#### FlowScheduleTable (`FlowScheduleTable.tsx`)
- Weekly schedule visualization
- Course time slot display
- Conflict detection
- Interactive schedule grid

### Notification Components

#### UpdateNotification (`UpdateNotification.tsx`)
- Update available notifications
- Download progress tracking
- Version information display
- User action prompts

#### UpdateStatusNotification (`UpdateStatusNotification.tsx`)
- Update process status
- Success/error messaging
- Progress indicators
- Dismissible notifications

## State Management Patterns

### Local Component State
- Form input handling
- UI state (loading, errors)
- Component-specific data

### Prop Drilling
- Data flow from App.tsx to child components
- Event handlers passed down
- Shared state management

### Context Usage
- Internationalization (i18next)
- Theme and styling context

## Styling Architecture

### TailwindCSS Integration
- Utility-first CSS approach
- Responsive design utilities
- Custom component styling
- Consistent design tokens

### Component Styling Patterns
```typescript
// Conditional classes utility
const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(" ");
};

// Usage in components
className={cn(
  "base-classes",
  condition && "conditional-classes",
  variant === "primary" && "variant-classes",
  customClassName
)}
```

### Design System
- **Colors**: Blue primary, gray neutrals, semantic colors
- **Spacing**: Consistent padding/margin scale
- **Typography**: Font weight and size hierarchy
- **Shadows**: Depth indication with shadow utilities
- **Borders**: Consistent border radius and colors

## Internationalization (i18n)

### Implementation
- **Library**: react-i18next
- **Configuration**: `src/renderer/src/i18n.ts`
- **Usage**: `useTranslation()` hook in components

### Language Support
- **Primary**: Chinese (zh-CN)
- **Secondary**: English (en-US)
- **Detection**: Browser/system language detection
- **Fallback**: English for missing translations

### Translation Keys
```typescript
const { t } = useTranslation();

// Usage examples
t("loginButton")      // "登录" or "Login"
t("courses")          // "课程" or "Courses"
t("enterUsername")    // "输入用户名" or "Enter Username"
```

## Performance Considerations

### React Optimizations
- React.StrictMode for development debugging
- Efficient re-rendering patterns
- State optimization strategies

### Asset Optimization
- Lazy loading for large components
- Image optimization strategies
- Bundle size management

### User Experience
- Loading states for all async operations
- Error boundaries for component isolation
- Responsive design for different screen sizes
- Smooth transitions and animations

## Accessibility Features

### Keyboard Navigation
- Tab order management
- Focus indicators
- Keyboard shortcuts

### Screen Reader Support
- ARIA labels and descriptions
- Semantic HTML structure
- Form field associations

### Visual Accessibility
- High contrast colors
- Clear focus indicators
- Scalable typography
- Error message clarity