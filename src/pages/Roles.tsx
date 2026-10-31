import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Copy, Lock, Plus, Search, Trash2, Users as UsersIcon } from "lucide-react";
import { logAudit, diffById } from "../services/audit";
import {
  ACTIONS,
  MODULES,
  emptyPermissions,
  loadRoles,
  loadUsers,
  saveRoles,
  type Action,
  type Module,
  type Permissions,
  type Role,
} from "../types/access";

const ADMIN_ID = "r-admin";
const NEW = "new";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500";

const clone = (p: Permissions): Permissions => JSON.parse(JSON.stringify(p));
const countGranted = (p: Permissions) => MODULES.reduce((n, m) => n + ACTIONS.filter((a) => p[m][a]).length, 0);
const TOTAL = MODULES.length * ACTIONS.length;
const same = (a: Permissions, b: Permissions) => MODULES.every((m) => ACTIONS.every((x) => a[m][x] === b[m][x]));

const setAll = (value: boolean, actions: readonly Action[] = ACTIONS, modules: readonly Module[] = MODULES): Permissions => {
  const p = emptyPermissions();
  modules.forEach((m) => actions.forEach((a) => (p[m][a] = value)));
  return p;
};

const PRESETS: { label: string; build: () => Permissions }[] = [
  { label: "Read-only", build: () => setAll(true, ["view"]) },
  { label: "View, add and edit", build: () => setAll(true, ["view", "create", "edit"]) },
  { label: "Full access", build: () => setAll(true) },
  { label: "Clear all", build: () => emptyPermissions() },
];

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>(loadRoles);
  const savedRoles = useRef(roles);
  useEffect(() => {
    saveRoles(roles);
    const d = diffById(savedRoles.current, roles, (a, b) => JSON.stringify(a) === JSON.stringify(b));
    d.created.forEach((r) => logAudit({ action: "Security", module: "Roles", summary: `Created role ${r.name}`, detail: `${countGranted(r.permissions)} permissions` }));
    d.updated.forEach((r) => logAudit({ action: "Security", module: "Roles", summary: `Changed role ${r.name}`, detail: `${countGranted(r.permissions)} permissions now granted` }));
    d.deleted.forEach((r) => logAudit({ action: "Delete", module: "Roles", summary: `Deleted role ${r.name}` }));
    savedRoles.current = roles;
  }, [roles]);
  const [users] = useState(loadUsers);
  const [selectedId, setSelectedId] = useState<string>(() => (roles[1] ?? roles[0]).id);
  const [query, setQuery] = useState("");

  const first = roles[1] ?? roles[0];
  const [name, setName] = useState(first.name);
  const [description, setDescription] = useState(first.description);
  const [permissions, setPermissions] = useState<Permissions>(() => clone(first.permissions));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const userCount = (roleId: string) => users.filter((u) => u.roleId === roleId).length;

  const creating = selectedId === NEW;
  const current = roles.find((r) => r.id === selectedId);
  const locked = current?.id === ADMIN_ID;

  const dirty = creating
    ? name.trim() !== "" || description.trim() !== "" || countGranted(permissions) > 0
    : !!current && (name.trim() !== current.name || description.trim() !== current.description || !same(permissions, current.permissions));

  const load = (role: Role | null) => {
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setPermissions(role ? clone(role.permissions) : emptyPermissions());
    setError("");
    setSaved("");
  };

  const select = (id: string) => {
    if (id === selectedId) return;
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setSelectedId(id);
    load(id === NEW ? null : roles.find((r) => r.id === id) ?? null);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roles.filter((r) => !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [roles, query]);

  // "view" is the base permission: granting anything else grants view, removing view removes everything for that module.
  const toggle = (m: Module, a: Action) => {
    if (locked) return;
    setSaved("");
    setPermissions((p) => {
      const next = clone(p);
      const on = !p[m][a];
      next[m][a] = on;
      if (a === "view" && !on) ACTIONS.forEach((x) => (next[m][x] = false));
      if (a !== "view" && on) next[m].view = true;
      return next;
    });
  };

  const toggleModule = (m: Module) => {
    if (locked) return;
    setSaved("");
    setPermissions((p) => {
      const all = ACTIONS.every((a) => p[m][a]);
      return { ...p, [m]: { view: !all, create: !all, edit: !all, delete: !all } };
    });
  };

  const toggleColumn = (a: Action) => {
    if (locked) return;
    setSaved("");
    setPermissions((p) => {
      const all = MODULES.every((m) => p[m][a]);
      const next = clone(p);
      MODULES.forEach((m) => {
        next[m][a] = !all;
        if (a === "view" && all) ACTIONS.forEach((x) => (next[m][x] = false));
        if (a !== "view" && !all) next[m].view = true;
      });
      return next;
    });
  };

  const applyPreset = (build: () => Permissions) => {
    if (locked) return;
    setSaved("");
    setPermissions(build());
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const trimmed = name.trim();
    if (!trimmed) return setError("Role name is required.");
    if (roles.some((r) => r.id !== selectedId && r.name.toLowerCase() === trimmed.toLowerCase())) return setError("A role with that name already exists.");
    if (countGranted(permissions) === 0) return setError("Grant at least one permission.");

    // TODO: POST (new) or PUT (existing) to the backend via a services/ call
    if (creating) {
      const role: Role = { id: `r-${Date.now()}`, name: trimmed, description: description.trim(), permissions: clone(permissions) };
      setRoles((prev) => [...prev, role]);
      setSelectedId(role.id);
      setSaved(`Role "${trimmed}" created.`);
    } else {
      setRoles((prev) => prev.map((r) => (r.id === selectedId ? { ...r, name: trimmed, description: description.trim(), permissions: clone(permissions) } : r)));
      setSaved("Changes saved.");
    }
    setError("");
  };

  const duplicate = (role: Role) => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setSelectedId(NEW);
    setName(`${role.name} (copy)`);
    setDescription(role.description);
    setPermissions(clone(role.permissions));
    setError("");
    setSaved("");
  };

  const remove = (role: Role) => {
    if (role.id === ADMIN_ID) return;
    const n = userCount(role.id);
    if (n > 0) return window.alert(`${n} user(s) still have the ${role.name} role. Move them to another role first.`);
    if (!window.confirm(`Delete the ${role.name} role?`)) return;
    // TODO: DELETE /roles/:id via a services/ call
    setRoles((prev) => prev.filter((r) => r.id !== role.id));
    setSelectedId(ADMIN_ID);
    load(roles.find((r) => r.id === ADMIN_ID) ?? null);
  };

  const granted = countGranted(permissions);

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      {/* Role list */}
      <section className="rounded-xl border border-slate-200 bg-white xl:col-span-2">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Roles ({roles.length})</h2>
          <button onClick={() => select(NEW)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={15} /> New role
          </button>
        </div>
        <div className="border-b border-slate-100 p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search roles" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        <ul className="divide-y divide-slate-100">
          {visible.map((r) => {
            const n = countGranted(r.permissions);
            const users = userCount(r.id);
            const active = r.id === selectedId;
            return (
              <li key={r.id}>
                <button onClick={() => select(r.id)} className={`flex w-full items-start justify-between gap-3 px-5 py-3 text-left ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      {r.name}
                      {r.id === ADMIN_ID && <Lock size={12} className="text-slate-400" aria-label="Protected role" />}
                    </p>
                    <p className="truncate text-xs text-slate-500">{r.description || "No description"}</p>
                    <div className="mt-2 h-1 w-32 rounded-full bg-slate-100">
                      <div className="h-1 rounded-full bg-blue-600" style={{ width: `${(n / TOTAL) * 100}%` }} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <p className="text-blue-600">{n}/{TOTAL} permissions</p>
                    <p className="mt-1 flex items-center justify-end gap-1 text-slate-500"><UsersIcon size={12} /> {users} user{users === 1 ? "" : "s"}</p>
                  </div>
                </button>
              </li>
            );
          })}
          {visible.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">No roles match your search.</li>}
        </ul>
      </section>

      {/* Editor */}
      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 xl:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800">
            {creating ? "Create role" : `Edit role: ${current?.name ?? ""}`}
            {dirty && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Unsaved changes</span>}
          </h2>
          {!creating && current && (
            <div className="flex gap-1">
              <button type="button" onClick={() => duplicate(current)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                <Copy size={14} /> Duplicate
              </button>
              {!locked && (
                <button type="button" onClick={() => remove(current)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          )}
        </div>

        {locked && (
          <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <Lock size={14} /> The Administrator role always has full access and can't be changed or deleted. Use Duplicate to base a new role on it.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Role name</span>
            <input className={inputClass} value={name} onChange={(e) => { setName(e.target.value); setSaved(""); }} placeholder="e.g. Lab Technician" disabled={locked} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Description</span>
            <input className={inputClass} value={description} onChange={(e) => { setDescription(e.target.value); setSaved(""); }} placeholder="What this role does" disabled={locked} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Quick set:</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" disabled={locked} onClick={() => applyPreset(p.build)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              {p.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">{granted} of {TOTAL} granted</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Module</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="px-4 py-2 text-center">
                    <button type="button" disabled={locked} onClick={() => toggleColumn(a)} title={`Toggle ${a} for every module`} className="font-semibold uppercase hover:text-blue-600 disabled:hover:text-slate-500">
                      {a}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MODULES.map((m) => (
                <tr key={m}>
                  <td className="px-4 py-2">
                    <button type="button" disabled={locked} onClick={() => toggleModule(m)} title="Toggle all actions for this module" className="font-medium text-slate-700 hover:text-blue-600 disabled:hover:text-slate-700">
                      {m}
                    </button>
                  </td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={permissions[m][a]}
                        disabled={locked}
                        onChange={() => toggle(m, a)}
                        aria-label={`${a} ${m}`}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">Create, edit and delete need view access, so ticking any of them also ticks view. Clicking a module name or column heading toggles the whole row or column.</p>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">{saved}</p>}

        {!locked && (
          <div className="flex gap-3">
            <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
              {creating ? "Create role" : "Save changes"}
            </button>
            {dirty && (
              <button type="button" onClick={() => load(creating ? null : current ?? null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                {creating ? "Clear" : "Reset"}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}