import { app, BrowserWindow, Menu, ipcMain, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import axios from 'axios';
import { LoginCredentials, LoginResponse } from '../shared/types';
import { API_CONFIG } from '../shared/constants';

const isDev = process.env.NODE_ENV === 'development';

// Session management
let currentSession: {
  username: string;
  sessionId: string;
  cookies: string[];
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
const extractSessionIdFromCookies = (cookies: string[]): string => {
  for (const cookie of cookies) {
    const match = cookie.match(/JSESSIONID=([^;]+)/);
    if (match) return match[1];
  }
  return '';
};

const parseCookies = (setCookieHeaders: string[]): string[] => {
  return setCookieHeaders.map(cookie => cookie.split(';')[0]);
};

// IPC handlers for authentication
ipcMain.handle('login', async (event, credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    const formData = new URLSearchParams();
    formData.append('login', 'main_2');
    formData.append('qxkt_type', '');
    formData.append('qxkt_url', '');
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    formData.append('passcode', credentials.passcode);

    const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, formData, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7,en-GB;q=0.6,en-US;q=0.5',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded',
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

    // Extract session info from cookies
    const setCookieHeaders = response.headers['set-cookie'] || [];
    const cookies = parseCookies(setCookieHeaders);
    const sessionId = extractSessionIdFromCookies(cookies);

    if (sessionId) {
      currentSession = {
        username: credentials.username,
        sessionId,
        cookies
      };

      return {
        success: true,
        sessionId,
        message: 'Login successful'
      };
    } else {
      return {
        success: false,
        message: 'Login failed. No session established.'
      };
    }
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection.'
    };
  }
});

ipcMain.handle('logout', async () => {
  currentSession = null;
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

// Course platform API handlers (will be implemented later)
ipcMain.handle('get-courses', async () => {
  if (!currentSession) {
    throw new Error('Not logged in');
  }
  // This will be implemented to fetch course data
  return [];
});

ipcMain.handle('get-homework', async (event, courseId: string) => {
  if (!currentSession) {
    throw new Error('Not logged in');
  }
  // This will be implemented to fetch homework for a specific course
  return [];
});

ipcMain.handle('download-document', async (event, documentUrl: string) => {
  if (!currentSession) {
    throw new Error('Not logged in');
  }
  // This will be implemented to handle document downloads
  return { success: true };
});