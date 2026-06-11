import { createContext, useContext, useState, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  role: string;
  isArcc?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUserArccStatus: (isArcc: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("user");
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      // Corrupt storage should not crash the app; clear both keys so we start
      // fully logged out rather than with a stale token but no user.
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );

  const login = (userData: User, jwt: string) => {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", jwt);
  };

  const updateUserArccStatus = (isArcc: boolean) => {
    if (user) {
      const updatedUser = { ...user, isArcc };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, updateUserArccStatus }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
