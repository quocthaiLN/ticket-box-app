/**
 * email.ts — Soạn nội dung email (không gửi).
 *
 * Việc gửi thật được tách sang worker-server: api-server chỉ render nội dung
 * rồi enqueue vào queue `email` (xem @ticketbox/queue `enqueueEmail`).
 */

export function buildOtpEmail(code: string): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: "[TicketBox] Mã xác thực đăng ký",
    text: `Mã OTP của bạn là: ${code}\n\nMã này có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.`,
    html: `<p>Mã OTP của bạn là: <strong>${code}</strong></p><p>Mã này có hiệu lực trong <strong>5 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>`,
  };
}
