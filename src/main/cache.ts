import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { Logger } from "./logger";

// Cache storage
let homeworkCache: { [key: string]: any } = {};
let cacheTimestamps: { [key: string]: number } = {};

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
      homeworkCache = parsed.cache || {};
      cacheTimestamps = parsed.timestamps || {};
      Logger.event("Cache loaded");
    }
  } catch (error) {
    Logger.error("Failed to load cache", error);
    homeworkCache = {};
    cacheTimestamps = {};
  }
};

// Save cache to file
export const saveCacheToFile = (username?: string) => {
  try {
    const cachePath = getCachePath(username);
    const data = {
      cache: homeworkCache,
      timestamps: cacheTimestamps,
      lastSaved: new Date().toISOString(),
    };
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
    Logger.event("Cache saved");
  } catch (error) {
    Logger.error("Failed to save cache", error);
  }
};

// Cache management functions
export const getCachedData = (
  key: string,
  maxAge: number = CACHE_DURATION
): any | null => {
  const timestamp = cacheTimestamps[key];
  if (!timestamp) return null;

  const isExpired = Date.now() - timestamp > maxAge;
  if (isExpired) {
    delete homeworkCache[key];
    delete cacheTimestamps[key];
    return null;
  }

  return homeworkCache[key] || null;
};

export const setCachedData = (key: string, data: any): void => {
  homeworkCache[key] = data;
  cacheTimestamps[key] = Date.now();
};

export const clearCache = (): void => {
  homeworkCache = {};
  cacheTimestamps = {};
};

export const invalidateCache = (keyPattern: string): void => {
  Object.keys(homeworkCache).forEach((key) => {
    if (key.includes(keyPattern)) {
      delete homeworkCache[key];
      delete cacheTimestamps[key];
    }
  });
};
