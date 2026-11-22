import { useState, useEffect, useCallback, createContext, useContext } from "react";
import apiClient from "../services/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children, showToast }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupCode, setSetupCode] = useState(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getCurrentUser();
      if (data && data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn("Unable to check authentication status:", err.message);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle URL query parameters after GitHub OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get("auth_success");
    const authError = params.get("auth_error");
    const setup = params.get("setup");
    const requestedSetupCode = params.get("setup_code");

    if (setup === "required") {
      setSetupRequired(true);
      setSetupCode(requestedSetupCode || "LIBRARY_SETUP_REQUIRED");
    }

    if (authSuccess || authError || params.has("setup") || params.has("setup_code")) {
      params.delete("auth_success");
      params.delete("auth_error");
      params.delete("setup");
      params.delete("setup_code");
      const cleanUrl =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : "") +
        window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    if (authSuccess) {
      fetchCurrentUser().then(() => {
        if (showToast) showToast("Signed in with GitHub successfully!", "success");
      });
      return;
    }

    if (authError) {
      setError(authError);
      if (showToast) showToast(`Sign in error: ${authError}`, "error");
      setIsLoading(false);
      return;
    }

    fetchCurrentUser();
  }, [fetchCurrentUser, showToast]);

  const clearSetupNotice = useCallback(() => {
    setSetupRequired(false);
    setSetupCode(null);
  }, []);

  const login = useCallback(() => {
    window.location.href = apiClient.getLoginUrl();
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await apiClient.logout();
      setUser(null);
      if (showToast) showToast("Signed out successfully", "success");
    } catch (err) {
      console.error("Logout failed:", err.message);
      if (showToast) showToast("Failed to sign out", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    setupRequired,
    setupCode,
    clearSetupNotice,
    login,
    logout,
    refresh: fetchCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default useAuth;
