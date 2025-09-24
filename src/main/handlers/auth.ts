import { ipcMain } from "electron";
import { LoginCredentials, LoginResponse } from "../../shared/types";
import {
  currentSession,
  handleFetchCaptcha,
  handleLogin,
  handleStoreCredentials,
  handleGetStoredCredentials,
  handleIsLoggedIn,
  handleLogout,
  handleValidateStoredSession,
  getCurrentSession,
  getCredentialsPath,
} from "../auth";
import {
  loadCacheFromFile,
  saveCacheToFile,
  clearCache,
} from "../cache";
import * as fs from "fs";

export function setupAuthHandlers() {
  // IPC handlers for captcha and authentication
  ipcMain.handle("fetch-captcha", handleFetchCaptcha);

  ipcMain.handle(
    "login",
    async (event, credentials: LoginCredentials): Promise<LoginResponse> => {
      const result = await handleLogin(credentials);
      if (result.success && currentSession) {
        // Load user-specific cache after successful login
        loadCacheFromFile(currentSession.username);
      }
      return result;
    }
  );

  ipcMain.handle("logout", async () => {
    // Save current user's cache before logout
    if (currentSession) {
      saveCacheToFile(currentSession.username);
    }
    await handleLogout();
    clearCache();
  });

  ipcMain.handle("is-logged-in", handleIsLoggedIn);
  ipcMain.handle("validate-stored-session", async () => {
    const isValid = await handleValidateStoredSession();
    if (currentSession) {
      loadCacheFromFile(currentSession.username);
    }
    return isValid;
  });
  ipcMain.handle("get-current-session", () => getCurrentSession());

  // Credential storage handlers
  ipcMain.handle("store-credentials", async (event, credentials) => {
    return await handleStoreCredentials(credentials);
  });
  ipcMain.handle("get-stored-credentials", async (_event) => {
    return await handleGetStoredCredentials();
  });

  ipcMain.handle("clear-stored-credentials", async () => {
    try {
      const credentialsPath = getCredentialsPath();
      await fs.promises.unlink(credentialsPath);
    } catch (error) {
      // File doesn't exist, which is fine
    }
  });
}