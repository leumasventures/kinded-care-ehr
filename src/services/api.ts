// The one door to the hospital server. Every page that saves or loads data goes through here.
//
// Where the server lives comes from VITE_API_URL, set when the site is built (see README). There is deliberately no
// fallback address: if it is missing the app says so instead of quietly talking to the wrong place or to a local copy.
//
// Sessions: the short-lived access token is kept only in memory. The longer-lived renewal token is kept in this tab's
// sessionStorage, so a page reload keeps you signed in but closing the tab or browser signs you out (safer on shared computers).
// Renewal tokens are single-use, so only one renewal runs at a time.

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const BASE = (env?.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

export const API_CONFIGURED = BASE.length > 0;

export class ApiError extends Error {
  status: number;
  code?: string;
  data: Record<string, unknown>;
  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = typeof data.code === "string" ? data.code : undefined;
    this.data = data;
  }
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleId: string;
  roleName: string;
  isAdmin: boolean;
  permissions: Record<string, Record<string, boolean>>;
  mustChangePassword: boolean;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SessionUser;
}

const RT_KEY = "hms_rt";
let accessToken = "";
let refreshing: Promise<SessionUser | null> | null = null;
let onSessionEnded: (() => void) | null = null;

const readRt = () => {
  try {
    return sessionStorage.getItem(RT_KEY) ?? "";
  } catch {
    return "";
  }
};
const writeRt = (v: string | null) => {
  try {
    if (v) sessionStorage.setItem(RT_KEY, v);
    else sessionStorage.removeItem(RT_KEY);
  } catch {
    /* storage blocked: the session lasts until the page is reloaded */
  }
};

export const hasStoredSession = () => !!readRt();
export const isSignedIn = () => !!accessToken;
/** Called when the server says the session is over (renewal refused). The app uses it to go back to the sign-in page. */
export const setSessionEndedHandler = (fn: (() => void) | null) => {
  onSessionEnded = fn;
};

function keep(t: Tokens) {
  accessToken = t.accessToken;
  writeRt(t.refreshToken);
}

const clearListeners: Array<() => void> = [];
/** Lets other modules drop anything they hold in memory or session storage when the sign-in ends. */
export const onSessionCleared = (fn: () => void) => {
  clearListeners.push(fn);
};
export function clearSession() {
  accessToken = "";
  writeRt(null);
  clearListeners.forEach((fn) => fn());
}

async function send(method: string, path: string, body: unknown, token: string): Promise<{ status: number; data: Record<string, unknown> }> {
  if (!API_CONFIGURED) throw new ApiError(0, "The app isn't connected to the hospital server (VITE_API_URL is not set).");
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your internet connection and try again.");
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty or non-JSON body */
  }
  return { status: res.status, data };
}

const fail = (status: number, data: Record<string, unknown>) => new ApiError(status, typeof data.error === "string" ? data.error : "Something went wrong. Try again.", data);

/** Exchanges the stored renewal token for a new pair. Safe to call from several places at once: they share one request. */
export function refreshSession(): Promise<SessionUser | null> {
  if (refreshing) return refreshing;
  const rt = readRt();
  if (!rt) return Promise.resolve(null);
  refreshing = (async () => {
    try {
      const { status, data } = await send("POST", "/auth/refresh", { refreshToken: rt }, "");
      if (status === 200) {
        keep(data as unknown as Tokens);
        return (data as unknown as Tokens).user;
      }
      if (status === 401) clearSession(); // refused: this sign-in is over
      return null;
    } catch {
      return null; // the server couldn't be reached: keep the stored token and let the caller show the problem
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<T> {
  let { status, data } = await send(method, path, body, accessToken);
  if (status === 401 && data.code === "token_expired" && readRt()) {
    // The access token ran out: renew quietly and repeat the request once.
    const user = await refreshSession();
    if (user) ({ status, data } = await send(method, path, body, accessToken));
    else {
      onSessionEnded?.();
      throw fail(401, { error: "Your session has ended. Sign in again." });
    }
  }
  if (status === 401 && !path.startsWith("/auth/login")) {
    clearSession();
    onSessionEnded?.();
  }
  if (status < 200 || status >= 300) throw fail(status, data);
  return data as T;
}

export const api = {
  get: <T = Record<string, unknown>>(path: string) => request<T>("GET", path),
  post: <T = Record<string, unknown>>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T = Record<string, unknown>>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: <T = Record<string, unknown>>(path: string) => request<T>("DELETE", path),
};

// ---- session calls ----

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const { status, data } = await send("POST", "/auth/login", { email, password }, "");
  if (status !== 200) throw fail(status, data);
  keep(data as unknown as Tokens);
  return (data as unknown as Tokens).user;
}

export async function signOut() {
  const rt = readRt();
  try {
    if (accessToken) await send("POST", "/auth/logout", { refreshToken: rt }, accessToken);
  } catch {
    /* signing out must always work, even offline */
  } finally {
    clearSession();
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<SessionUser> {
  const { status, data } = await send("POST", "/auth/change-password", { currentPassword, newPassword }, accessToken);
  if (status !== 200) throw fail(status, data);
  keep(data as unknown as Tokens);
  return (data as unknown as Tokens).user;
}

/** The server stores times as UTC text ("2026-11-10 14:03:22.123"). Turns that into a real Date. */
export const parseServerTime = (s: string) => new Date(`${s.replace(" ", "T")}Z`);
