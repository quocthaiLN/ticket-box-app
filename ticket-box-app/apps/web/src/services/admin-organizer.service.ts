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

export async function approveAdminOrganizerRequest(requestId: string, reviewNote?: string) {
  const response = await apiPost<ApiResponse<ApproveOrganizerRequestResult>>(
    `/admin/organizer-requests/${requestId}/approve`,
    reviewNote ? { review_note: reviewNote } : {},
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
