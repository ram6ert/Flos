import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import CryptoJS from "crypto-js";
import {
  Button,
  Input,
  Checkbox,
  FormGroup,
  ErrorDisplay,
} from "./common/StyledComponents";
interface LoginCredentials {
  username: string;
  password: string;
  passcode: string;
}

interface UserSession {
  username: string;
  requestId: string;
  isLoggedIn: boolean;
  loginTime: Date;
}

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passcode, setPasscode] = useState("");
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [isPasswordHashed, setIsPasswordHashed] = useState(false); // Track if password is already hashed

  useEffect(() => {
    loadCaptcha();
    loadSavedCredentials();
  }, []);

  // Auto-fill password with default pattern when username field loses focus
  const handleUsernameBlur = () => {
    if (username.trim() && !password) {
      const defaultPassword = `Bjtu@${username.trim()}`;
      setPassword(defaultPassword);
      setIsPasswordHashed(false);
    }
  };

  const loadCaptcha = async () => {
    try {
      const result = await window.electronAPI.fetchCaptcha();
      if (result.success && result.imageData) {
        setCaptchaUrl(result.imageData);
      }
    } catch (error) {
      console.error("Failed to fetch captcha:", error);
    }
  };

  const loadSavedCredentials = async () => {
    try {
      const saved = await window.electronAPI.getStoredCredentials();
      if (saved) {
        setUsername(saved.username || "");
        setPassword(saved.password || ""); // This is already MD5 hashed
        setIsPasswordHashed(true); // Mark that this password is already hashed
        setRememberCredentials(true);
      }
    } catch (error) {
      console.log("No saved credentials found");
    }
  };

  const hashPassword = (plainPassword: string): string => {
    return CryptoJS.MD5(plainPassword).toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const credentials: LoginCredentials = {
        username: username.trim(),
        password: isPasswordHashed ? password : hashPassword(password),
        passcode: passcode.trim(),
      };

      const response = await window.electronAPI.login(credentials);

      if (response.success) {
        if (rememberCredentials) {
          // Always store the password that will be sent to the server (hashed)
          const passwordToStore = isPasswordHashed
            ? password
            : hashPassword(password);

          await window.electronAPI.storeCredentials({
            username: username.trim(),
            password: passwordToStore,
            // JSESSIONID will be automatically extracted from captchaSession in the main process
          });
        }

        // Get the session from main thread after successful login
        const currentSession = await window.electronAPI.getCurrentSession();
        const session: UserSession = {
          username: currentSession?.username || username.trim(),
          requestId: currentSession?.sessionId || response.requestId || "",
          isLoggedIn: true,
          loginTime: currentSession?.loginTime
            ? new Date(currentSession.loginTime)
            : new Date(),
        };

        onLoginSuccess(session);
      } else {
        setError(
          response.message || "Login failed. Please check your credentials."
        );
        loadCaptcha(); // Refresh captcha on failed login
        setPasscode(""); // Clear passcode
      }
    } catch (error) {
      setError("Network error. Please check your connection and try again.");
      loadCaptcha();
      setPasscode("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-96 max-w-sm mx-4">
        <h2 className="text-center mb-6 text-2xl font-bold text-gray-800">
          BAKA Course Platform
        </h2>
        <p className="text-center text-gray-600 mb-8">
          Sign in to access your courses
        </p>

        {error && <ErrorDisplay message={error} title={t("loginFailed")} />}

        <form onSubmit={handleSubmit}>
          <FormGroup label={t("username")}>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={handleUsernameBlur}
              required
              placeholder={t("enterStudentId")}
            />
          </FormGroup>

          <FormGroup label={t("password")}>
            <div className="flex gap-2 items-center">
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setIsPasswordHashed(false);
                }}
                required
                placeholder={t("enterPassword")}
              />
              <Button
                type="button"
                onClick={() => {
                  setPassword("");
                  setIsPasswordHashed(false);
                }}
                variant="secondary"
                size="sm"
              >
                ✕
              </Button>
            </div>
          </FormGroup>

          <FormGroup label={t("verificationCode")}>
            <div className="flex gap-2 items-center">
              <Input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                placeholder={t("enterCaptcha")}
              />
              <div className="relative">
                <img
                  src={captchaUrl}
                  alt="Captcha"
                  className="h-10 border border-gray-300 rounded-md cursor-pointer"
                  onClick={loadCaptcha}
                  title={t("clickToRefresh")}
                />
              </div>
            </div>
            <small className="text-gray-600 text-xs mt-1 block">
              Click the image to refresh captcha
            </small>
          </FormGroup>

          <div className="mb-6">
            <label className="flex items-center cursor-pointer">
              <Checkbox
                checked={rememberCredentials}
                onChange={(e) => setRememberCredentials(e.target.checked)}
                className="mr-2"
              />
              <span className="text-gray-700">Remember my credentials</span>
            </label>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {isLoading ? t("signingIn") : t("loginButton")}
          </Button>
        </form>

        <div className="text-center mt-4 text-sm text-gray-600">
          <p>Having trouble? Check your network connection.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
