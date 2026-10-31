import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { logAudit } from "../services/audit";
import {
  effectivePermissions,
  hashPassword,
  loadRoles,
  loadUsers,
  saveUsers,
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

  const attemptLogin = useCallback(async (email: string, password: string) => {
    // MOCK LOGIN (development only): matches a seeded user by email and accepts
    // any non-empty password. Replace this body with a real call to your backend
    // (POST /auth/login) that returns the user, role permissions and a JWT.
    await new Promise((r) => setTimeout(r, 400));

    const users = loadUsers();
    const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!found || !password) throw new Error("Invalid email or password.");
    // Users created in the app have a stored hash. The original demo accounts accept any password.
    if (found.passwordHash && found.passwordHash !== (await hashPassword(found.id, password)))
      throw new Error("Invalid email or password.");
    if (!found.active) throw new Error("This account has been deactivated.");

    const roles = loadRoles();
    const role = roles.find((r) => r.id === found.roleId);
    if (!role) throw new Error("Account has no valid role.");

    const authUser: AuthUser = {
      id: found.id,
      name: found.name,
      email: found.email,
      roleName: role.name,
      isAdmin: role.id === "r-admin",
      permissions: effectivePermissions(found, roles),
    };

    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    saveUsers(users.map((u) => (u.id === found.id ? { ...u, lastLogin: stamp } : u)));

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    } catch {
      /* storage unavailable: session lasts until reload */
    }
    setUser(authUser);
    logAudit({
      action: "Sign in",
      module: "Authentication",
      summary: `${authUser.name} signed in`,
      actor: { id: authUser.id, name: authUser.name, role: authUser.roleName },
    });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        await attemptLogin(email, password);
      } catch (err) {
        logAudit({
          action: "Failed sign-in",
          module: "Authentication",
          summary: `Failed sign-in for ${email.trim() || "(blank email)"}`,
          detail: err instanceof Error ? err.message : undefined,
          outcome: "failure",
          actor: { name: email.trim() || "Unknown" },
        });
        throw err;
      }
    },
    [attemptLogin]
  );

  const logout = useCallback(() => {
    logAudit({ action: "Sign out", module: "Authentication", summary: "Signed out" });
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