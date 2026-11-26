import { api } from "./api";

export interface RosterEntry {
  id: string;
  staffId: string;
  staff: string;
  roleId?: string;
  date: string;
  shift: string;
  department?: string | null;
  notes?: string | null;
}

export interface RosterInput {
  staffId: string;
  date: string;
  shift: string;
  department?: string;
  notes?: string;
}

export interface AssignInput {
  staffIds: string[];
  dates: string[];
  shift: string;
  department?: string;
}

export interface RosterFilters {
  from?: string;
  to?: string;
  staffId?: string;
  department?: string;
  limit?: number;
}

function qs(f: RosterFilters) {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.staffId) p.set("staffId", f.staffId);
  if (f.department) p.set("department", f.department);
  if (f.limit !== undefined) p.set("limit", String(f.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const dutyRosterApi = {
  list: async (f: RosterFilters = {}) =>
    (await api.get<{ entries: RosterEntry[] } | { roster: RosterEntry[] }>(`/duty-roster${qs(f)}`).then((r) =>
      "entries" in r ? r.entries : (r as { roster: RosterEntry[] }).roster
    )),
  mine: async () =>
    (await api.get<{ entries: RosterEntry[] } | { roster: RosterEntry[] }>("/duty-roster/mine").then((r) =>
      "entries" in r ? r.entries : (r as { roster: RosterEntry[] }).roster
    )),
  onDuty: async (date?: string) => {
    const q = date ? `?date=${date}` : "";
    return api.get<{ shifts: { shift: string; staff: RosterEntry[] }[] } | { onDuty: unknown }>(`/duty-roster/on-duty${q}`);
  },
  create: (data: RosterInput) => api.post<{ entry: RosterEntry }>("/duty-roster", data),
  assign: (data: AssignInput) => api.post<{ created: number }>("/duty-roster/assign", data),
  update: (id: string, data: Partial<RosterInput>) =>
    api.put<{ entry: RosterEntry }>(`/duty-roster/${id}`, data),
  remove: (id: string) => api.del<{ ok: boolean }>(`/duty-roster/${id}`),
};
