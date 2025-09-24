import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { app, BrowserWindow } from "electron";
import * as iconv from "iconv-lite";
import { API_CONFIG, courseAPI, courseVe } from "./constants";
import { LoginCredentials, LoginResponse } from "../shared/types";
import { Logger } from "./logger";

// Session management - store credentials for re-authentication
export let currentSession: {
  username: string;
  passwordHash: string;
  sessionId?: string;
  loginTime?: Date;
  isLoggedIn?: boolean;
} | null = null;

// Captcha session management
export let captchaSession: {
  jsessionId: string;
  cookies: string[];
} | null = null;

// Password security helpers - using MD5 to match server expectations
export const hashPasswordMD5 = (password: string): string => {
  return crypto.createHash("md5").update(password).digest("hex");
};

// File paths for storing credentials
export const getCredentialsPath = () => {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "credentials.json");
};

// Cookie parsing utilities
export const extractJSessionIdFromCookies = (cookies: string[]): string => {
  for (const cookie of cookies) {
    const match = cookie.match(/JSESSIONID=([^;]+)/);
    if (match) return match[1];
  }
  return "";
};

export const parseCookies = (setCookieHeaders: string[]): string[] => {
  return setCookieHeaders.map((cookieHeader) => cookieHeader.split(";")[0]);
};

export const updateSessionCookies = (response: any) => {
  const setCookieHeaders = response.headers["set-cookie"];
  if (setCookieHeaders) {
    const cookies = parseCookies(setCookieHeaders);
    const jsessionId = extractJSessionIdFromCookies(cookies);

    if (jsessionId) {
      captchaSession = { jsessionId, cookies };
    }
  }
};

// Authentication handlers
export const handleFetchCaptcha = async (): Promise<{
  success: boolean;
  imageData?: string;
  error?: string;
}> => {
  try {
    // Clear any existing captcha session to start fresh
    captchaSession = null;

    const response = await courseVe.get(`${API_CONFIG.ENDPOINTS.CAPTCHA}`, {
      responseType: "arraybuffer",
      headers: {},
    });

    updateSessionCookies(response);
    Logger.event("Captcha session created");

    const base64Image = Buffer.from(response.data).toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    return { success: true, imageData: dataUrl };
  } catch (error) {
    Logger.error("Captcha fetch failed", error);
    return { success: false, error: "Failed to fetch captcha" };
  }
};

export const handleLogin = async (
  credentials: LoginCredentials
): Promise<LoginResponse> => {
  try {
    const formData = new URLSearchParams();
    formData.append("login", "main_2");
    formData.append("qxkt_type", "");
    formData.append("qxkt_url", "");
    formData.append("username", credentials.username);
    formData.append("password", credentials.password);
    formData.append("passcode", credentials.passcode);

    // Use captcha session cookies if available
    const cookieHeader = captchaSession?.cookies.join("; ") || "";

    const response = await courseVe.post(
      `${API_CONFIG.ENDPOINTS.LOGIN}`,
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: API_CONFIG.ORIGIN,
          ...(cookieHeader && { Cookie: cookieHeader }),
        },
        maxRedirects: 0,
        validateStatus: () => true,
        responseType: "arraybuffer", // Get raw bytes to decode as GBK
      }
    );

    updateSessionCookies(response);

    // Decode GBK response to handle Chinese error messages properly
    const responseText = iconv.decode(Buffer.from(response.data), "gbk");

    // Check for login failure indicators
    if (responseText.includes("alert(")) {
      const alertMatch = responseText.match(/alert\(['"]([^'"]+)['"]\)/);
      const message = alertMatch ? alertMatch[1] : "Login failed";
      return { success: false, message };
    }

    // If no alert, login was successful - get sessionId from message endpoint
    let sessionId: string | undefined;
    try {
      const messageResponse = await courseAPI.get(
        `/coursePlatform/message.shtml?method=getArticleList`,
        {
          headers: {
            Accept: "application/json, text/javascript, */*; q=0.01",
            Cookie: cookieHeader,
            Referer: `${API_CONFIG.API_BASE_URL}/ve/`,
            "X-Requested-With": "XMLHttpRequest",
          },
          validateStatus: () => true,
        }
      );

      if (messageResponse.status === 200 && messageResponse.data) {
        const messageData =
          typeof messageResponse.data === "string"
            ? JSON.parse(messageResponse.data)
            : messageResponse.data;
        sessionId = messageData.sessionId;
        Logger.debug(
          "Fetched sessionId during login:",
          Logger.maskSensitive(sessionId || "")
        );
        Logger.event("Session ID obtained");
      }
    } catch (error) {
      Logger.warn("Failed to fetch session ID during login", error);
    }

    // Store credentials and sessionId for future authentication
    currentSession = {
      username: credentials.username,
      passwordHash: credentials.password,
      sessionId,
      loginTime: new Date(),
      isLoggedIn: true,
    };

    const requestIdMatch = responseText.match(/var requestId = '([^']+)'/);
    const requestId = requestIdMatch ? requestIdMatch[1] : "";

    return { success: true, requestId };
  } catch (error) {
    Logger.error("Login failed", error);
    return { success: false, message: "Network error during login" };
  }
};

export const handleStoreCredentials = async (credentials: {
  username: string;
  password: string;
  jsessionId?: string;
}): Promise<boolean> => {
  try {
    const credentialsPath = getCredentialsPath();
    // Password is already MD5 hashed by the renderer
    const data = {
      username: credentials.username,
      passwordHash: credentials.password, // Already hashed
      jsessionId: credentials.jsessionId || captchaSession?.jsessionId,
      savedAt: new Date().toISOString(),
    };

    await fs.promises.writeFile(credentialsPath, JSON.stringify(data, null, 2));
    Logger.event(
      "Credentials stored",
      data.jsessionId ? "with JSESSIONID" : "without JSESSIONID"
    );
    return true;
  } catch (error) {
    Logger.error("Failed to store credentials", error);
    return false;
  }
};

export const handleGetStoredCredentials = async (): Promise<{
  username: string;
  password: string;
  jsessionId?: string;
} | null> => {
  try {
    const credentialsPath = getCredentialsPath();
    const data = await fs.promises.readFile(credentialsPath, "utf8");
    const credentials = JSON.parse(data);

    return {
      username: credentials.username,
      password: credentials.passwordHash,
      jsessionId: credentials.jsessionId,
    };
  } catch (error) {
    return null;
  }
};

export const handleIsLoggedIn = async (): Promise<boolean> => {
  return currentSession?.isLoggedIn === true;
};

export const getCurrentSession = (): typeof currentSession => {
  return currentSession;
};

export const handleLogout = async (): Promise<void> => {
  // Clear all session data
  currentSession = null;
  captchaSession = null;

  Logger.event("User logged out");
};

export const handleSessionExpired = async (): Promise<void> => {
  Logger.event("Session expired");
  currentSession = null;
  captchaSession = null;

  // Clear stored JSESSIONID since it's expired
  try {
    const stored = await handleGetStoredCredentials();
    if (stored) {
      await handleStoreCredentials({
        username: stored.username,
        password: stored.password,
        // Don't include jsessionId - it's expired
      });
    }
  } catch (error) {
    Logger.error("Failed to clear expired JSESSIONID", error);
  }

  try {
    // Notify all renderer windows
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send("session-expired");
    }
  } catch (notifyError) {
    Logger.warn(
      "Failed to notify renderer about session expiration",
      notifyError
    );
  }
};

export const handleValidateStoredSession = async (): Promise<boolean> => {
  try {
    const stored = await handleGetStoredCredentials();
    if (!stored || !stored.jsessionId) {
      Logger.debug("No stored JSESSIONID found");
      return false;
    }

    Logger.event("Attempting session restoration");

    // Restore captcha session with stored JSESSIONID
    captchaSession = {
      jsessionId: stored.jsessionId,
      cookies: [`JSESSIONID=${stored.jsessionId}`],
    };

    // Test the session by making a simple API call
    const testUrl = `/coursePlatform/message.shtml?method=getArticleList`;
    const response = await courseAPI.get(testUrl, {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        Cookie: captchaSession.cookies.join("; "),
        Referer: `${API_CONFIG.API_BASE_URL}/ve/`,
        "X-Requested-With": "XMLHttpRequest",
      },
      validateStatus: () => true,
    });

    if (response.status === 200 && response.data) {
      // Check if response contains login indicators
      const responseText =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);

      if (responseText.includes("登录")) {
        Logger.event("Session restoration failed - expired");
        captchaSession = null;
        return false;
      }

      // Session is valid, restore full session state
      const messageData =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;

      currentSession = {
        username: stored.username,
        passwordHash: stored.password,
        sessionId: messageData.sessionId,
        loginTime: new Date(),
        isLoggedIn: true,
      };

      Logger.event("Session restored successfully");
      return true;
    } else {
      Logger.event("Session restoration failed - invalid");
      // Clear the expired session
      captchaSession = null;
      return false;
    }
  } catch (error) {
    Logger.error("Failed to validate stored session", error);
    captchaSession = null;
    return false;
  }
};
