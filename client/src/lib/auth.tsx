import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";

interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "staff" | "viewer";
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  onboardingStatus?: string;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  isLoading: boolean;
  isPlatformAdmin: boolean;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setAuthFromToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "counseltech_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      setToken(storedToken);
      fetchMe(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  async function fetchMe(authToken: string) {
    try {
      const res = await fetch("/v1/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setOrganization(data.organization);
        setIsPlatformAdmin(data.isPlatformAdmin || false);
        setIsImpersonating(data.isImpersonating || false);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await fetch("/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Login failed");
    }

    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    setOrganization(data.organization);
    
    if (data.organization?.onboardingStatus !== "complete") {
      setLocation("/setup");
    } else {
      setLocation("/leads");
    }
  }

  async function setAuthFromToken(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    await fetchMe(newToken);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setOrganization(null);
    setIsPlatformAdmin(false);
    setIsImpersonating(false);
    setLocation("/login");
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      organization, 
      token, 
      isLoading, 
      isPlatformAdmin, 
      isImpersonating, 
      login, 
      logout,
      setAuthFromToken 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
