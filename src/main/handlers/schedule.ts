import { ipcMain, BrowserWindow } from "electron";
import { currentSession } from "../auth";
import {
  getCachedData,
  setCachedData,
  saveCacheToFile,
  COURSE_CACHE_DURATION,
} from "../cache";
import {
  requestQueue,
  fetchScheduleData,
} from "../api";

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

export function setupScheduleHandlers() {
  // Schedule handlers
  ipcMain.handle(
    "get-schedule",
    async (event, options?: { skipCache?: boolean }) => {
      if (!currentSession) {
        throw new Error("Not logged in");
      }

      const cacheKey = "schedule";

      // If skipCache is requested, fetch fresh data immediately
      if (options?.skipCache) {
        return requestQueue.add(async () => {
          const scheduleData = await fetchScheduleData(true);
          // Update cache with fresh data
          setCachedData(cacheKey, scheduleData);
          saveCacheToFile(currentSession?.username);
          return scheduleData;
        });
      }

      // Always return cached data immediately if available
      const cachedData = getCachedData(cacheKey, COURSE_CACHE_DURATION);

      // Start background refresh if cache is stale or doesn't exist
      if (!cachedData) {
        refreshCacheInBackground(cacheKey, async () => {
          return requestQueue.add(async () => {
            return await fetchScheduleData(false);
          });
        });
      }

      // Return cached data if available, otherwise wait for fresh data
      if (cachedData) {
        return cachedData;
      } else {
        // No cache, wait for fresh data
        return requestQueue.add(async () => {
          const scheduleData = await fetchScheduleData(false);
          setCachedData(cacheKey, scheduleData);
          saveCacheToFile(currentSession?.username);
          return scheduleData;
        });
      }
    }
  );

  ipcMain.handle("refresh-schedule", async () => {
    if (!currentSession) {
      throw new Error("Not logged in");
    }

    return requestQueue.add(async () => {
      const scheduleData = await fetchScheduleData(true);
      setCachedData("schedule", scheduleData);
      saveCacheToFile(currentSession?.username);
      return scheduleData;
    });
  });
}