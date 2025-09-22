import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { Logger } from "./logger";

// Cache storage interfaces
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

interface CacheMetadata {
  created: string;
  lastSaved: string;
  username?: string;
  appVersion: string;
}

interface CacheFile {
  version: string;
  metadata: CacheMetadata;
  entries: { [key: string]: CacheEntry };
}

// Cache storage
let cacheData: CacheFile = {
  version: "2.0",
  metadata: {
    created: new Date().toISOString(),
    lastSaved: new Date().toISOString(),
    appVersion: process.env.npm_package_version || "unknown"
  },
  entries: {}
};

// Cache durations
export const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day for homework
export const COURSE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days for courses
export const SCHEDULE_CACHE_DURATION = COURSE_CACHE_DURATION; // Same as courses

// Get cache file path (user-specific)
export const getCachePath = (username?: string) => {
  const userDataPath = app.getPath("userData");
  const cacheFileName = username ? `cache_${username}.json` : "cache.json";
  return path.join(userDataPath, cacheFileName);
};


// Load cache from file
export const loadCacheFromFile = (username?: string) => {
  try {
    const cachePath = getCachePath(username);
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, "utf8");
      const parsed = JSON.parse(data);

      // Validate cache format
      if (parsed && parsed.entries && parsed.metadata && parsed.version === "2.0") {
        cacheData = parsed;
        if (username) {
          cacheData.metadata.username = username;
        }
        Logger.event("Cache loaded and validated");
      } else {
        Logger.warn("Invalid or outdated cache format, resetting cache");
        throw new Error("Invalid cache structure");
      }
    } else {
      // Initialize new cache
      cacheData.metadata.username = username;
    }
  } catch (error) {
    Logger.error("Failed to load cache, resetting", error);
    cacheData = {
      version: "2.0",
      metadata: {
        created: new Date().toISOString(),
        lastSaved: new Date().toISOString(),
        username,
        appVersion: process.env.npm_package_version || "unknown"
      },
      entries: {}
    };

    // Try to backup corrupted cache
    try {
      const cachePath = getCachePath(username);
      if (fs.existsSync(cachePath)) {
        const backupPath = `${cachePath}.backup.${Date.now()}`;
        fs.renameSync(cachePath, backupPath);
        Logger.event(`Corrupted cache backed up to ${backupPath}`);
      }
    } catch (backupError) {
      Logger.error("Failed to backup corrupted cache", backupError);
    }
  }
};

// Save cache to file
export const saveCacheToFile = (username?: string) => {
  try {
    const cachePath = getCachePath(username);
    const tempPath = `${cachePath}.tmp`;

    // Update metadata
    cacheData.metadata.lastSaved = new Date().toISOString();
    if (username) {
      cacheData.metadata.username = username;
    }

    // Write to temp file first, then rename to prevent corruption
    fs.writeFileSync(tempPath, JSON.stringify(cacheData, null, 2));

    // Verify the written file is valid JSON
    const verification = JSON.parse(fs.readFileSync(tempPath, "utf8"));
    if (verification && verification.entries && verification.metadata) {
      fs.renameSync(tempPath, cachePath);
      Logger.event("Cache saved successfully");
    } else {
      throw new Error("Cache verification failed");
    }
  } catch (error) {
    Logger.error("Failed to save cache", error);

    // Clean up temp file if it exists
    try {
      const tempPath = `${getCachePath(username)}.tmp`;
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      Logger.error("Failed to cleanup temp file", cleanupError);
    }
  }
};

// Cache management functions
export const getCachedData = (
  key: string,
  maxAge?: number
): any | null => {
  const entry = cacheData.entries[key];
  if (!entry) return null;

  const ttl = maxAge || entry.ttl;
  const isExpired = Date.now() - entry.timestamp > ttl;
  if (isExpired) {
    delete cacheData.entries[key];
    return null;
  }

  return entry.data;
};

export const getCacheTimestamp = (key: string): number => {
  return cacheData.entries[key]?.timestamp || 0;
};

export const setCachedData = (key: string, data: any, ttl: number = CACHE_DURATION): void => {
  cacheData.entries[key] = {
    data,
    timestamp: Date.now(),
    ttl
  };
};

export const clearCache = (): void => {
  cacheData.entries = {};
};

export const invalidateCache = (keyPattern: string): void => {
  Object.keys(cacheData.entries).forEach((key) => {
    if (key.includes(keyPattern)) {
      delete cacheData.entries[key];
    }
  });
};

export const isCacheStale = (key: string, maxAge?: number): boolean => {
  const entry = cacheData.entries[key];
  if (!entry) return true;
  const ttl = maxAge || entry.ttl;
  return Date.now() - entry.timestamp > ttl;
};

export const getCacheAge = (key: string): number => {
  const entry = cacheData.entries[key];
  if (!entry) return -1;
  return Date.now() - entry.timestamp;
};
