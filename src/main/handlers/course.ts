import { ipcMain, BrowserWindow } from "electron";
import { currentSession, handleSessionExpired } from "../auth";
import {
  getCachedData,
  setCachedData,
  saveCacheToFile,
  COURSE_CACHE_DURATION,
} from "../cache";
import { requestQueue, authenticatedAPIRequest, fetchCourseList } from "../api";

// Track ongoing refresh operations to prevent duplicate requests
const ongoingRefreshes = new Set<string>();

// Background refresh function with retry logic
async function refreshCacheInBackground(
  cacheKey: string,
  refreshFunction: () => Promise<any>,
  retries = 2
) {
  // Prevent duplicate refreshes for the same cache key
  if (ongoingRefreshes.has(cacheKey)) {
    return;
  }

  ongoingRefreshes.add(cacheKey);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const freshData = await refreshFunction();
      setCachedData(cacheKey, freshData);
      saveCacheToFile(currentSession?.username);

      // Notify renderer of updated data
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        window.webContents.send("cache-updated", {
          key: cacheKey,
          data: freshData,
        });
      });

      return; // Success, exit retry loop
    } catch (error) {
      lastError = error as Error;
      console.error(
        `Background refresh attempt ${attempt + 1} failed for ${cacheKey}:`,
        error
      );

      if (attempt < retries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`All refresh attempts failed for ${cacheKey}:`, lastError);
  ongoingRefreshes.delete(cacheKey);
}

export function setupCourseHandlers() {
  // Course platform API handlers
  ipcMain.handle("get-semester-info", async () => {
    if (!currentSession) {
      await handleSessionExpired();
      throw new Error("SESSION_EXPIRED");
    }

    return requestQueue.add(async () => {
      const url = `/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
      const data = await authenticatedAPIRequest(url);

      if (data.result && data.result.length > 0) {
        return data.result[0].xqCode;
      }
      throw new Error("Failed to get semester info");
    });
  });

  ipcMain.handle(
    "get-courses",
    async (event, options?: { skipCache?: boolean }) => {
      if (!currentSession) {
        await handleSessionExpired();
        throw new Error("SESSION_EXPIRED");
      }

      const cacheKey = "courses";
      const _now = Date.now();

      // If skipCache is requested, fetch fresh data immediately
      if (options?.skipCache) {
        return requestQueue.add(async () => {
          const courseList = await fetchCourseList();
          // Update cache with fresh data
          setCachedData(cacheKey, courseList);
          saveCacheToFile(currentSession?.username);
          return { data: courseList, fromCache: false, age: 0 };
        });
      }

      // Always return cached data immediately if available
      const cachedData = getCachedData(cacheKey, COURSE_CACHE_DURATION);

      // Start background refresh if cache is stale or doesn't exist
      if (!cachedData) {
        refreshCacheInBackground(cacheKey, async () => {
          return requestQueue.add(async () => {
            return await fetchCourseList();
          });
        });
      }

      // Return cached data if available, otherwise wait for fresh data
      if (cachedData) {
        return { data: cachedData, fromCache: true, age: 0 };
      } else {
        // No cache, wait for fresh data
        return requestQueue.add(async () => {
          const courseList = await fetchCourseList();
          setCachedData(cacheKey, courseList);
          saveCacheToFile(currentSession?.username);
          return { data: courseList, fromCache: false, age: 0 };
        });
      }
    }
  );

  ipcMain.handle("refresh-courses", async () => {
    if (!currentSession) {
      await handleSessionExpired();
      throw new Error("SESSION_EXPIRED");
    }

    return requestQueue.add(async () => {
      const courseList = await fetchCourseList();
      setCachedData("courses", courseList);
      saveCacheToFile(currentSession?.username);
      return { data: courseList, fromCache: false, age: 0 };
    });
  });
}
