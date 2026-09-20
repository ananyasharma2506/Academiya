import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useOSStore } from '../os/store/useOSStore';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isCheckingSession: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: 'teacher' | 'student') => Promise<void>;
  logout: () => Promise<void>;
  verifySession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to get token from tab session storage first (tab-scoped) or localStorage fallback
function getInitialToken(): string | null {
  return sessionStorage.getItem('akademiya_token') || localStorage.getItem('akademiya_token') || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getInitialToken);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const previousUserIdRef = useRef<string | null>(null);

  // ── Session Verification against Credential & Session DB ──
  const verifySession = useCallback(async (): Promise<boolean> => {
    const activeToken = sessionStorage.getItem('akademiya_token') || localStorage.getItem('akademiya_token');
    if (!activeToken) {
      setUser(null);
      setToken(null);
      setIsCheckingSession(false);
      return false;
    }

    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${activeToken}`;
      const res = await axios.get('/api/auth/session/verify');
      if (res.data?.valid && res.data?.user) {
        setUser(res.data.user);
        setToken(activeToken);
        setIsCheckingSession(false);
        return true;
      } else {
        throw new Error('Invalid session response');
      }
    } catch {
      // Session revoked or expired
      sessionStorage.removeItem('akademiya_token');
      localStorage.removeItem('akademiya_token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setToken(null);
      useOSStore.getState().closeAll();
      setIsCheckingSession(false);
      return false;
    }
  }, []);

  // ── Global Axios 401 Interceptor: Revoke Session on Any Invalid/Expired 401 ──
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          const errorCode = error.response?.data?.code;
          if (errorCode === 'SESSION_INVALID' || errorCode === 'SESSION_EXPIRED' || errorCode === 'NO_TOKEN') {
            sessionStorage.removeItem('akademiya_token');
            localStorage.removeItem('akademiya_token');
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
            setToken(null);
            useOSStore.getState().closeAll();
            window.history.replaceState({ screen: 'lock' }, '', '/');
            window.history.pushState({ screen: 'lock' }, '', '/');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // ── Initial Verification & Lifecycle Hooks ──
  useEffect(() => {
    verifySession();

    // Clean up windows on tab close / unload
    const handleBeforeUnload = () => {
      useOSStore.getState().closeAll();
    };

    // Back-navigation prevention & bfcache (back/forward cache) restoration
    const handlePageShow = (event: PageTransitionEvent) => {
      // If page was restored from browser cache or back button was pressed
      if (event.persisted) {
        verifySession();
      }
    };

    const handlePopState = () => {
      // If navigating back and user is unauthenticated or session invalid, lock out
      const currentToken = sessionStorage.getItem('akademiya_token');
      if (!currentToken) {
        useOSStore.getState().closeAll();
        setUser(null);
        setToken(null);
        window.history.pushState({ screen: 'lock' }, '', '/');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [verifySession]);

  // ── Auto-close all windows whenever user switches (student -> teacher, teacher -> teacher, etc.) ──
  useEffect(() => {
    if (user?.id) {
      if (previousUserIdRef.current && previousUserIdRef.current !== user.id) {
        // User switched! Close all windows immediately
        useOSStore.getState().closeAll();
      }
      previousUserIdRef.current = user.id;
    } else {
      previousUserIdRef.current = null;
    }
  }, [user?.id]);

  // ── Login ──
  const login = async (email: string, password: string) => {
    // Close all open windows before new login
    useOSStore.getState().closeAll();

    const res = await axios.post('/api/auth/login', { email, password });
    const { user: loggedUser, token: authToken } = res.data;

    // Use sessionStorage so session closes when tab closes
    sessionStorage.setItem('akademiya_token', authToken);
    localStorage.setItem('akademiya_token', authToken); // backup
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    setToken(authToken);
    setUser(loggedUser);

    // Push new history state for dashboard
    window.history.pushState({ screen: 'dashboard', user: loggedUser.id }, '', '/dashboard');
  };

  // ── Register ──
  const register = async (name: string, email: string, password: string, role: 'teacher' | 'student') => {
    // Close all open windows before new registration
    useOSStore.getState().closeAll();

    const res = await axios.post('/api/auth/register', { name, email, password, role });
    const { user: registeredUser, token: authToken } = res.data;

    sessionStorage.setItem('akademiya_token', authToken);
    localStorage.setItem('akademiya_token', authToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    setToken(authToken);
    setUser(registeredUser);

    window.history.pushState({ screen: 'dashboard', user: registeredUser.id }, '', '/dashboard');
  };

  // ── Logout: Invalidate in DB, Close All Windows, Prevent Back-Nav ──
  const logout = async () => {
    const currentToken = token || sessionStorage.getItem('akademiya_token');

    // 1. Invalidate session in DB on the backend
    if (currentToken) {
      try {
        await axios.post(
          '/api/auth/logout',
          {},
          { headers: { Authorization: `Bearer ${currentToken}` } }
        );
      } catch {
        // Continue client logout even if backend failed
      }
    }

    // 2. Close all windows across the whole OS
    useOSStore.getState().closeAll();

    // 3. Wipe token from storage
    sessionStorage.removeItem('akademiya_token');
    localStorage.removeItem('akademiya_token');
    delete axios.defaults.headers.common['Authorization'];

    // 4. Reset React states
    setToken(null);
    setUser(null);

    // 5. Replace and push history state to lock screen so browser BACK cannot restore dashboard
    window.history.replaceState({ screen: 'lock' }, '', '/');
    window.history.pushState({ screen: 'lock' }, '', '/');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isCheckingSession,
        login,
        register,
        logout,
        verifySession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

