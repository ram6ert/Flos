/**
 * Shared Type Definitions
 *
 * IMPORTANT: ID Field Conventions
 * ================================
 *
 * This application uses two types of identifiers:
 *
 * 1. INTERNAL SYSTEM IDs (courseId, homeworkId, documentId, attachmentId, teacherId, etc.)
 *    - Type: string (containing numeric values)
 *    - Example: "12345", "67890"
 *    - Usage: Database references, API calls, internal system operations
 *    - Format: Always numeric, never letters or special characters
 *
 * 2. HUMAN-READABLE IDENTIFIERS (courseNumber, courseCode, etc.)
 *    - Type: string (containing alphanumeric values)
 *    - Example: "M302005B", "CS101"
 *    - Usage: Display purposes only, user-facing identification
 *    - Format: May contain letters, numbers, hyphens, etc.
 *
 * CRITICAL: Never confuse these two types!
 *   ✅ CORRECT: courseId = "12345", courseNumber = "M302005B"
 *   ❌ WRONG:   courseId = "M302005B", courseNumber = "12345"
 */

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

// Download types
export * from "./download";
