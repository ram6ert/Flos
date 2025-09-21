import { app, BrowserWindow, Menu, ipcMain, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import axios from 'axios';
import { LoginCredentials, LoginResponse } from './types';
import { API_CONFIG } from './constants';

const isDev = process.env.NODE_ENV === 'development';

// Session management - store credentials for re-authentication
let currentSession: {
  username: string;
  passwordHash: string;
} | null = null;

// Captcha session management
// JSESSIONID: Backend session cookie that maintains authenticated state with the server
let captchaSession: {
  jsessionId: string; // The value extracted from JSESSIONID cookie
  cookies: string[];  // All session cookies from the server
} | null = null;

// Configure axios defaults
axios.defaults.headers.common['User-Agent'] = API_CONFIG.USER_AGENT;
axios.defaults.timeout = API_CONFIG.TIMEOUT;

// File paths for storing credentials
const getCredentialsPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'credentials.json');
};

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  if (process.platform === 'darwin') {
    const template = [
      {
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'File',
        submenu: [
          { role: 'close' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectall' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template as any));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Helper functions for session management
// Extracts JSESSIONID value from Set-Cookie headers
// JSESSIONID is a standard Java web application session cookie
const extractJSessionIdFromCookies = (cookies: string[]): string => {
  for (const cookie of cookies) {
    const match = cookie.match(/JSESSIONID=([^;]+)/);
    if (match) return match[1];
  }
  return '';
};

const parseCookies = (setCookieHeaders: string[]): string[] => {
  return setCookieHeaders.map(cookie => cookie.split(';')[0]);
};

// Helper function to update session cookies from any response
// Updates the stored JSESSIONID and cookies when server sends new session data
const updateSessionCookies = (response: any, source: string) => {
  const setCookieHeaders = response.headers['set-cookie'] || [];
  if (setCookieHeaders.length > 0) {
    const cookies = parseCookies(setCookieHeaders);
    const jsessionId = extractJSessionIdFromCookies(cookies);

    if (jsessionId) {
      const oldJSessionId = captchaSession?.jsessionId;
      captchaSession = {
        jsessionId,
        cookies
      };

      console.log(`Updated session cookies from ${source}:`, {
        oldJSessionId,
        newJSessionId: jsessionId,
        cookies: cookies
      });
    }
  }
};

// IPC handlers for captcha and authentication
ipcMain.handle('fetch-captcha', async (): Promise<{ success: boolean; requestId?: string; imageData?: string }> => {
  try {
    const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CAPTCHA}`, {
      headers: {
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7,en-GB;q=0.6,en-US;q=0.5',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Referer': `${API_CONFIG.BASE_URL}/ve/`,
        'User-Agent': API_CONFIG.USER_AGENT
      },
      responseType: 'arraybuffer',
      validateStatus: () => true
    });

    // Extract session info from cookies
    const setCookieHeaders = response.headers['set-cookie'] || [];

    if (setCookieHeaders.length > 0) {
      const cookies = parseCookies(setCookieHeaders);
      const jsessionId = extractJSessionIdFromCookies(cookies);

      if (jsessionId) {
        captchaSession = {
          jsessionId,
          cookies
        };

        // Convert image data to base64
        const imageBuffer = Buffer.from(response.data);
        const base64Image = imageBuffer.toString('base64');
        const imageData = `data:image/jpeg;base64,${base64Image}`;

        return {
          success: true,
          requestId: jsessionId,
          imageData
        };
      }
    }

    return { success: false };
  } catch (error) {
    console.error('Captcha fetch error:', error);
    return { success: false };
  }
});

ipcMain.handle('login', async (event, credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    const formData = new URLSearchParams();
    formData.append('login', 'main_2');
    formData.append('qxkt_type', '');
    formData.append('qxkt_url', '');
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    formData.append('passcode', credentials.passcode);

    // Use captcha session cookies if available
    const cookieHeader = captchaSession ? captchaSession.cookies.join('; ') : '';

    const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, formData, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7,en-GB;q=0.6,en-US;q=0.5',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieHeader,
        'Origin': API_CONFIG.BASE_URL,
        'Referer': `${API_CONFIG.BASE_URL}/ve/`,
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': API_CONFIG.USER_AGENT
      },
      validateStatus: () => true // Accept all status codes
    });

    // Check if login failed by looking for alert in response
    if (response.data && response.data.includes('alert(')) {
      return {
        success: false,
        message: 'Invalid username, password, or verification code. Please try again.'
      };
    }

    // If no alert, login was successful - store credentials for future authentication
    currentSession = {
      username: credentials.username,
      passwordHash: credentials.password
    };

    // Load user-specific cache
    loadCacheFromFile(credentials.username);

    // Update session cookies from login response
    updateSessionCookies(response, 'login');

    return {
      success: true,
      message: 'Login successful'
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection.'
    };
  }
});

ipcMain.handle('logout', async () => {
  // Save current user's cache before logout
  if (currentSession) {
    saveCacheToFile(currentSession.username);
  }

  // Clear current session and in-memory cache
  currentSession = null;
  homeworkCache = {};
  cacheTimestamps = {};
});

ipcMain.handle('is-logged-in', async () => {
  return currentSession !== null;
});

// Credential storage handlers
ipcMain.handle('store-credentials', async (event, credentials: { username: string; password: string }) => {
  try {
    const credentialsPath = getCredentialsPath();
    const data = {
      username: credentials.username,
      password: credentials.password, // In a real app, this should be encrypted
      savedAt: new Date().toISOString()
    };

    await fs.promises.writeFile(credentialsPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error storing credentials:', error);
  }
});

ipcMain.handle('get-stored-credentials', async () => {
  try {
    const credentialsPath = getCredentialsPath();
    const data = await fs.promises.readFile(credentialsPath, 'utf8');
    const credentials = JSON.parse(data);
    return {
      username: credentials.username,
      password: credentials.password
    };
  } catch (error) {
    return null;
  }
});

ipcMain.handle('clear-stored-credentials', async () => {
  try {
    const credentialsPath = getCredentialsPath();
    await fs.promises.unlink(credentialsPath);
  } catch (error) {
    // File doesn't exist, which is fine
  }
});

// Rate limiting and caching
let homeworkCache: { [key: string]: any } = {};
let cacheTimestamps: { [key: string]: number } = {};
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day for homework
const COURSE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days for courses

// File-based persistent cache with user separation
const getCachePath = (username?: string) => {
  const userDataPath = app.getPath('userData');
  if (username) {
    // Create user-specific cache file
    return path.join(userDataPath, `cache-${username}.json`);
  }
  // Fallback to generic cache file
  return path.join(userDataPath, 'homework-cache.json');
};

// Load cache from file for specific user
const loadCacheFromFile = (username?: string) => {
  try {
    const cachePath = getCachePath(username);
    const data = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(data);
    homeworkCache = parsed.cache || {};
    cacheTimestamps = parsed.timestamps || {};
  } catch (error) {
    // Cache file doesn't exist or is invalid, start with empty cache
    homeworkCache = {};
    cacheTimestamps = {};
  }
};

// Save cache to file for specific user
const saveCacheToFile = (username?: string) => {
  try {
    const cachePath = getCachePath(username);
    const data = {
      cache: homeworkCache,
      timestamps: cacheTimestamps
    };
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save cache to file:', error);
  }
};

// Initialize cache on startup
loadCacheFromFile();

// Rate limiting queue
class RateLimitedQueue {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;
  private maxConcurrency = 2;

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const task = this.queue.shift()!;

    try {
      await task();
    } finally {
      this.running--;
      // Add random delay between 50-1000ms
      const delay = Math.floor(Math.random() * 951) + 50;
      setTimeout(() => this.process(), delay);
    }
  }
}

const requestQueue = new RateLimitedQueue();

// Helper function for authenticated requests
async function authenticatedRequest(url: string): Promise<any> {
  if (!currentSession) {
    throw new Error('Not logged in');
  }

  // Get fresh session by re-fetching captcha and using current credentials
  let activeSession = captchaSession;

  // If no active session, try to get one
  if (!activeSession) {
    // Fetch fresh captcha to get session
    const captchaResponse = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CAPTCHA}`, {
      headers: {
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7,en-GB;q=0.6,en-US;q=0.5',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Referer': `${API_CONFIG.BASE_URL}/ve/`,
        'User-Agent': API_CONFIG.USER_AGENT
      },
      responseType: 'arraybuffer',
      validateStatus: () => true
    });

    const setCookieHeaders = captchaResponse.headers['set-cookie'] || [];
    if (setCookieHeaders.length > 0) {
      const cookies = parseCookies(setCookieHeaders);
      const jsessionId = extractJSessionIdFromCookies(cookies);

      if (jsessionId) {
        activeSession = { jsessionId, cookies };
        captchaSession = activeSession;
      }
    }
  }

  // Use the session cookies for the actual request
  const cookieHeader = activeSession ? activeSession.cookies.join('; ') : '';

  // Prepare headers
  const headers: any = {
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    'Cookie': cookieHeader,
    'Referer': `${API_CONFIG.BASE_URL}/ve/`,
    'User-Agent': API_CONFIG.USER_AGENT,
    'X-Requested-With': 'XMLHttpRequest'
  };

  // Add Sessionid header for specific API endpoints that require it
  // Sessionid: Custom header required by specific API endpoints (different from JSESSIONID cookie)
  // This is a static identifier that the backend expects for certain operations
  if (url.includes('getCourseList')) {
    headers['Sessionid'] = API_CONFIG.SESSION_IDS.GET_COURSE_LIST;
  } else if (url.includes('homeWork.shtml')) {
    headers['Sessionid'] = API_CONFIG.SESSION_IDS.GET_HOMEWORK_LIST;
  }

  const response = await axios.get(url, {
    headers,
    validateStatus: () => true
  });

  if (response.status >= 200 && response.status < 400) {
    // Always update session cookies from successful responses
    updateSessionCookies(response, 'authenticated-request');

    // Check for session expiration indicators
    if (typeof response.data === 'string') {
      if (response.data.includes('您还未登录') ||
          response.data.includes('请登录') ||
          response.data.includes('login') ||
          response.data.includes('<title>登录</title>')) {
        // Clear current session and captcha session
        currentSession = null;
        captchaSession = null;
        throw new Error('Session expired or not logged in');
      }
    }

    // Try to parse as JSON if it's expected to be JSON
    if (typeof response.data === 'string' && response.data.trim().startsWith('{')) {
      try {
        return JSON.parse(response.data);
      } catch (parseError) {
        console.warn('Failed to parse JSON response, treating as string:', response.data.substring(0, 200));
        // If JSON parsing fails but we got a response, it might indicate session issues
        if (response.data.includes('html') || response.data.includes('<!DOCTYPE')) {
          currentSession = null;
          captchaSession = null;
          throw new Error('Received HTML response instead of JSON - session likely expired');
        }
        return response.data;
      }
    }

    return response.data;
  }

  throw new Error(`Request failed with status: ${response.status}`);
}

// Course platform API handlers
ipcMain.handle('get-semester-info', async () => {
  if (!currentSession) {
    throw new Error('Not logged in');
  }

  return requestQueue.add(async () => {
    const url = `${API_CONFIG.BASE_URL}/back/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
    const data = await authenticatedRequest(url);

    if (data.result && data.result.length > 0) {
      return data.result[0].xqCode;
    }
    throw new Error('Failed to get semester info');
  });
});

// Background refresh function
async function refreshCacheInBackground(cacheKey: string, refreshFunction: () => Promise<any>) {
  try {
    const freshData = await refreshFunction();
    homeworkCache[cacheKey] = freshData;
    cacheTimestamps[cacheKey] = Date.now();
    saveCacheToFile(currentSession?.username);

    // Notify renderer of updated data
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach(window => {
      window.webContents.send('cache-updated', { key: cacheKey, data: freshData });
    });
  } catch (error) {
    console.error(`Background refresh failed for ${cacheKey}:`, error);
  }
}

ipcMain.handle('get-courses', async (event, options?: { skipCache?: boolean }) => {
  if (!currentSession) {
    throw new Error('Not logged in');
  }

  const cacheKey = 'courses';
  const now = Date.now();
  const cacheAge = now - (cacheTimestamps[cacheKey] || 0);

  // If skipCache is requested, fetch fresh data immediately
  if (options?.skipCache) {
    return requestQueue.add(async () => {
      const courseList = await fetchCourseList();
      // Update cache with fresh data
      homeworkCache[cacheKey] = courseList;
      cacheTimestamps[cacheKey] = now;
      saveCacheToFile(currentSession?.username);
      return { data: courseList, fromCache: false, age: 0 };
    });
  }

  // Always return cached data immediately if available
  const cachedData = homeworkCache[cacheKey];

  // Start background refresh if cache is stale or doesn't exist
  if (!cachedData || cacheAge > COURSE_CACHE_DURATION) {
    refreshCacheInBackground(cacheKey, async () => {
      return requestQueue.add(async () => {
        return await fetchCourseList();
      });
    });
  }

  // Return cached data if available, otherwise wait for fresh data
  if (cachedData) {
    return { data: cachedData, fromCache: true, age: cacheAge };
  } else {
    // No cache, wait for fresh data
    return requestQueue.add(async () => {
      const courseList = await fetchCourseList();
      homeworkCache[cacheKey] = courseList;
      cacheTimestamps[cacheKey] = Date.now();
      saveCacheToFile(currentSession?.username);
      return { data: courseList, fromCache: false, age: 0 };
    });
  }
});

ipcMain.handle('get-homework', async (event, courseId?: string, options?: { skipCache?: boolean }) => {
  if (!currentSession) {
    throw new Error('Not logged in');
  }

  const cacheKey = courseId ? `homework_${courseId}` : 'all_homework';
  const now = Date.now();

  // If skipCache is requested, fetch fresh data immediately
  if (options?.skipCache) {
    return requestQueue.add(async () => {
      const data = await fetchHomeworkData(courseId);
      // Update cache with fresh data
      homeworkCache[cacheKey] = data;
      cacheTimestamps[cacheKey] = now;
      saveCacheToFile(currentSession?.username);
      return { data, fromCache: false, age: 0 };
    });
  }

  const cacheAge = now - (cacheTimestamps[cacheKey] || 0);

  // Return cached data if available and start background refresh if stale
  if (homeworkCache[cacheKey]) {
    if (cacheAge > CACHE_DURATION) {
      // Start background refresh
      refreshCacheInBackground(cacheKey, async () => {
        return await requestQueue.add(async () => {
          // Implementation will be the same as below
          return await fetchHomeworkData(courseId);
        });
      });
    }
    return { data: homeworkCache[cacheKey], fromCache: true, age: cacheAge };
  }

  // No cache, fetch fresh data
  return requestQueue.add(async () => {
    const data = await fetchHomeworkData(courseId);
    homeworkCache[cacheKey] = data;
    cacheTimestamps[cacheKey] = now;
    saveCacheToFile(currentSession?.username);
    return { data, fromCache: false, age: 0 };
  });
});

// Helper function to fetch course list with proper semester code
async function fetchCourseList() {
  // First get semester info
  const semesterUrl = `${API_CONFIG.BASE_URL}/back/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
  const semesterData = await authenticatedRequest(semesterUrl);

  if (!semesterData.result || semesterData.result.length === 0) {
    throw new Error('Failed to get semester info');
  }

  const xqCode = semesterData.result[0].xqCode;
  const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/course.shtml?method=getCourseList&pagesize=100&page=1&xqCode=${xqCode}`;
  const data = await authenticatedRequest(url);

  if (data.courseList) {
    return data.courseList;
  }
  throw new Error('Failed to get course list');
}

// Helper function to fetch homework data
async function fetchHomeworkData(courseId?: string) {
  if (courseId) {
    // Get homework for specific course
    const homeworkTypes = [
      { subType: 0, name: "普通作业" },
      { subType: 1, name: "课程报告" },
      { subType: 2, name: "实验作业" }
    ];

    const allHomework = [];
    for (const type of homeworkTypes) {
      const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${courseId}&subType=${type.subType}&page=1&pagesize=100`;

      try {
        const data = await authenticatedRequest(url);
        if (data.courseNoteList && data.courseNoteList.length > 0) {
          const homework = data.courseNoteList.map((hw: any) => ({
            ...hw,
            homeworkType: type.name
          }));
          allHomework.push(...homework);
        }
      } catch (error) {
        console.error(`Failed to get ${type.name} for course ${courseId}:`, error);
      }

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 951) + 50));
    }

    return allHomework;
  } else {
    // Get all homework for all courses
    // Try to get course list from cache first, then fetch if needed
    let courseList = homeworkCache['courses'];
    const courseCacheAge = Date.now() - (cacheTimestamps['courses'] || 0);

    if (!courseList || courseCacheAge > COURSE_CACHE_DURATION) {
      console.log('Fetching fresh course list for homework');
      courseList = await fetchCourseList();
      // Update course cache
      homeworkCache['courses'] = courseList;
      cacheTimestamps['courses'] = Date.now();
      saveCacheToFile(currentSession?.username);
    } else {
      console.log(`Using cached course list (${Math.floor(courseCacheAge / (1000 * 60))} minutes old)`);
    }

    console.log(`Found ${courseList.length} courses for homework fetching`);

    const allHomework = [];
    for (const course of courseList) {
      // Get homework for this course using the same method as above
      const homeworkTypes = [
        { subType: 0, name: "普通作业" },
        { subType: 1, name: "课程报告" },
        { subType: 2, name: "实验作业" }
      ];

      for (const type of homeworkTypes) {
        const url = `${API_CONFIG.BASE_URL}/back/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${course.id}&subType=${type.subType}&page=1&pagesize=100`;

        try {
          const data = await authenticatedRequest(url);
          if (data.courseNoteList && data.courseNoteList.length > 0) {
            const homework = data.courseNoteList.map((hw: any) => ({
              ...hw,
              courseName: course.name,
              homeworkType: type.name
            }));
            allHomework.push(...homework);
          }
        } catch (error) {
          console.error(`Failed to get ${type.name} for course ${course.name}:`, error);
        }

        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 951) + 50));
      }
    }

    return allHomework;
  }
}

ipcMain.handle('download-document', async (event, documentUrl: string) => {
  if (!currentSession) {
    throw new Error('Not logged in');
  }
  // This will be implemented to handle document downloads
  return { success: true };
});

// Fetch course image as base64 data URL
ipcMain.handle('fetch-course-image', async (event, imagePath: string): Promise<string | null> => {
  if (!currentSession) {
    throw new Error('Not logged in');
  }

  if (!imagePath) {
    return null;
  }

  try {
    // If imagePath starts with /, it's a relative path from the server
    const imageUrl = imagePath.startsWith('/')
      ? `${API_CONFIG.BASE_URL}${imagePath}`
      : imagePath;

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Cookie': captchaSession?.cookies.join('; ') || '',
        'User-Agent': API_CONFIG.USER_AGENT
      },
      timeout: 10000 // 10 second timeout for images
    });

    // Convert to base64 data URL
    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to fetch course image:', error);
    return null;
  }
});