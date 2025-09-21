import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import axios from "axios";
import * as iconv from "iconv-lite";
import { API_CONFIG } from "./constants";
import { LoginCredentials, LoginResponse } from "./types";

// Session management - store credentials for re-authentication
export let currentSession: {
  username: string;
  passwordHash: string;
  sessionId?: string;
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

export const updateSessionCookies = (response: any, source: string) => {
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
    const response = await axios.get(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CAPTCHA}`,
      {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": API_CONFIG.USER_AGENT,
        },
      }
    );

    updateSessionCookies(response, "captcha");

    const base64Image = Buffer.from(response.data).toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    return { success: true, imageData: dataUrl };
  } catch (error) {
    console.error("Captcha fetch error:", error);
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

    const response = await axios.post(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`,
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": API_CONFIG.USER_AGENT,
          ...(cookieHeader && { Cookie: cookieHeader }),
        },
        maxRedirects: 0,
        validateStatus: () => true,
        responseType: 'arraybuffer', // Get raw bytes to decode as GBK
      }
    );

    updateSessionCookies(response, "login");

    // Decode GBK response to handle Chinese error messages properly
    const responseText = iconv.decode(Buffer.from(response.data), 'gbk');

    // Check for login failure indicators
    if (responseText.includes("alert(")) {
      const alertMatch = responseText.match(/alert\(['"]([^'"]+)['"]\)/);
      const message = alertMatch ? alertMatch[1] : "Login failed";
      return { success: false, message };
    }

    // If no alert, login was successful - get sessionId from message endpoint
    let sessionId: string | undefined;
    try {
      const messageResponse = await axios.get(
        `${API_CONFIG.BASE_URL}/back/coursePlatform/message.shtml?method=getArticleList`,
        {
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
            'Cookie': cookieHeader,
            'Referer': `${API_CONFIG.BASE_URL}/ve/`,
            'User-Agent': API_CONFIG.USER_AGENT,
            'X-Requested-With': 'XMLHttpRequest',
          },
          validateStatus: () => true,
        }
      );

      if (messageResponse.status === 200 && messageResponse.data) {
        const messageData = typeof messageResponse.data === 'string'
          ? JSON.parse(messageResponse.data)
          : messageResponse.data;
        sessionId = messageData.sessionId;
        console.log('Fetched sessionId during login:', sessionId);
      }
    } catch (error) {
      console.warn('Failed to fetch sessionId during login:', error);
    }

    // Store credentials and sessionId for future authentication
    currentSession = {
      username: credentials.username,
      passwordHash: credentials.password,
      sessionId
    };

    const requestIdMatch = responseText.match(/var requestId = '([^']+)'/);
    const requestId = requestIdMatch ? requestIdMatch[1] : "";

    return { success: true, requestId };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, message: "Network error during login" };
  }
};

export const handleStoreCredentials = async (credentials: {
  username: string;
  password: string;
}): Promise<boolean> => {
  try {
    const credentialsPath = getCredentialsPath();
    // Password is already MD5 hashed by the renderer
    const data = {
      username: credentials.username,
      passwordHash: credentials.password, // Already hashed
      savedAt: new Date().toISOString(),
    };

    await fs.promises.writeFile(credentialsPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Failed to store credentials:", error);
    return false;
  }
};

export const handleGetStoredCredentials = async (): Promise<{
  username: string;
  password: string;
} | null> => {
  try {
    const credentialsPath = getCredentialsPath();
    const data = await fs.promises.readFile(credentialsPath, "utf8");
    const credentials = JSON.parse(data);

    return {
      username: credentials.username,
      password: credentials.passwordHash,
    };
  } catch (error) {
    return null;
  }
};

export const handleIsLoggedIn = async (): Promise<boolean> => {
  return currentSession !== null && captchaSession !== null;
};

export const handleLogout = async (): Promise<void> => {
  currentSession = null;
  captchaSession = null;
};
