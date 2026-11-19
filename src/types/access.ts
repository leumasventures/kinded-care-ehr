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
  isSystem?: boolean;
  permissions: Permissions;
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  active: boolean;
  /** Server time "YYYY-MM-DD HH:mm:ss" (UTC), or null if they have never signed in. */
  lastLogin: string | null;
  locked?: boolean;
  phone?: string;
  createdAt: string;
  mustChangePassword: boolean;
  /** Per-user privileges. When set they replace the role's permissions for this user. */
  permissions?: Permissions;
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

export const ADMIN_ROLE_ID = "r-admin";

/** What a user can actually do: their own privileges if set, otherwise their role's. The server enforces the same rule. */
export function effectivePermissions(user: User, roles: Role[]): Permissions {
  if (user.roleId === ADMIN_ROLE_ID) {
    const all = emptyPermissions();
    MODULES.forEach((m) => ACTIONS.forEach((a) => (all[m][a] = true)));
    return all;
  }
  return user.permissions ?? roles.find((r) => r.id === user.roleId)?.permissions ?? emptyPermissions();
}
