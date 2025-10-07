import { app, BrowserWindow } from "electron";
import axios from "axios";
import { API_CONFIG } from "./constants";
import { createWindow } from "./window";
import { setupAxiosSessionInterceptors } from "./api";
import { setupAuthHandlers } from "./handlers/auth";
import { setupCourseHandlers } from "./handlers/course";
import { setupHomeworkHandlers } from "./handlers/homework";
import { setupDocumentHandlers } from "./handlers/document";
import { setupScheduleHandlers } from "./handlers/schedule";
import { setupUpdateHandlers } from "./handlers/update";
import { setupDownloadHandlers } from "./handlers/download";
import { autoCheckForUpdates } from "./updater";
export { notifyRendererAboutUpdate } from "./handlers/update";
import { Logger } from "./logger";

// Configure axios defaults
axios.defaults.headers.common["User-Agent"] = API_CONFIG.USER_AGENT;
axios.defaults.timeout = API_CONFIG.TIMEOUT;

app.whenReady().then(() => {
  // Setup axios interceptors to detect session expiration
  setupAxiosSessionInterceptors();
  createWindow();

  // Setup all IPC handlers
  setupAuthHandlers();
  setupCourseHandlers();
  setupHomeworkHandlers();
  setupDocumentHandlers();
  setupScheduleHandlers();
  setupUpdateHandlers();
  setupDownloadHandlers();

  // Auto update check after 5 second delay to avoid affecting app startup speed
  setTimeout(() => {
    autoCheckForUpdates().catch((error) => {
      Logger.error("Auto update check failed", error);
    });
  }, 5000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
