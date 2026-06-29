import type {
  AdminOrganizerRequestSummary,
  ApproveOrganizerRequestResult,
} from "../../services/admin-organizer.service";
import type { ApprovalStatus, OrganizerRequestDetail } from "../../services/organizer.service";
import { approvalStatusLabel } from "../organizer/organizer.view-model";

export type AdminOrganizerRequestView = {
  id: string;
  title: string;
  artistName: string;
  organizerLabel: string;
  status: ApprovalStatus;
  statusLabel: string;
  startsAt: string;
  gateCount: number;
  checkerCount: number;
};

export type AdminOrganizerRequestDetailView = AdminOrganizerRequestView & {
  description: string;
  venueId: string;
  plannedPublishAt?: string;
  pressKitLabel: string;
  reviewNote: string;
  ticketTypes: OrganizerRequestDetail["ticket_types"];
};

export function toAdminOrganizerRequestView(request: AdminOrganizerRequestSummary): AdminOrganizerRequestView {
  return {
    id: request.id,
    title: request.title,
    artistName: request.artist_name,
    organizerLabel: request.organizer_id || "chủ hồ sơ hiện tại",
    status: request.status,
    statusLabel: approvalStatusLabel(request.status),
    startsAt: request.starts_at,
    gateCount: request.gate_count,
    checkerCount: request.checker_count,
  };
}

export function toAdminOrganizerRequestDetailView(detail: OrganizerRequestDetail): AdminOrganizerRequestDetailView {
  return {
    ...toAdminOrganizerRequestView(detail),
    description: detail.description || "Chưa có mô tả.",
    venueId: detail.venue_id,
    plannedPublishAt: detail.planned_publish_at,
    pressKitLabel: detail.press_kit_url || "Chưa cung cấp",
    reviewNote: detail.review_note || "Chưa có ghi chú",
    ticketTypes: detail.ticket_types,
  };
}

export function approveResultTitle(result: ApproveOrganizerRequestResult) {
  return `Concert ${result.concert.title} hiện là bản nháp. Hãy lưu các mật khẩu này trước khi rời trang.`;
}
