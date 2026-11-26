import { api } from "./api";
import { staffApi, type StaffMember } from "./staff";

export interface DoctorProfile {
  id: string;
  name: string;
  specialty?: string;
  status?: string;
  days?: number[];
  start?: string;
  end?: string;
  email?: string;
  phone?: string;
  roleName?: string;
}

/** Directory of practising doctors from the hospital database. */
export const doctorsApi = {
  list: async (): Promise<DoctorProfile[]> => {
    try {
      const res = await api.get<{ doctors: DoctorProfile[] }>("/doctor");
      return res.doctors ?? [];
    } catch {
      // Fallback: staff with doctor role
      try {
        const staff = (await staffApi.directory()) ?? [];
        return staff
          .filter(
            (s) =>
              s.active !== false &&
              (/doctor|physician|consultant/i.test(s.roleName || "") || /doctor|physician/i.test(s.name || ""))
          )
          .map((s: StaffMember) => ({
            id: s.id,
            name: s.name,
            roleName: s.roleName,
            email: s.email,
            phone: s.phone,
          }));
      } catch {
        return [];
      }
    }
  },
};

/** Display names only, for selects that store a name string. */
export async function doctorNames(): Promise<string[]> {
  const list = await doctorsApi.list();
  return list.map((d) => d.name).filter(Boolean);
}
