import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const userIds = {
  audience: "00000000-0000-0000-0000-000000000001",
  organizer: "00000000-0000-0000-0000-000000000002",
  checker: "00000000-0000-0000-0000-000000000003",
  admin: "00000000-0000-0000-0000-000000000004",
};

const zoneCodes = ["SVIP", "VIP", "CAT1", "CAT2", "GA"];

const concerts = [
  {
    id: "00000000-0000-0000-0000-000000000201",
    venueId: "00000000-0000-0000-0000-000000000101",
    title: "Anh Trai Say Hi",
    slug: "anh-trai-say-hi",
    artistBio: "Bio ngắn dùng cho demo catalog Anh Trai Say Hi.",
    startsAt: "2026-07-25T19:30:00+07:00",
    endsAt: "2026-07-25T23:00:00+07:00",
    prices: [3500000, 2500000, 1800000, 1200000, 900000],
    quantities: [200, 1800, 6000, 10000, 14000],
  },
  {
    id: "00000000-0000-0000-0000-000000000202",
    venueId: "00000000-0000-0000-0000-000000000102",
    title: "Anh Trai Vượt Ngàn Chông Gai",
    slug: "anh-trai-vuot-ngan-chong-gai",
    artistBio: "Bio ngắn dùng cho demo Anh Trai Vượt Ngàn Chông Gai.",
    startsAt: "2026-08-08T19:30:00+07:00",
    endsAt: "2026-08-08T23:00:00+07:00",
    prices: [3000000, 2200000, 1600000, 1000000, 750000],
    quantities: [250, 600, 1200, 1500, 1200],
  },
  {
    id: "00000000-0000-0000-0000-000000000203",
    venueId: "00000000-0000-0000-0000-000000000103",
    title: "Em Xinh Say Hi",
    slug: "em-xinh-say-hi",
    artistBio: "Bio ngắn dùng cho demo Em Xinh Say Hi.",
    startsAt: "2026-09-12T19:30:00+07:00",
    endsAt: "2026-09-12T23:00:00+07:00",
    prices: [3200000, 2300000, 1700000, 1100000, 800000],
    quantities: [500, 1200, 3000, 3300, 4000],
  },
  {
    id: "00000000-0000-0000-0000-000000000204",
    venueId: "00000000-0000-0000-0000-000000000104",
    title: "Chị Đẹp Đạp Gió Rẽ Sóng",
    slug: "chi-dep-dap-gio-re-song",
    artistBio: "Bio ngắn dùng cho demo Chị Đẹp Đạp Gió Rẽ Sóng.",
    startsAt: "2026-10-03T19:30:00+07:00",
    endsAt: "2026-10-03T23:00:00+07:00",
    prices: [3400000, 2400000, 1750000, 1150000, 850000],
    quantities: [400, 1600, 6000, 8000, 9000],
  },
];

const venues = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    name: "Sân vận động Quốc gia Mỹ Đình",
    address: "Đường Lê Đức Thọ, Nam Từ Liêm",
    city: "Hà Nội",
    capacity: 40000,
    mapUrl: "https://maps.example.com/my-dinh",
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    name: "Nhà thi đấu Phú Thọ",
    address: "221 Lý Thường Kiệt, Quận 11",
    city: "TP. Hồ Chí Minh",
    capacity: 5000,
    mapUrl: "https://maps.example.com/phu-tho",
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    name: "SECC Hall A",
    address: "799 Nguyễn Văn Linh, Quận 7",
    city: "TP. Hồ Chí Minh",
    capacity: 12000,
    mapUrl: "https://maps.example.com/secc",
  },
  {
    id: "00000000-0000-0000-0000-000000000104",
    name: "Sân vận động Quân khu 7",
    address: "202 Hoàng Văn Thụ, Tân Bình",
    city: "TP. Hồ Chí Minh",
    capacity: 25000,
    mapUrl: "https://maps.example.com/qk7",
  },
];

const fixedId = (number) =>
  `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`;

const zoneId = (concertIndex, zoneIndex) => fixedId(301 + concertIndex * 5 + zoneIndex);
const gateId = (concertIndex, zoneIndex) => fixedId(401 + concertIndex * 5 + zoneIndex);
const ticketTypeId = (concertIndex, zoneIndex) => fixedId(501 + concertIndex * 5 + zoneIndex);

async function seedUsers() {
  const users = [
    ["audience", "audience@ticketbox.test", "Demo Audience", "+84900000001", "AUDIENCE"],
    ["organizer", "organizer@ticketbox.test", "Demo Organizer", "+84900000002", "ORGANIZER"],
    ["checker", "checker@ticketbox.test", "Demo Checker", "+84900000003", "CHECKER"],
    ["admin", "admin@ticketbox.test", "Demo Admin", "+84900000004", "ADMIN"],
  ];

  for (const [key, email, fullName, phone, role] of users) {
    await prisma.user.upsert({
      where: { id: userIds[key] },
      create: {
        id: userIds[key],
        email,
        passwordHash: `$2b$10$demo-${key}`,
        fullName,
        phone,
        role,
        status: "ACTIVE",
      },
      update: {
        email,
        fullName,
        phone,
        role,
        status: "ACTIVE",
      },
    });
  }
}

async function seedCatalog() {
  for (const venue of venues) {
    await prisma.venue.upsert({
      where: { id: venue.id },
      create: venue,
      update: venue,
    });
  }

  for (const [concertIndex, concert] of concerts.entries()) {
    await prisma.concert.upsert({
      where: { id: concert.id },
      create: {
        id: concert.id,
        venueId: concert.venueId,
        organizerId: userIds.organizer,
        title: concert.title,
        slug: concert.slug,
        description: "Concert demo cho hệ thống TicketBox.",
        artistName: "Various Artists",
        artistBio: concert.artistBio,
        startsAt: new Date(concert.startsAt),
        endsAt: new Date(concert.endsAt),
        status: "PUBLISHED",
        coverImageUrl: `https://cdn.example.com/ticketbox/${concert.slug}.jpg`,
        seatMapUrl: `https://cdn.example.com/ticketbox/seat-maps/${concert.slug}.svg`,
      },
      update: {
        venueId: concert.venueId,
        organizerId: userIds.organizer,
        title: concert.title,
        slug: concert.slug,
        description: "Concert demo cho hệ thống TicketBox.",
        artistName: "Various Artists",
        artistBio: concert.artistBio,
        startsAt: new Date(concert.startsAt),
        endsAt: new Date(concert.endsAt),
        status: "PUBLISHED",
        coverImageUrl: `https://cdn.example.com/ticketbox/${concert.slug}.jpg`,
        seatMapUrl: `https://cdn.example.com/ticketbox/seat-maps/${concert.slug}.svg`,
      },
    });

    for (const [zoneIndex, code] of zoneCodes.entries()) {
      await prisma.seatZone.upsert({
        where: { id: zoneId(concertIndex, zoneIndex) },
        create: {
          id: zoneId(concertIndex, zoneIndex),
          concertId: concert.id,
          code,
          name: code === "GA" ? "General Admission" : code,
          description: `Khu ${code} demo.`,
          capacity: concert.quantities[zoneIndex],
          svgPath: `M${10 + zoneIndex * 60} 10 H${70 + zoneIndex * 60} V90 H${10 + zoneIndex * 60} Z`,
          sortOrder: zoneIndex + 1,
        },
        update: {
          concertId: concert.id,
          code,
          name: code === "GA" ? "General Admission" : code,
          description: `Khu ${code} demo.`,
          capacity: concert.quantities[zoneIndex],
          svgPath: `M${10 + zoneIndex * 60} 10 H${70 + zoneIndex * 60} V90 H${10 + zoneIndex * 60} Z`,
          sortOrder: zoneIndex + 1,
        },
      });

      await prisma.checkinGate.upsert({
        where: { id: gateId(concertIndex, zoneIndex) },
        create: {
          id: gateId(concertIndex, zoneIndex),
          concertId: concert.id,
          code: `${code}_GATE`,
          name: `Cổng ${code}`,
          description: `Cổng dành cho khu ${code}.`,
          isActive: true,
          sortOrder: zoneIndex + 1,
        },
        update: {
          concertId: concert.id,
          code: `${code}_GATE`,
          name: `Cổng ${code}`,
          description: `Cổng dành cho khu ${code}.`,
          isActive: true,
          sortOrder: zoneIndex + 1,
        },
      });

      await prisma.checkinGateZone.upsert({
        where: {
          gateId_seatZoneId: {
            gateId: gateId(concertIndex, zoneIndex),
            seatZoneId: zoneId(concertIndex, zoneIndex),
          },
        },
        create: {
          gateId: gateId(concertIndex, zoneIndex),
          seatZoneId: zoneId(concertIndex, zoneIndex),
          concertId: concert.id,
        },
        update: {
          concertId: concert.id,
        },
      });

      await prisma.ticketType.upsert({
        where: { id: ticketTypeId(concertIndex, zoneIndex) },
        create: {
          id: ticketTypeId(concertIndex, zoneIndex),
          concertId: concert.id,
          seatZoneId: zoneId(concertIndex, zoneIndex),
          name: `${code} Standard`,
          description: `Vé ${code} demo.`,
          price: concert.prices[zoneIndex],
          currency: "VND",
          totalQuantity: concert.quantities[zoneIndex],
          heldQuantity: 0,
          soldQuantity: code === "VIP" ? 1 : 0,
          maxPerUser: code === "SVIP" || code === "VIP" ? 2 : 4,
          saleStartAt: new Date("2026-06-01T10:00:00+07:00"),
          saleEndAt: new Date("2026-12-31T23:59:59+07:00"),
          status: "ON_SALE",
        },
        update: {
          concertId: concert.id,
          seatZoneId: zoneId(concertIndex, zoneIndex),
          name: `${code} Standard`,
          description: `Vé ${code} demo.`,
          price: concert.prices[zoneIndex],
          currency: "VND",
          totalQuantity: concert.quantities[zoneIndex],
          heldQuantity: 0,
          soldQuantity: code === "VIP" ? 1 : 0,
          maxPerUser: code === "SVIP" || code === "VIP" ? 2 : 4,
          saleStartAt: new Date("2026-06-01T10:00:00+07:00"),
          saleEndAt: new Date("2026-12-31T23:59:59+07:00"),
          status: "ON_SALE",
        },
      });
    }
  }
}

async function seedOrdersAndTickets() {
  for (const [concertIndex, concert] of concerts.entries()) {
    const orderId = fixedId(601 + concertIndex);
    const orderItemId = fixedId(611 + concertIndex);
    const paymentId = fixedId(621 + concertIndex);
    const ticketId = fixedId(631 + concertIndex);
    const vipTicketTypeId = ticketTypeId(concertIndex, 1);
    const vipZoneId = zoneId(concertIndex, 1);
    const amount = concert.prices[1];

    await prisma.order.upsert({
      where: { id: orderId },
      create: {
        id: orderId,
        userId: userIds.audience,
        concertId: concert.id,
        idempotencyKey: `seed-order-${concert.slug}`,
        status: "CONFIRMED",
        totalAmount: amount,
        currency: "VND",
        confirmedAt: new Date("2026-06-02T10:00:00+07:00"),
      },
      update: {
        userId: userIds.audience,
        concertId: concert.id,
        idempotencyKey: `seed-order-${concert.slug}`,
        status: "CONFIRMED",
        totalAmount: amount,
        currency: "VND",
        confirmedAt: new Date("2026-06-02T10:00:00+07:00"),
      },
    });

    await prisma.orderItem.upsert({
      where: { id: orderItemId },
      create: {
        id: orderItemId,
        orderId,
        ticketTypeId: vipTicketTypeId,
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
      },
      update: {
        orderId,
        ticketTypeId: vipTicketTypeId,
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
      },
    });

    await prisma.payment.upsert({
      where: { id: paymentId },
      create: {
        id: paymentId,
        orderId,
        provider: concertIndex < 2 ? "VNPAY" : "MOMO",
        providerTransactionId: `${concertIndex < 2 ? "VNPAY" : "MOMO"}-SEED-00${concertIndex + 1}`,
        idempotencyKey: `seed-payment-${concert.slug}`,
        amount,
        currency: "VND",
        status: "SUCCEEDED",
        checkoutUrl: `https://sandbox-payments.example.com/${concert.slug}`,
        providerPayload: { seed: true },
        webhookPayload: { seed: true, status: "success" },
        webhookReceivedAt: new Date("2026-06-02T10:03:00+07:00"),
        webhookSignatureValid: true,
        paidAt: new Date("2026-06-02T10:03:00+07:00"),
      },
      update: {
        orderId,
        amount,
        status: "SUCCEEDED",
        paidAt: new Date("2026-06-02T10:03:00+07:00"),
        webhookReceivedAt: new Date("2026-06-02T10:03:00+07:00"),
        webhookSignatureValid: true,
      },
    });

    await prisma.ticket.upsert({
      where: { id: ticketId },
      create: {
        id: ticketId,
        orderId,
        orderItemId,
        userId: userIds.audience,
        concertId: concert.id,
        ticketTypeId: vipTicketTypeId,
        seatZoneId: vipZoneId,
        qrTokenHash: `qr-seed-${concert.slug}-vip-001`,
        qrPayload: { ticket_id: ticketId },
        qrSignature: "demo-signature",
        status: "ISSUED",
        issuedAt: new Date("2026-06-02T10:05:00+07:00"),
      },
      update: {
        orderId,
        orderItemId,
        userId: userIds.audience,
        concertId: concert.id,
        ticketTypeId: vipTicketTypeId,
        seatZoneId: vipZoneId,
        qrTokenHash: `qr-seed-${concert.slug}-vip-001`,
        qrPayload: { ticket_id: ticketId },
        qrSignature: "demo-signature",
        status: "ISSUED",
        issuedAt: new Date("2026-06-02T10:05:00+07:00"),
      },
    });

    await prisma.userTicketTypeCounter.upsert({
      where: {
        userId_ticketTypeId: {
          userId: userIds.audience,
          ticketTypeId: vipTicketTypeId,
        },
      },
      create: {
        userId: userIds.audience,
        ticketTypeId: vipTicketTypeId,
        heldQuantity: 0,
        paidQuantity: 1,
      },
      update: {
        heldQuantity: 0,
        paidQuantity: 1,
      },
    });
  }
}

async function seedOperations() {
  for (const [concertIndex, concert] of concerts.entries()) {
    await prisma.checkinDevice.upsert({
      where: { id: fixedId(641 + concertIndex) },
      create: {
        id: fixedId(641 + concertIndex),
        deviceCode: `CHECKER-${concert.slug}-VIP`,
        staffId: userIds.checker,
        concertId: concert.id,
        gateId: gateId(concertIndex, 1),
        name: `Demo checker device - ${concert.title}`,
        status: "ACTIVE",
        lastSeenAt: new Date("2026-06-02T11:00:00+07:00"),
      },
      update: {
        deviceCode: `CHECKER-${concert.slug}-VIP`,
        staffId: userIds.checker,
        concertId: concert.id,
        gateId: gateId(concertIndex, 1),
        name: `Demo checker device - ${concert.title}`,
        status: "ACTIVE",
        lastSeenAt: new Date("2026-06-02T11:00:00+07:00"),
      },
    });

    const importJobId = fixedId(651 + concertIndex);
    await prisma.guestImportJob.upsert({
      where: { id: importJobId },
      create: {
        id: importJobId,
        concertId: concert.id,
        uploadedById: userIds.organizer,
        fileUrl: `https://storage.example.com/imports/${concert.slug}-guests.csv`,
        status: concertIndex === 0 ? "PARTIAL" : "DONE",
        totalRows: concertIndex === 0 ? 3 : 2,
        successRows: 2,
        errorRows: concertIndex === 0 ? 1 : 0,
        startedAt: new Date("2026-06-02T09:00:00+07:00"),
        completedAt: new Date("2026-06-02T09:01:00+07:00"),
      },
      update: {
        fileUrl: `https://storage.example.com/imports/${concert.slug}-guests.csv`,
        status: concertIndex === 0 ? "PARTIAL" : "DONE",
        totalRows: concertIndex === 0 ? 3 : 2,
        successRows: 2,
        errorRows: concertIndex === 0 ? 1 : 0,
      },
    });

    for (const [guestOffset, code] of ["VIP", "SVIP"].entries()) {
      const guestId = fixedId(661 + concertIndex * 2 + guestOffset);
      await prisma.guestList.upsert({
        where: { id: guestId },
        create: {
          id: guestId,
          concertId: concert.id,
          seatZoneId: zoneId(concertIndex, code === "VIP" ? 1 : 0),
          importJobId,
          fullName: `Demo Guest ${concertIndex + 1}-${guestOffset + 1}`,
          phone: `+84910000${concertIndex + 1}${String(guestOffset + 1).padStart(2, "0")}`,
          email: `guest-${concertIndex + 1}-${guestOffset + 1}@example.com`,
          code: `GUEST-${concert.slug.toUpperCase()}-${guestOffset + 1}`,
          status: "INVITED",
          note: "Demo guest",
        },
        update: {
          seatZoneId: zoneId(concertIndex, code === "VIP" ? 1 : 0),
          importJobId,
          status: "INVITED",
          note: "Demo guest",
        },
      });
    }

    await prisma.artistBioJob.upsert({
      where: { id: fixedId(681 + concertIndex) },
      create: {
        id: fixedId(681 + concertIndex),
        concertId: concert.id,
        requestedById: userIds.organizer,
        status: concertIndex < 2 ? "DONE" : concertIndex === 2 ? "PROCESSING" : "PENDING",
        sourceFileUrl: `https://storage.example.com/artist-bio/${concert.slug}.pdf`,
        extractedText: concertIndex < 3 ? "Press kit demo." : null,
        generatedBio: concertIndex < 2 ? `Generated bio for ${concert.title}.` : null,
      },
      update: {
        status: concertIndex < 2 ? "DONE" : concertIndex === 2 ? "PROCESSING" : "PENDING",
        sourceFileUrl: `https://storage.example.com/artist-bio/${concert.slug}.pdf`,
        extractedText: concertIndex < 3 ? "Press kit demo." : null,
        generatedBio: concertIndex < 2 ? `Generated bio for ${concert.title}.` : null,
      },
    });
  }

  await prisma.guestImportError.upsert({
    where: { id: fixedId(671) },
    create: {
      id: fixedId(671),
      jobId: fixedId(651),
      rowNumber: 3,
      rawData: { phone: "" },
      errorCode: "PHONE_REQUIRED",
      errorMessage: "Phone is required for guest deduplication.",
    },
    update: {
      rawData: { phone: "" },
      errorCode: "PHONE_REQUIRED",
      errorMessage: "Phone is required for guest deduplication.",
    },
  });

  await prisma.offlineCheckinBatch.upsert({
    where: { id: fixedId(721) },
    create: {
      id: fixedId(721),
      batchToken: "offline-batch-demo-001",
      deviceId: fixedId(641),
      staffId: userIds.checker,
      concertId: concerts[0].id,
      gateId: gateId(0, 1),
      status: "PENDING",
      itemCount: 1,
      acceptedCount: 0,
      conflictCount: 0,
    },
    update: {
      batchToken: "offline-batch-demo-001",
      deviceId: fixedId(641),
      staffId: userIds.checker,
      concertId: concerts[0].id,
      gateId: gateId(0, 1),
      status: "PENDING",
      itemCount: 1,
      acceptedCount: 0,
      conflictCount: 0,
    },
  });

  await prisma.offlineCheckinItem.upsert({
    where: { id: fixedId(731) },
    create: {
      id: fixedId(731),
      batchId: fixedId(721),
      ticketId: fixedId(631),
      qrTokenHash: "qr-seed-anh-trai-say-hi-vip-001",
      gateId: gateId(0, 1),
      seatZoneId: zoneId(0, 1),
      result: "PENDING",
      scannedAt: new Date("2026-06-02T11:05:00+07:00"),
      metadata: { source: "mobile-offline-demo" },
    },
    update: {
      ticketId: fixedId(631),
      qrTokenHash: "qr-seed-anh-trai-say-hi-vip-001",
      gateId: gateId(0, 1),
      seatZoneId: zoneId(0, 1),
      result: "PENDING",
      scannedAt: new Date("2026-06-02T11:05:00+07:00"),
      metadata: { source: "mobile-offline-demo" },
    },
  });
}

async function seedNotificationsAndAudit() {
  const notificationRows = [
    [691, userIds.audience, concerts[0].id, fixedId(631), "EMAIL", "TICKET_ISSUED", "SENT", 1],
    [692, userIds.audience, concerts[1].id, fixedId(632), "APP", "ORDER_CONFIRMED", "PENDING", 0],
    [693, userIds.organizer, concerts[2].id, null, "APP", "ARTIST_BIO_READY", "PENDING", 0],
    [694, userIds.checker, concerts[3].id, null, "SMS", "CHECKIN_ALERT", "FAILED", 2],
  ];

  for (const [id, userId, concertId, ticketId, channel, type, status, attempts] of notificationRows) {
    await prisma.notification.upsert({
      where: { id: fixedId(id) },
      create: {
        id: fixedId(id),
        userId,
        concertId,
        ticketId,
        channel,
        type,
        status,
        payload: { seed: true, type },
        attempts,
        sentAt: status === "SENT" ? new Date("2026-06-02T10:06:00+07:00") : null,
      },
      update: {
        userId,
        concertId,
        ticketId,
        channel,
        type,
        status,
        payload: { seed: true, type },
        attempts,
        sentAt: status === "SENT" ? new Date("2026-06-02T10:06:00+07:00") : null,
      },
    });
  }

  const auditRows = [
    [701, userIds.organizer, "CONCERT_PUBLISHED", "concert", concerts[0].id],
    [702, userIds.organizer, "GUEST_IMPORT_DONE", "guest_import_job", fixedId(652)],
    [703, userIds.admin, "USER_ROLE_SET", "user", userIds.checker],
    [704, userIds.organizer, "ARTIST_BIO_JOB_CREATED", "artist_bio_job", fixedId(681)],
  ];

  for (const [id, actorUserId, action, entityType, entityId] of auditRows) {
    await prisma.auditLog.upsert({
      where: { id: fixedId(id) },
      create: {
        id: fixedId(id),
        actorUserId,
        action,
        entityType,
        entityId,
        metadata: { source: "seed" },
        ipAddress: "127.0.0.1",
        userAgent: "seed.mjs",
      },
      update: {
        actorUserId,
        action,
        entityType,
        entityId,
        metadata: { source: "seed" },
        ipAddress: "127.0.0.1",
        userAgent: "seed.mjs",
      },
    });
  }
}

async function main() {
  await seedUsers();
  await seedCatalog();
  await seedOrdersAndTickets();
  await seedOperations();
  await seedNotificationsAndAudit();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
