import nodemailer from "nodemailer";

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const host = process.env.SMTP_HOST;

  if (!host) {
    console.log(`[DEV] OTP for ${to} : ${code}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "TicketBox <noreply@ticketbox.vn>",
    to,
    subject: "[TicketBox] Mã xác thực đăng ký",
    text: `Mã OTP của bạn là: ${code}\n\nMã này có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.`,
    html: `<p>Mã OTP của bạn là: <strong>${code}</strong></p><p>Mã này có hiệu lực trong <strong>5 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>`,
  });
}
