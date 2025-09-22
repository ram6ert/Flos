import React, { useState, useEffect } from "react";
import CryptoJS from "crypto-js";
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
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "2rem",
          borderRadius: "10px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
          width: "400px",
          maxWidth: "90vw",
        }}
      >
        <h2
          style={{ textAlign: "center", marginBottom: "1.5rem", color: "#333" }}
        >
          BAKA Course Platform
        </h2>
        <p style={{ textAlign: "center", color: "#666", marginBottom: "2rem" }}>
          Sign in to access your courses
        </p>

        {error && (
          <div
            style={{
              background: "#fee",
              color: "#c33",
              padding: "0.75rem",
              borderRadius: "5px",
              marginBottom: "1rem",
              border: "1px solid #fcc",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "bold",
              }}
            >
              Username (Student ID)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your student ID"
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "5px",
                fontSize: "1rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "bold",
              }}
            >
              Password
            </label>
            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setIsPasswordHashed(false); // Reset hashed flag when user types new password
                }}
                required
                placeholder="Enter your password"
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "5px",
                  fontSize: "1rem",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setPassword("");
                  setIsPasswordHashed(false);
                }}
                style={{
                  padding: "0.75rem",
                  background: "transparent",
                  color: "#666",
                  border: "1px solid #ddd",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
                title="Clear password"
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "bold",
              }}
            >
              Verification Code
            </label>
            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                placeholder="Enter captcha"
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "5px",
                  fontSize: "1rem",
                }}
              />
              <div style={{ position: "relative" }}>
                <img
                  src={captchaUrl}
                  alt="Captcha"
                  style={{
                    height: "40px",
                    border: "1px solid #ddd",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                  onClick={loadCaptcha}
                  title="Click to refresh"
                />
              </div>
            </div>
            <small style={{ color: "#666", fontSize: "0.8rem" }}>
              Click the image to refresh captcha
            </small>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={rememberCredentials}
                onChange={(e) => setRememberCredentials(e.target.checked)}
                style={{ marginRight: "0.5rem" }}
              />
              Remember my credentials
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: isLoading ? "#ccc" : "#667eea",
              color: "white",
              border: "none",
              borderRadius: "5px",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "background-color 0.2s",
            }}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: "1rem",
            fontSize: "0.9rem",
            color: "#666",
          }}
        >
          <p>Having trouble? Check your network connection.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
