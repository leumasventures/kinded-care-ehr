import { api } from "./api";
import type { SessionUser } from "./api";

export interface ProfileUpdate {
  name?: string;
  phone?: string;
}

export const accountApi = {
  me: async () => (await api.get<{ user: SessionUser }>("/account")).user,
  updateProfile: (data: ProfileUpdate) => api.put<{ user: SessionUser }>("/account", data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: boolean; signedOut?: boolean }>("/account/password", { currentPassword, newPassword }),
};
