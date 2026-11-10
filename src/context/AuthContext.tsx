import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EMERGENCY_MINUTES, loadGrant, saveGrant, type EmergencyGrant } from "../services/emergency";
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
  /** Time-limited, read-only access to patient records, granted after giving a reason. */
  emergency: EmergencyGrant | null;
  startEmergency: (reason: string) => void;
  endEmergency: (why?: "ended" | "expired") => void;
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
  const [emergency, setEmergency] = useState<EmergencyGrant | null>(() => loadGrant(loadStoredUser()?.id));

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

  const endEmergency = useCallback(
    (why: "ended" | "expired" = "ended") => {
      if (!emergency) return;
      logAudit({ action: "Security", module: "Emergency access", summary: `Emergency access ${why === "expired" ? "expired" : "ended"} for ${user?.name ?? "user"}`, dedupeMs: 0 });
      saveGrant(null);
      setEmergency(null);
    },
    [emergency, user]
  );

  const startEmergency = useCallback(
    (reason: string) => {
      if (!user) return;
      const now = Date.now();
      const grant: EmergencyGrant = { userId: user.id, reason: reason.trim(), startedAt: now, expiresAt: now + EMERGENCY_MINUTES * 60_000 };
      saveGrant(grant);
      setEmergency(grant);
      logAudit({
        action: "Security",
        module: "Emergency access",
        summary: `${user.name} (${user.roleName}) opened patient records in an emergency, read-only for ${EMERGENCY_MINUTES} minutes`,
        detail: `Reason given: ${grant.reason}`,
        dedupeMs: 0,
      });
    },
    [user]
  );

  // The grant switches itself off when its time is up.
  useEffect(() => {
    if (!emergency) return;
    const left = emergency.expiresAt - Date.now();
    const t = window.setTimeout(() => endEmergency("expired"), Math.max(left, 0));
    return () => window.clearTimeout(t);
  }, [emergency, endEmergency]);

  const logout = useCallback(() => {
    if (emergency) {
      logAudit({ action: "Security", module: "Emergency access", summary: `Emergency access ended at sign out for ${user?.name ?? "user"}`, dedupeMs: 0 });
      saveGrant(null);
      setEmergency(null);
    }
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
      !!user &&
      (user.isAdmin ||
        !!user.permissions[module]?.[action] ||
        // Emergency access is read-only and only covers patient records.
        (module === "Patients" && action === "view" && !!emergency && emergency.expiresAt > Date.now())),
    [user, emergency]
  );

  const value = useMemo(
    () => ({ user, login, logout, can, emergency, startEmergency, endEmergency }),
    [user, login, logout, can, emergency, startEmergency, endEmergency]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}