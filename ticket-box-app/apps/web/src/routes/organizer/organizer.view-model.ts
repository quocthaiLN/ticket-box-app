import type {
  ApprovalStatus,
  OrganizerAnalytics,
  OrganizerCheckerAccount,
  OrganizerConcert,
  OrganizerOrder,
  OrganizerRequestDetail,
  OrganizerRequestSummary,
} from "../../services/organizer.service";

export type OrganizerStatsView = {
  revenue: number;
  sold: number;
  drafts: number;
  pending: number;
};

export type OrganizerRequestView = {
  id: string;
  title: string;
  artistName: string;
  status: ApprovalStatus;
  statusLabel: string;
  submittedAt: string;
  startsAt: string;
  gateCount: number;
  checkerCount: number;
  concertId?: string | null;
};

export type OrganizerConcertView = {
  id: string;
  title: string;
  slug: string;
  artistName: string;
  status: OrganizerConcert["status"];
  statusLabel: string;
  startsAt: string;
  venueName: string;
  coverImageUrl?: string;
};

export type OrganizerConcertPerformanceView = OrganizerConcertView & {
  revenue: number;
  ticketsSold: number;
  ticketsTotal: number;
  checkedIn: number;
  checkInRate: number;
  soldPercent: number;
};

export function toOrganizerStatsView(input: {
  orders: OrganizerOrder[];
  analytics: Record<string, OrganizerAnalytics>;
  concerts: OrganizerConcert[];
  requests: OrganizerRequestSummary[];
}): OrganizerStatsView {
  return {
    revenue: input.orders
      .filter((order) => order.status === "CONFIRMED")
      .reduce((sum, order) => sum + Number(order.total_amount.amount || 0), 0),
    sold: Object.values(input.analytics).reduce((sum, item) => sum + item.tickets_sold, 0),
    drafts: input.concerts.filter((concert) => concert.status === "DRAFT").length,
    pending: input.requests.filter((request) => request.status === "PENDING").length,
  };
}

export function toOrganizerRequestView(request: OrganizerRequestSummary): OrganizerRequestView {
  return {
    id: request.id,
    title: request.title,
    artistName: request.artist_name,
    status: request.status,
    statusLabel: approvalStatusLabel(request.status),
    submittedAt: request.created_at,
    startsAt: request.starts_at,
    gateCount: request.gate_count,
    checkerCount: request.checker_count,
    concertId: request.concert_id,
  };
}

export function toOrganizerConcertView(concert: OrganizerConcert): OrganizerConcertView {
  return {
    id: concert.id,
    title: concert.title,
    slug: concert.slug,
    artistName: concert.artist_name,
    status: concert.status,
    statusLabel: concertStatusLabel(concert.status),
    startsAt: concert.starts_at,
    venueName: concert.venue.name,
    coverImageUrl: concert.cover_image_url,
  };
}

export function normalizeOrganizerRequestDetail(detail?: OrganizerRequestDetail) {
  if (!detail) return undefined;
  return {
    ...toOrganizerRequestView(detail),
    description: detail.description || "Chưa có mô tả.",
    venueId: detail.venue_id,
    plannedPublishAt: detail.planned_publish_at,
    reviewNote: detail.review_note,
    ticketTypes: detail.ticket_types,
    pressKitUrl: detail.press_kit_url,
  };
}

export function toOrganizerConcertPerformanceView(
  concert: OrganizerConcert,
  analytics?: OrganizerAnalytics,
): OrganizerConcertPerformanceView {
  const ticketsTotal = analytics?.tickets_total ?? 0;
  const ticketsSold = analytics?.tickets_sold ?? 0;

  return {
    ...toOrganizerConcertView(concert),
    revenue: analytics?.revenue.amount ?? 0,
    ticketsSold,
    ticketsTotal,
    checkedIn: analytics?.checked_in ?? 0,
    checkInRate: analytics?.check_in_rate ?? 0,
    soldPercent: ticketsTotal > 0 ? Math.round((ticketsSold / ticketsTotal) * 100) : 0,
  };
}

export function approvalStatusLabel(value: ApprovalStatus | "all") {
  const labels: Record<ApprovalStatus | "all", string> = {
    all: "Tất cả",
    PENDING: "Chờ duyệt",
    APPROVED: "Đã duyệt",
    REJECTED: "Từ chối",
  };
  return labels[value];
}

export function concertStatusLabel(value: OrganizerConcert["status"] | "all") {
  const labels: Record<OrganizerConcert["status"] | "all", string> = {
    all: "Tất cả",
    DRAFT: "Nháp",
    PUBLISHED: "Đã đăng",
    CANCELLED: "Đã hủy",
    COMPLETED: "Hoàn tất",
  };
  return labels[value];
}

export function checkerCountLabel(checkers: OrganizerCheckerAccount[]) {
  return `${checkers.length.toLocaleString("vi-VN")} tài khoản`;
}
