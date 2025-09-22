const isDev = process.env.NODE_ENV === "development";

export class Logger {
  // Logs that are safe for production
  static info(message: string, ...args: any[]) {
    console.log(`[INFO] ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args);
  }

  static error(message: string, error?: any) {
    if (error) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }

  // Development-only logs (sensitive information)
  static debug(message: string, ...args: any[]) {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  // Sanitize URLs by removing query parameters and tokens
  static sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Keep only the pathname, remove query params and fragments
      return `${urlObj.origin}${urlObj.pathname}`;
    } catch {
      // If URL parsing fails, just return a generic message
      return "[URL]";
    }
  }

  // Mask sensitive data (keeping first 4 and last 4 characters)
  static maskSensitive(data: string, keepLength: number = 4): string {
    if (!data || data.length <= keepLength * 2) {
      return "[MASKED]";
    }
    const start = data.substring(0, keepLength);
    const end = data.substring(data.length - keepLength);
    const middle = "*".repeat(Math.max(0, data.length - keepLength * 2));
    return `${start}${middle}${end}`;
  }

  // Log application events (safe for production)
  static event(event: string, details?: string) {
    console.log(`[EVENT] ${event}${details ? `: ${details}` : ""}`);
  }

  // Log performance metrics (safe for production)
  static perf(operation: string, duration: number) {
    console.log(`[PERF] ${operation}: ${duration}ms`);
  }
}