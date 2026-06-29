import {
  apiGet,
  apiPost,
  type ApiCollectionResponse,
  type ApiResponse,
} from "../lib/api-client";
import type {
  ApprovalStatus,
  OrganizerRequestDetail,
  OrganizerRequestSummary,
} from "./organizer.service";

export type AdminOrganizerRequestSummary = OrganizerRequestSummary & {
  organizer_id?: string;
};

export type ApproveOrganizerRequestResult = {
  concert: {
    id: string;
    title: string;
    slug: string;
    status: "DRAFT";
  };
  seat_zones_created: number;
  ticket_types_created: number;
  gates_created: number;
  checker_accounts: Array<{
    user_id: string;
    email: string;
    password: string;
  }>;
};

export type AdminConcertDeletionRequest = {
  id: string;
  concert_id: string;
  organizer_id: string;
  reason?: string;
  status: ApprovalStatus;
  review_note?: string;
  reviewed_by?: string | null;
  reviewed_at?: string;
  created_at: string;
};

export type ApproveConcertDeletionResult = {
  id: string;
  concert_id: string;
  concert_status: "CANCELLED";
  status: "APPROVED";
  reviewed_at: string;
};

export type AdminCheckerAccount = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  status: string;
  created_at: string;
};

export async function listAdminOrganizerRequests(status?: ApprovalStatus | "all") {
  const query = status && status !== "all" ? `?status=${status}&limit=100` : "?limit=100";
  const response = await apiGet<ApiCollectionResponse<AdminOrganizerRequestSummary>>(
    `/admin/organizer-requests${query}`,
  );
  return response.data;
}

export async function getAdminOrganizerRequest(requestId: string) {
  const response = await apiGet<ApiResponse<OrganizerRequestDetail>>(
    `/admin/organizer-requests/${requestId}`,
  );
  return response.data;
}

export async function approveAdminOrganizerRequest(requestId: string) {
  const response = await apiPost<ApiResponse<ApproveOrganizerRequestResult>>(
    `/admin/organizer-requests/${requestId}/approve`,
  );
  return response.data;
}

export async function rejectAdminOrganizerRequest(requestId: string, reviewNote: string) {
  const response = await apiPost<ApiResponse<{ id: string; status: ApprovalStatus; reviewed_at: string }>>(
    `/admin/organizer-requests/${requestId}/reject`,
    { review_note: reviewNote },
  );
  return response.data;
}

export async function listAdminConcertDeletionRequests(status?: ApprovalStatus | "all") {
  const query = status && status !== "all" ? `?status=${status}&limit=100` : "?limit=100";
  const response = await apiGet<ApiCollectionResponse<AdminConcertDeletionRequest>>(
    `/admin/concert-deletion-requests${query}`,
  );
  return response.data;
}

export async function approveAdminConcertDeletionRequest(requestId: string) {
  const response = await apiPost<ApiResponse<ApproveConcertDeletionResult>>(
    `/admin/concert-deletion-requests/${requestId}/approve`,
  );
  return response.data;
}

export async function rejectAdminConcertDeletionRequest(requestId: string, reviewNote: string) {
  const response = await apiPost<ApiResponse<{ id: string; status: ApprovalStatus; reviewed_at: string }>>(
    `/admin/concert-deletion-requests/${requestId}/reject`,
    { review_note: reviewNote },
  );
  return response.data;
}

export async function listAdminConcertCheckerAccounts(concertId: string) {
  const response = await apiGet<ApiCollectionResponse<AdminCheckerAccount>>(
    `/admin/concerts/${concertId}/checker-accounts?limit=100`,
  );
  return response.data;
}
