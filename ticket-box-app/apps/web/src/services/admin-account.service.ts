import {
  apiDelete,
  apiGet,
  apiPatch,
  type ApiCollectionResponse,
  type ApiResponse,
} from "../lib/api-client";

export type AdminUserRole = "AUDIENCE" | "ORGANIZER" | "CHECKER" | "ADMIN";
export type AdminUserStatus = "ACTIVE" | "LOCKED" | "DISABLED";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  created_at: string;
};

export async function listAdminUsers() {
  const response = await apiGet<ApiCollectionResponse<AdminUser>>(
    "/auth/admin/users?limit=100",
  );
  return response.data;
}

export async function promoteAdminUserToOrganizer(userId: string) {
  const response = await apiPatch<ApiResponse<{ user_id: string; role: AdminUserRole; updated_at: string }>>(
    `/auth/admin/users/${userId}/role`,
    { role: "ORGANIZER" },
  );
  return response.data;
}

export async function deleteAdminUser(userId: string) {
  const response = await apiDelete<ApiResponse<{ user_id: string; status: AdminUserStatus; deleted_at: string }>>(
    `/auth/admin/users/${userId}`,
  );
  return response.data;
}
