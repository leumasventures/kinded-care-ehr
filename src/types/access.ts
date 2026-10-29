export const MODULES = [
  "Patients",
  "Appointments",
  "Doctors",
  "Laboratory",
  "Pharmacy",
  "Nursing",
  "Admissions",
  "Billing",
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
  lastLogin: string;
}

export const emptyPermissions = (): Permissions =>
  Object.fromEntries(
    MODULES.map((m) => [m, { view: false, create: false, edit: false, delete: false }])
  ) as Permissions;

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
    id: "r-cashier",
    name: "Cashier",
    description: "Invoices and payments",
    permissions: grant(["Billing"], ["view", "create", "edit"]),
  },
];

export const seedUsers: User[] = [
  { id: "u-1", name: "Admin User", email: "admin@hospital.com", roleId: "r-admin", active: true, lastLogin: "2026-10-27 08:12" },
  { id: "u-2", name: "Dr. Eze", email: "eze@hospital.com", roleId: "r-doctor", active: true, lastLogin: "2026-10-27 07:55" },
  { id: "u-3", name: "Chioma Nurse", email: "chioma@hospital.com", roleId: "r-nurse", active: true, lastLogin: "2026-10-26 19:40" },
  { id: "u-4", name: "Tobi Pharm", email: "tobi@hospital.com", roleId: "r-pharmacist", active: false, lastLogin: "2026-10-18 14:03" },
  { id: "u-5", name: "Kelechi Cash", email: "kelechi@hospital.com", roleId: "r-cashier", active: true, lastLogin: "2026-10-27 09:01" },
];