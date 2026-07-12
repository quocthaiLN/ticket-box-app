import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGuestInviteEmail } from "../../shared/guest-invite-email.js";

const guest = {
  fullName: "Nguyễn Văn A",
  email: "guest@example.com",
  code: "GUEST-ABC123",
};

const concert = {
  id: "11111111-2222-3333-4444-555555555555",
  title: "Đêm nhạc Mùa Thu",
  venueName: "Nhà hát Hòa Bình",
  venueAddress: "240 Đường 3/2, Q.10, TP.HCM",
  startsAt: new Date("2026-08-01T12:30:00Z"),
};

test("gửi đủ subject/text/html + QR đính kèm khi concert KHÔNG có ảnh sơ đồ", async () => {
  const email = await buildGuestInviteEmail(guest, { ...concert, seatMapImageUrl: null });

  assert.equal(email.to, guest.email);
  assert.match(email.subject, /Đêm nhạc Mùa Thu/);
  assert.match(email.text, /GUEST-ABC123/);
  assert.match(email.text, /Nhà hát Hòa Bình/);
  assert.ok(email.html?.includes("cid:guest-invite-qr"));
  assert.ok(!email.html?.includes("cid:guest-invite-seat-map"));

  // Link tải vé public: đúng route + concert_id + code (đã encode).
  const expectedLink = `/v1/guest-tickets/download?concert_id=${concert.id}&code=GUEST-ABC123`;
  assert.ok(email.text.includes(expectedLink), "text phải chứa link tải vé");
  // Trong HTML, & của query string được escape thành &amp;.
  assert.ok(
    email.html?.includes(expectedLink.replace("&", "&amp;")),
    "html phải chứa link tải vé (đã escape)",
  );

  // Đúng 1 attachment (QR PNG, base64 hợp lệ).
  assert.equal(email.attachments?.length, 1);
  const qr = email.attachments![0];
  assert.equal(qr.contentType, "image/png");
  assert.equal(qr.cid, "guest-invite-qr");
  const decoded = Buffer.from(qr.content!, "base64");
  // PNG magic bytes.
  assert.equal(decoded.subarray(1, 4).toString("ascii"), "PNG");
});

test("đính kèm thêm ảnh sơ đồ khi concert có seatMapImageUrl", async () => {
  const email = await buildGuestInviteEmail(guest, {
    ...concert,
    seatMapImageUrl: "https://cdn.example.com/seat-maps/plan.png",
  });

  assert.equal(email.attachments?.length, 2);
  const seatMap = email.attachments!.find((a) => a.cid === "guest-invite-seat-map");
  assert.ok(seatMap, "phải có attachment sơ đồ chỗ ngồi");
  assert.equal(seatMap!.path, "https://cdn.example.com/seat-maps/plan.png");
  assert.ok(email.html?.includes("cid:guest-invite-seat-map"));
  assert.match(email.text, /Sơ đồ chỗ ngồi/);
});

test("escape HTML trong tên khách/concert để tránh injection vào email", async () => {
  const email = await buildGuestInviteEmail(
    { ...guest, fullName: `<script>alert("x")</script>` },
    { ...concert, title: `A & B <Show>` },
  );
  assert.ok(!email.html?.includes("<script>"));
  assert.ok(email.html?.includes("&lt;script&gt;"));
  assert.ok(email.html?.includes("A &amp; B &lt;Show&gt;"));
});
