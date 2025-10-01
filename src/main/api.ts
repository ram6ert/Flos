/**
 * API module - Backward compatibility re-export
 *
 * This file maintains backward compatibility by re-exporting all API functionality
 * from the new modular api/ directory structure.
 *
 * New structure:
 * - api/utils.ts: Session management, rate limiting, sanitization
 * - api/homework.ts: Homework operations
 * - api/course.ts: Course operations
 * - api/document.ts: Document operations
 * - api/schedule.ts: Schedule operations
 * - api/index.ts: Main entry point
 */

export * from "./api/index";
