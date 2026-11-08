import { useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api/authApi.js';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Khởi tạo phiên làm việc ban đầu bằng cách kiểm tra token hiện tại
  const initAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const meRes = await authApi.getMe();
      if (meRes.success && meRes.data) {
        setCurrentUser(meRes.data);
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const logout = useCallback(() => {
    authApi.logout();
    setCurrentUser(null);
  }, []);

  return {
    currentUser,
    setCurrentUser,
    role: currentUser?.role || null,
    isAuthenticated: !!currentUser,
    isLoading,
    error,
    logout,
    refreshUser: initAuth
  };
}
