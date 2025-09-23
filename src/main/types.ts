export interface LoginCredentials {
  username: string;
  password: string;
  passcode: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  requestId?: string;
}

export interface UserSession {
  username: string;
  requestId: string;
  isLoggedIn: boolean;
  loginTime: Date;
}
