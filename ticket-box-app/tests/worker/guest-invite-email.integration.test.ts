import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@ticketbox/database';
import { closeAllQueues, getEmailQueue, type EmailJobData } from '@ticketbox/queue';
import { sendPendingInviteEmails } from '../../apps/worker-server/src/workers/guest-import.worker.js';

const VENUE_ID = '00000000-0000-0000-0000-000000000101';
const ORGANIZER_ID = '00000000-0000-0000-0000-000000000002';

const createdConcertIds = new Set<string>();

describe('guest invite email after import', () => {
  afterAll(async () => {
    for (const id of createdConcertIds) {
      await prisma.guestList.deleteMany({ where: { concertId: id } });
      await prisma.seatZone.deleteMany({ where: { concertId: id } });
      await prisma.concert.deleteMany({ where: { id } });
    }
    await closeAllQueues();
    await prisma.$disconnect();
  });

  it('enqueues invite email with QR + seat map, generates missing code, and never re-sends', async () => {
    const concertId = crypto.randomUUID();
    createdConcertIds.add(concertId);
    const guestEmail = `guest-invite-${concertId.slice(0, 8)}@example.com`;

    await prisma.concert.create({
      data: {
        id: concertId,
        venueId: VENUE_ID,
        organizerId: ORGANIZER_ID,
        title: `Guest Invite Test ${concertId.slice(0, 8)}`,
        slug: `guest-invite-test-${concertId.slice(0, 8)}`,
        artistName: 'Test Artist',
        startsAt: new Date(Date.now() + 7 * 86_400_000),
        endsAt: new Date(Date.now() + 7 * 86_400_000 + 3 * 3_600_000),
        status: 'PUBLISHED',
        seatMapImageUrl: 'https://cdn.example.com/seat-maps/plan.png',
      },
    });

    // Guest INVITED, chưa có code, chưa gửi mail.
    const guest = await prisma.guestList.create({
      data: {
        concertId,
        email: guestEmail,
        fullName: 'Khách Test',
        status: 'INVITED',
      },
      select: { id: true },
    });

    await sendPendingInviteEmails(concertId);

    const updated = await prisma.guestList.findUniqueOrThrow({
      where: { id: guest.id },
      select: { code: true, inviteEmailSentAt: true },
    });
    // Tự sinh mã mời + đánh dấu đã gửi.
    expect(updated.code).toMatch(/^GUEST-[0-9A-F]{10}$/);
    expect(updated.inviteEmailSentAt).not.toBeNull();

    // Job email nằm trong queue với QR + ảnh sơ đồ đính kèm.
    const jobs = await getEmailQueue().getJobs(['waiting', 'delayed', 'active', 'completed', 'failed']);
    const job = jobs.find((item) => (item.data as EmailJobData).to === guestEmail);
    expect(job).toBeDefined();
    const data = job!.data as EmailJobData;
    expect(data.subject).toContain('Thư mời tham dự');
    expect(data.attachments?.some((a) => a.cid === 'guest-invite-qr')).toBe(true);
    expect(
      data.attachments?.some(
        (a) => a.cid === 'guest-invite-seat-map' && a.path === 'https://cdn.example.com/seat-maps/plan.png',
      ),
    ).toBe(true);
    await job!.remove();

    // Chạy lại (giả lập re-import/scheduler nightly) → không enqueue thêm job nào.
    await sendPendingInviteEmails(concertId);
    const jobsAfter = await getEmailQueue().getJobs(['waiting', 'delayed', 'active', 'completed', 'failed']);
    expect(jobsAfter.filter((item) => (item.data as EmailJobData).to === guestEmail)).toHaveLength(0);
  });
});
