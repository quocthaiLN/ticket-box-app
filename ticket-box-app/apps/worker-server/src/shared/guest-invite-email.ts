/**
 * guest-invite-email.ts — render email mời khách tham dự concert.
 *
 * "Vé" của khách mời = mã mời (GuestList.code) hiển thị dạng QR để checker
 * quét tại cổng. Ảnh sơ đồ chỗ ngồi (nếu concert có) được đính kèm + nhúng
 * inline qua Content-ID.
 */

import QRCode from "qrcode";
import { env } from "@ticketbox/config";
import type { EmailAttachment, EmailJobData } from "@ticketbox/queue";

export type GuestInviteConcertInfo = {
  /** ID concert — dựng link tải vé public. */
  id: string;
  title: string;
  venueName: string;
  venueAddress?: string;
  startsAt: Date;
  /** Ảnh sơ đồ chỗ ngồi (PNG/JPEG) — đính kèm nếu có. */
  seatMapImageUrl?: string | null;
};

export type GuestInviteGuestInfo = {
  fullName: string;
  email: string;
  code: string;
};

const QR_CID = "guest-invite-qr";
const SEAT_MAP_CID = "guest-invite-seat-map";

function formatVietnamTime(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Dựng EmailJobData hoàn chỉnh (subject/text/html/attachments) cho một khách mời. */
export async function buildGuestInviteEmail(
  guest: GuestInviteGuestInfo,
  concert: GuestInviteConcertInfo,
): Promise<EmailJobData> {
  // QR chứa mã mời — checker quét tại cổng (cùng mã với luồng check-in guest).
  const qrPngBase64 = (
    await QRCode.toBuffer(guest.code, { type: "png", width: 320, margin: 2 })
  ).toString("base64");

  const attachments: EmailAttachment[] = [
    {
      filename: "ma-moi-qr.png",
      content: qrPngBase64,
      encoding: "base64",
      contentType: "image/png",
      cid: QR_CID,
    },
  ];

  if (concert.seatMapImageUrl) {
    attachments.push({
      filename: "so-do-cho-ngoi.png",
      path: concert.seatMapImageUrl, // nodemailer tự tải từ URL/đường dẫn
      cid: SEAT_MAP_CID,
    });
  }

  // Link public tải vé (ảnh QR) — mã mời là bí mật nên link chỉ khách này dùng được.
  const ticketDownloadUrl =
    `${env.api.publicUrl}/v1/guest-tickets/download` +
    `?concert_id=${encodeURIComponent(concert.id)}&code=${encodeURIComponent(guest.code)}`;

  const when = formatVietnamTime(concert.startsAt);
  const venueLine = concert.venueAddress
    ? `${concert.venueName} — ${concert.venueAddress}`
    : concert.venueName;

  const subject = `Thư mời tham dự ${concert.title}`;

  const text = [
    `Xin chào ${guest.fullName},`,
    "",
    `Bạn được mời tham dự concert "${concert.title}".`,
    `Thời gian: ${when}`,
    `Địa điểm: ${venueLine}`,
    `Khu vực: Khu khách mời (GUEST)`,
    `Mã mời của bạn: ${guest.code}`,
    "",
    "Vui lòng xuất trình mã QR đính kèm (hoặc đọc mã mời) tại cổng check-in.",
    `Tải vé của bạn tại: ${ticketDownloadUrl}`,
    concert.seatMapImageUrl ? "Sơ đồ chỗ ngồi được đính kèm trong email này." : "",
    "",
    "Hẹn gặp bạn tại sự kiện!",
    "TicketBox",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1c28">
  <h2 style="color:#7B61FF;margin-bottom:4px">Thư mời tham dự</h2>
  <h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(concert.title)}</h1>
  <p>Xin chào <strong>${escapeHtml(guest.fullName)}</strong>,</p>
  <p>Bạn được mời tham dự concert với thông tin sau:</p>
  <table style="border-collapse:collapse;width:100%;margin:12px 0">
    <tr><td style="padding:6px 8px;color:#666">Thời gian</td><td style="padding:6px 8px"><strong>${escapeHtml(when)}</strong></td></tr>
    <tr><td style="padding:6px 8px;color:#666">Địa điểm</td><td style="padding:6px 8px"><strong>${escapeHtml(venueLine)}</strong></td></tr>
    <tr><td style="padding:6px 8px;color:#666">Khu vực</td><td style="padding:6px 8px"><strong>Khu khách mời (GUEST)</strong></td></tr>
    <tr><td style="padding:6px 8px;color:#666">Mã mời</td><td style="padding:6px 8px"><strong style="font-size:16px;letter-spacing:1px">${escapeHtml(guest.code)}</strong></td></tr>
  </table>
  <p>Xuất trình mã QR dưới đây tại cổng check-in:</p>
  <p style="text-align:center;margin:16px 0"><img src="cid:${QR_CID}" alt="QR mã mời" width="220" height="220" style="border:1px solid #eee;border-radius:8px"/></p>
  <p style="text-align:center;margin:16px 0">
    <a href="${escapeHtml(ticketDownloadUrl)}" style="display:inline-block;background:#7B61FF;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:bold">Tải vé của bạn</a>
  </p>
  ${
    concert.seatMapImageUrl
      ? `<p>Sơ đồ chỗ ngồi:</p><p style="text-align:center;margin:16px 0"><img src="cid:${SEAT_MAP_CID}" alt="Sơ đồ chỗ ngồi" style="max-width:100%;border:1px solid #eee;border-radius:8px"/></p>`
      : ""
  }
  <p style="margin-top:24px">Hẹn gặp bạn tại sự kiện!<br/>TicketBox</p>
</div>`.trim();

  return { to: guest.email, subject, text, html, attachments };
}
