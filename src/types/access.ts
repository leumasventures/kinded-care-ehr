export const MODULES = [
  "Patients",
  "Appointments",
  "Doctors",
  "Laboratory",
  "Pharmacy",
  "Nursing",
  "Admissions",
  "Billing",
  "Accounts",
  "Roster",
  "Reports",
  "Settings",
] as const;

export const ACTIONS = ["view", "create", "edit", "delete"] as const;

export type Module = (typeof MODULES)[number];
export type Action = (typeof ACTIONS)[number];

export type Permissions = Record<Module, Record<Action, boolean>>;

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permissions;
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  active: boolean;
  lastLogin: string; // "YYYY-MM-DD HH:mm" or "Never"
  phone?: string;
  createdAt: string;
  mustChangePassword: boolean;
  /** Per-user privileges. When set they replace the role's permissions for this user. */
  permissions?: Permissions;
  /** MOCK ONLY: salted SHA-256 so the demo login works for users created in the UI. The real backend must hash with bcrypt/argon2 server-side. */
  passwordHash?: string;
}

export const emptyPermissions = (): Permissions =>
  Object.fromEntries(
    MODULES.map((m) => [m, { view: false, create: false, edit: false, delete: false }])
  ) as Permissions;

/** Fills in modules that were added after a role or user was saved, so older saved data keeps working. */
export function normalizePermissions(p: Partial<Permissions> | undefined): Permissions {
  const base = emptyPermissions();
  if (!p) return base;
  MODULES.forEach((m) => ACTIONS.forEach((a) => (base[m][a] = !!p[m]?.[a])));
  return base;
}

const grant = (modules: Module[], actions: Action[]): Permissions => {
  const p = emptyPermissions();
  modules.forEach((m) => actions.forEach((a) => (p[m][a] = true)));
  return p;
};

// Mock seed data. Replace with a services/ call when the backend is ready.
export const seedRoles: Role[] = [
  {
    id: "r-admin",
    name: "Administrator",
    description: "Full access to every module",
    permissions: grant([...MODULES], [...ACTIONS]),
  },
  {
    id: "r-doctor",
    name: "Doctor",
    description: "Clinical access to patients, appointments, lab and admissions",
    permissions: grant(["Patients", "Appointments", "Doctors", "Laboratory", "Admissions"], ["view", "create", "edit"]),
  },
  {
    id: "r-nurse",
    name: "Nurse",
    description: "Ward care, vitals and patient records",
    permissions: grant(["Patients", "Nursing", "Admissions"], ["view", "create", "edit"]),
  },
  {
    id: "r-pharmacist",
    name: "Pharmacist",
    description: "Manages drug inventory and dispensing",
    permissions: grant(["Pharmacy"], [...ACTIONS]),
  },
  {
    id: "r-accountant",
    name: "Accountant",
    description: "Manages accounts, expenses, payroll and financial records",
    permissions: (() => {
      const p = grant(["Accounts"], ["view", "create", "edit"]);
      p.Billing.view = true;
      p.Reports.view = true;
      return p;
    })(),
  },
  {
    id: "r-cashier",
    name: "Cashier",
    description: "Invoices and payments",
    permissions: grant(["Billing"], ["view", "create", "edit"]),
  },
];

export const seedUsers: User[] = [
  { id: "u-1", name: "Admin User", email: "admin@hospital.com", roleId: "r-admin", active: true, lastLogin: "2026-10-27 08:12", createdAt: "2026-09-01", mustChangePassword: false },
  { id: "u-2", name: "Dr. Eze", email: "eze@hospital.com", roleId: "r-doctor", active: true, lastLogin: "2026-10-27 07:55", createdAt: "2026-09-01", mustChangePassword: false },
  { id: "u-3", name: "Chioma Nurse", email: "chioma@hospital.com", roleId: "r-nurse", active: true, lastLogin: "2026-10-26 19:40", createdAt: "2026-09-01", mustChangePassword: false },
  { id: "u-4", name: "Tobi Pharm", email: "tobi@hospital.com", roleId: "r-pharmacist", active: false, lastLogin: "2026-10-18 14:03", createdAt: "2026-09-01", mustChangePassword: false },
  { id: "u-5", name: "Kelechi Cash", email: "kelechi@hospital.com", roleId: "r-cashier", active: true, lastLogin: "2026-10-27 09:01", createdAt: "2026-09-01", mustChangePassword: false },
];

// ---- Shared mock store (browser localStorage) so Roles, Users, Admin and Login see the same data ----
// TODO: replace with services/ calls (GET/POST/PUT/DELETE /roles and /users) once the backend is ready.
const ROLES_KEY = "hms_roles";
const USERS_KEY = "hms_users";

function readList<T>(key: string): T[] | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null");
    return Array.isArray(raw) ? (raw as T[]) : null;
  } catch {
    return null;
  }
}

function writeList(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: changes last until refresh */
  }
}

export function loadRoles(): Role[] {
  const stored = readList<Role>(ROLES_KEY)
    ?.filter((r) => r && r.id && r.name && r.permissions)
    .map((r) => ({ ...r, permissions: normalizePermissions(r.permissions) }));
  if (!stored || stored.length === 0) return seedRoles;
  // The Administrator role is always present and always full access.
  const admin = seedRoles[0];
  return [admin, ...stored.filter((r) => r.id !== admin.id)];
}

export const saveRoles = (roles: Role[]) => writeList(ROLES_KEY, roles);

export function loadUsers(): User[] {
  const stored = readList<User>(USERS_KEY)
    ?.filter((u) => u && u.id && u.email)
    .map((u) => (u.permissions ? { ...u, permissions: normalizePermissions(u.permissions) } : u));
  return stored && stored.length > 0 ? stored : seedUsers;
}

export const saveUsers = (users: User[]) => writeList(USERS_KEY, users);

/** What a user can actually do: their own privileges if set, otherwise their role's. */
export function effectivePermissions(user: User, roles: Role[]): Permissions {
  if (user.roleId === "r-admin") return seedRoles[0].permissions;
  return user.permissions ?? roles.find((r) => r.id === user.roleId)?.permissions ?? emptyPermissions();
}

export async function hashPassword(userId: string, password: string): Promise<string> {
  const text = `${userId}:${password}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`hms:${text}`));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback for non-secure contexts (plain http). Weak, demo only.
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `fnv-${(h >>> 0).toString(16)}`;
}