import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, changePassword as apiChangePassword, hasStoredSession, parseServerTime, refreshSession, setSessionEndedHandler, signIn, signOut, type SessionUser } from "../services/api";
import type { EmergencyGrant } from "../services/emergency";
import { normalizePermissions, type Action, type Module, type Permissions } from "../types/access";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roleName: string;
  isAdmin: boolean;
  permissions: Permissions;
  /** True for a new or reset account: the app shows only the "choose a password" screen until it is done. */
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** False while the app is checking whether a stored sign-in can be continued after a reload. */
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (module: Module, action?: Action) => boolean;
  /** Time-limited, read-only access to patient records, granted after giving a reason. The server sets the clock. */
  emergency: EmergencyGrant | null;
  startEmergency: (reason: string) => Promise<void>;
  endEmergency: (why?: "ended" | "expired") => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toAuthUser = (u: SessionUser): AuthUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  roleName: u.roleName,
  isAdmin: u.isAdmin,
  permissions: normalizePermissions(u.permissions as Partial<Permissions>),
  mustChangePassword: u.mustChangePassword,
});

interface ServerGrant {
  startedAt: string;
  expiresAt: string;
  reason: string;
}
const toGrant = (userId: string, g: ServerGrant | null): EmergencyGrant | null =>
  g ? { userId, reason: g.reason, startedAt: parseServerTime(g.startedAt).getTime(), expiresAt: parseServerTime(g.expiresAt).getTime() } : null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!hasStoredSession());
  const [emergency, setEmergency] = useState<EmergencyGrant | null>(null);

  const loadGrant = useCallback(async (u: AuthUser) => {
    if (u.mustChangePassword || u.isAdmin) return setEmergency(null);
    try {
      setEmergency(toGrant(u.id, (await api.get<{ grant: ServerGrant | null }>("/emergency-access")).grant));
    } catch {
      setEmergency(null);
    }
  }, []);

  // After a reload, continue the sign-in from the stored renewal token (if the server still accepts it).
  useEffect(() => {
    setSessionEndedHandler(() => {
      setUser(null);
      setEmergency(null);
    });
    if (!hasStoredSession()) return;
    let cancelled = false;
    (async () => {
      const session = await refreshSession();
      if (cancelled) return;
      if (session) {
        const u = toAuthUser(session);
        setUser(u);
        await loadGrant(u);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      setSessionEndedHandler(null);
    };
  }, [loadGrant]);

  const login = useCallback(
    async (email: string, password: string) => {
      const u = toAuthUser(await signIn(email.trim(), password));
      setUser(u);
      await loadGrant(u);
    },
    [loadGrant]
  );

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setUser(toAuthUser(await apiChangePassword(currentPassword, newPassword)));
  }, []);

  const endEmergency = useCallback(
    async (why: "ended" | "expired" = "ended") => {
      setEmergency(null);
      if (why === "ended") {
        try {
          await api.del("/emergency-access");
        } catch {
          /* the grant also ends by itself on the server when its time is up */
        }
      }
    },
    []
  );

  const startEmergency = useCallback(
    async (reason: string) => {
      if (!user) return;
      setEmergency(toGrant(user.id, (await api.post<{ grant: ServerGrant }>("/emergency-access", { reason: reason.trim() })).grant));
    },
    [user]
  );

  // The grant switches itself off in the app when its time is up (the server refuses it from then on anyway).
  useEffect(() => {
    if (!emergency) return;
    const t = window.setTimeout(() => void endEmergency("expired"), Math.max(emergency.expiresAt - Date.now(), 0));
    return () => window.clearTimeout(t);
  }, [emergency, endEmergency]);

  const logout = useCallback(async () => {
    setUser(null);
    setEmergency(null);
    await signOut();
  }, []);

  const can = useCallback(
    (module: Module, action: Action = "view") =>
      !!user &&
      !user.mustChangePassword &&
      (user.isAdmin ||
        !!user.permissions[module]?.[action] ||
        // Emergency access is read-only and only covers patient records.
        (module === "Patients" && action === "view" && !!emergency && emergency.expiresAt > Date.now())),
    [user, emergency]
  );

  const value = useMemo(
    () => ({ user, ready, login, changePassword, logout, can, emergency, startEmergency, endEmergency }),
    [user, ready, login, changePassword, logout, can, emergency, startEmergency, endEmergency]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
