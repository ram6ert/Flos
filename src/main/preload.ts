import { contextBridge, ipcRenderer } from 'electron';
import { LoginCredentials, LoginResponse } from './types';

export interface ElectronAPI {
  getCourses: (options?: { skipCache?: boolean }) => Promise<{ data: any[]; fromCache: boolean; age: number }>;
  getHomework: (courseId?: string, options?: { skipCache?: boolean }) => Promise<{ data: any[]; fromCache: boolean; age: number }>;
  getHomeworkDetails: (homeworkId: string, courseId: string, teacherId: string) => Promise<{ data: any; success: boolean }>;
  getCourseDocuments: (courseId: string, options?: { skipCache?: boolean }) => Promise<{ data: any[]; fromCache: boolean; age: number }>;
  refreshCourses: () => Promise<{ data: any[]; fromCache: boolean; age: number }>;
  refreshHomework: (courseId?: string) => Promise<{ data: any[]; fromCache: boolean; age: number }>;
  downloadDocument: (documentUrl: string) => Promise<{ success: boolean }>;
  downloadCourseDocument: (documentUrl: string, fileName: string) => Promise<{ success: boolean; data?: string; contentType?: string; fileName?: string; fileSize?: number; savedToFile?: boolean; filePath?: string; error?: string }>;
  downloadHomeworkAttachment: (attachmentUrl: string, fileName: string) => Promise<{ success: boolean; data?: string; contentType?: string; fileName?: string; fileSize?: number; savedToFile?: boolean; filePath?: string; error?: string }>;
  fetchCourseImage: (imagePath: string) => Promise<string | null>;
  fetchCaptcha: () => Promise<{ success: boolean; requestId?: string; imageData?: string }>;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  isLoggedIn: () => Promise<boolean>;
  storeCredentials: (credentials: { username: string; password: string }) => Promise<void>;
  getStoredCredentials: () => Promise<{ username?: string; password?: string } | null>;
  clearStoredCredentials: () => Promise<void>;
  onCacheUpdate: (callback: (event: any, payload: { key: string; data: any }) => void) => void;
  removeAllListeners: (channel: string) => void;
}

const electronAPI: ElectronAPI = {
  getCourses: (options?: { skipCache?: boolean }) => ipcRenderer.invoke('get-courses', options),
  getHomework: (courseId?: string, options?: { skipCache?: boolean }) => ipcRenderer.invoke('get-homework', courseId, options),
  getHomeworkDetails: (homeworkId: string, courseId: string, teacherId: string) => ipcRenderer.invoke('get-homework-details', homeworkId, courseId, teacherId),
  getCourseDocuments: (courseId: string, options?: { skipCache?: boolean }) => ipcRenderer.invoke('get-course-documents', courseId, options),
  refreshCourses: () => ipcRenderer.invoke('get-courses', { skipCache: true }),
  refreshHomework: (courseId?: string) => ipcRenderer.invoke('get-homework', courseId, { skipCache: true }),
  downloadDocument: (documentUrl: string) => ipcRenderer.invoke('download-document', documentUrl),
  downloadCourseDocument: (documentUrl: string, fileName: string) => ipcRenderer.invoke('download-course-document', documentUrl, fileName),
  downloadHomeworkAttachment: (attachmentUrl: string, fileName: string) => ipcRenderer.invoke('download-homework-attachment', attachmentUrl, fileName),
  fetchCourseImage: (imagePath: string) => ipcRenderer.invoke('fetch-course-image', imagePath),
  fetchCaptcha: () => ipcRenderer.invoke('fetch-captcha'),
  login: (credentials: LoginCredentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  isLoggedIn: () => ipcRenderer.invoke('is-logged-in'),
  storeCredentials: (credentials) => ipcRenderer.invoke('store-credentials', credentials),
  getStoredCredentials: () => ipcRenderer.invoke('get-stored-credentials'),
  clearStoredCredentials: () => ipcRenderer.invoke('clear-stored-credentials'),
  onCacheUpdate: (callback) => ipcRenderer.on('cache-updated', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);