import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";

interface User {
  id: string;
  email: string;
  role: string;
  isArcc?: boolean;
  isDean?: boolean;
  isDeptChair?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
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

  // Resolve role flags the login response doesn't carry (isArcc, isDeptChair)
  // once per login; they persist in localStorage until logout.
  useEffect(() => {
    if (!token || !user?.id) return;
    if (user.isArcc !== undefined && user.isDeptChair !== undefined) return;

    let cancelled = false;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get("http://localhost:5000/api/admin/arcc", { headers }),
      axios.get("http://localhost:5000/api/admin/checkDeptChair/", { headers }),
    ])
      .then(([arcc, chair]) => {
        if (cancelled) return;
        setUser((current) => {
          if (!current) return current;
          const updated = {
            ...current,
            isArcc: arcc.data.memberIds?.includes(current.id) || false,
            isDeptChair: Boolean(chair.data.isChair),
          };
          localStorage.setItem("user", JSON.stringify(updated));
          return updated;
        });
      })
      .catch((error) => {
        console.error("Failed to resolve role flags:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.id, user?.isArcc, user?.isDeptChair]);

  const login = (userData: User, jwt: string) => {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", jwt);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
