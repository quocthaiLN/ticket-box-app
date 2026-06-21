/**
 * mailer.ts — Transporter SMTP dùng chung cho worker-server.
 *
 * Đây là nơi DUY NHẤT gửi email thật. api-server chỉ render nội dung rồi
 * enqueue (queue `email`); worker tiêu thụ job và gọi `sendEmail` ở đây.
 */

import nodemailer from "nodemailer";
import type { EmailJobData } from "@ticketbox/queue";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Gửi một email. Throw nếu SMTP lỗi để worker BullMQ retry theo backoff.
 */
export async function sendEmail(data: EmailJobData): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "TicketBox <noreply@ticketbox.vn>",
    to: data.to,
    subject: data.subject,
    text: data.text,
    html: data.html,
  });
}
