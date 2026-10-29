import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  seedRoles,
  seedUsers,
  type Action,
  type Module,
  type Permissions,
} from "../types/access";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roleName: string;
  isAdmin: boolean;
  permissions: Permissions;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (module: Module, action?: Action) => boolean;
}

const STORAGE_KEY = "hms_auth_user";

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);

  const login = useCallback(async (email: string, password: string) => {
    // MOCK LOGIN (development only): matches a seeded user by email and accepts
    // any non-empty password. Replace this body with a real call to your backend
    // (POST /auth/login) that returns the user, role permissions and a JWT.
    await new Promise((r) => setTimeout(r, 400));

    const found = seedUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!found || !password) throw new Error("Invalid email or password.");
    if (!found.active) throw new Error("This account has been deactivated.");

    const role = seedRoles.find((r) => r.id === found.roleId);
    if (!role) throw new Error("Account has no valid role.");

    const authUser: AuthUser = {
      id: found.id,
      name: found.name,
      email: found.email,
      roleName: role.name,
      isAdmin: role.id === "r-admin",
      permissions: role.permissions,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    } catch {
      /* storage unavailable: session lasts until reload */
    }
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const can = useCallback(
    (module: Module, action: Action = "view") =>
      !!user && (user.isAdmin || !!user.permissions[module]?.[action]),
    [user]
  );

  const value = useMemo(() => ({ user, login, logout, can }), [user, login, logout, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}