/**
 * mailer.ts — Transporter SMTP dùng chung cho worker-server.
 *
 * Đây là nơi DUY NHẤT gửi email thật. api-server chỉ render nội dung rồi
 * enqueue (queue `email`); worker tiêu thụ job và gọi `sendEmail` ở đây.
 */

import nodemailer from "nodemailer";
import { env } from "@ticketbox/config";
import type { EmailJobData } from "@ticketbox/queue";

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.secure,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

/**
 * Gửi một email. Throw nếu SMTP lỗi để worker BullMQ retry theo backoff.
 */
export async function sendEmail(data: EmailJobData): Promise<void> {
  await transporter.sendMail({
    from: env.smtp.from,
    to: data.to,
    subject: data.subject,
    text: data.text,
    html: data.html,
  });
}
