import type {
  AdminOrganizerRequestDetail,
  AdminOrganizerRequestSummary,
  ApproveOrganizerRequestResult,
} from "../../services/admin-organizer.service";
import type { ApprovalStatus } from "../../services/organizer.service";
import { approvalStatusLabel } from "../organizer/organizer.view-model";

export type AdminOrganizerRequestView = {
  id: string;
  title: string;
  artistName: string;
  organizerLabel: string;
  venueLabel: string;
  status: ApprovalStatus;
  statusLabel: string;
  startsAt: string;
  gateCount: number;
  checkerCount: number;
};

export type AdminOrganizerRequestDetailView = AdminOrganizerRequestView & {
  // Concert đã tạo từ hồ sơ (sau approve) — dùng để link sang trang chi tiết concert.
  concertId: string | null;
  description: string;
  venueId: string;
  plannedPublishAt?: string;
  pressKitLabel: string;
  // Ảnh sơ đồ chỗ ngồi organizer đính kèm hồ sơ (null = chưa cung cấp).
  seatMapUrl: string | null;
  bioStatus: string | null;
  artistBio: string | null;
  artistBioImageUrl: string | null;
  // Mỗi nghệ sĩ 1 khối; hồ sơ cũ/1 nghệ sĩ → mảng 1 phần tử từ field đơn.
  artists: Array<{ name: string; bio: string; imageUrl: string | null }>;
  reviewNote: string;
  ticketTypes: AdminOrganizerRequestDetail["ticket_types"];
};

export function toAdminOrganizerRequestView(request: AdminOrganizerRequestSummary): AdminOrganizerRequestView {
  return {
    id: request.id,
    title: request.title,
    artistName: request.artist_name,
    organizerLabel: request.organizer?.full_name || request.organizer?.email || request.organizer_id || "chủ hồ sơ hiện tại",
    venueLabel: request.venue ? request.venue.name : request.venue_id,
    status: request.status,
    statusLabel: approvalStatusLabel(request.status),
    startsAt: request.starts_at,
    gateCount: request.gate_count,
    checkerCount: request.checker_count,
  };
}

export function toAdminOrganizerRequestDetailView(detail: AdminOrganizerRequestDetail): AdminOrganizerRequestDetailView {
  return {
    ...toAdminOrganizerRequestView(detail),
    concertId: detail.concert_id ?? null,
    description: detail.description || "Chưa có mô tả.",
    venueId: detail.venue_id,
    plannedPublishAt: detail.planned_publish_at,
    pressKitLabel: detail.press_kit_url || "Chưa cung cấp",
    seatMapUrl: detail.seat_map_url ?? null,
    bioStatus: detail.bio_status ?? null,
    artistBio: detail.artist_bio ?? null,
    artistBioImageUrl: detail.artist_bio_image_url ?? null,
    artists:
      detail.artists && detail.artists.length > 0
        ? detail.artists.map((artist) => ({
            name: artist.name || detail.artist_name,
            bio: artist.bio,
            imageUrl: artist.image_url,
          }))
        : [
            {
              name: detail.artist_name,
              bio: detail.artist_bio ?? "",
              imageUrl: detail.artist_bio_image_url ?? null,
            },
          ],
    reviewNote: detail.review_note || "Chưa có ghi chú",
    ticketTypes: detail.ticket_types,
  };
}

export function approveResultTitle(result: ApproveOrganizerRequestResult) {
  return `Concert ${result.concert.title} hiện là bản nháp. Hãy lưu các mật khẩu này trước khi rời trang.`;
}
