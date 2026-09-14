import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('expense_jwt_token'));
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('expense_user_info');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    const checkSession = async () => {
      const storedToken = localStorage.getItem('expense_jwt_token');
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }

      try {
        const data = await authService.getMe();
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('expense_user_info', JSON.stringify(data.user));
        } else {
          localStorage.removeItem('expense_jwt_token');
          localStorage.removeItem('expense_user_info');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        // If 401 or invalid, clear token
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('expense_jwt_token');
          localStorage.removeItem('expense_user_info');
          setToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const handleUnauthorized = () => {
      localStorage.removeItem('expense_jwt_token');
      localStorage.removeItem('expense_user_info');
      setToken(null);
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (username, password) => {
    const data = await authService.login(username, password);
    if (data.success) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('expense_jwt_token', data.token);
      localStorage.setItem('expense_user_info', JSON.stringify(data.user));
      return data;
    }
    throw new Error(data.message || 'Login failed');
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      // Ignore logout request network errors
    }
    localStorage.removeItem('expense_jwt_token');
    localStorage.removeItem('expense_user_info');
    sessionStorage.clear();
    setToken(null);
    setUser(null);
  };

  const updateUser = useCallback((updatedUserData) => {
    setUser(prev => {
      const updated = { ...prev, ...updatedUserData };
      localStorage.setItem('expense_user_info', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isAuthenticated: !!token && !!user,
        isAdmin,
        login,
        logout,
        updateUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
