import { api } from "./api";

export interface StaffMember {
  id: string;
  name: string;
  roleId?: string;
  email?: string;
  phone?: string;
  active?: boolean;
  roleName?: string;
}

export const staffApi = {
  directory: async () =>
    (await api.get<{ staff: StaffMember[] }>("/users/directory")).staff,
  list: async () =>
    (await api.get<{ users: StaffMember[] }>("/users")).users,
};
