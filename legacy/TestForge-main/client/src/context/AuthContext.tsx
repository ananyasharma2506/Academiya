import { createContext, useContext, useEffect, useState } from 'react';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher';
}

export interface Session {
  access_token: string;
}

interface AuthContextValue {
  session: Session | null;
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = 'testforge.auth';
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: 'Authentication is unavailable' }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const auth = JSON.parse(saved) as { token: string; user: UserProfile };
        if (auth.token && auth.user) {
          setSession({ access_token: auth.token });
          setUser(auth.user);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) return { error: data.error ?? 'Invalid credentials' };

      const profile = data.user as UserProfile;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.token, user: profile }));
      setSession({ access_token: data.token });
      setUser(profile);
      return {};
    } catch {
      return { error: 'Could not reach the learning platform server' };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
