import { contextBridge, ipcRenderer } from 'electron';
import { LoginCredentials, LoginResponse } from '../shared/types';

export interface ElectronAPI {
  getCourses: () => Promise<any[]>;
  getHomework: (courseId: string) => Promise<any[]>;
  downloadDocument: (documentUrl: string) => Promise<{ success: boolean }>;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  isLoggedIn: () => Promise<boolean>;
  storeCredentials: (credentials: { username: string; password: string }) => Promise<void>;
  getStoredCredentials: () => Promise<{ username?: string; password?: string } | null>;
  clearStoredCredentials: () => Promise<void>;
}

const electronAPI: ElectronAPI = {
  getCourses: () => ipcRenderer.invoke('get-courses'),
  getHomework: (courseId: string) => ipcRenderer.invoke('get-homework', courseId),
  downloadDocument: (documentUrl: string) => ipcRenderer.invoke('download-document', documentUrl),
  login: (credentials: LoginCredentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  isLoggedIn: () => ipcRenderer.invoke('is-logged-in'),
  storeCredentials: (credentials) => ipcRenderer.invoke('store-credentials', credentials),
  getStoredCredentials: () => ipcRenderer.invoke('get-stored-credentials'),
  clearStoredCredentials: () => ipcRenderer.invoke('clear-stored-credentials'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);