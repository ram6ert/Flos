export interface LoginCredentials {
  username: string;
  password: string;
  passcode: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  sessionId?: string;
}