import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const userIds = {
  audience: "00000000-0000-0000-0000-000000000001",
  organizer: "00000000-0000-0000-0000-000000000002",
  checker: "00000000-0000-0000-0000-000000000003",
  admin: "00000000-0000-0000-0000-000000000004",
  checkerSecretOne: "00000000-0000-0000-0000-000000000005",
  checkerSecretTwo: "00000000-0000-0000-0000-000000000006",
};

const venues = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    name: "Hoa Binh Theater",
    address: "240 3 Thang 2 Street, District 10",
    city: "Ho Chi Minh City",
    capacity: 3500,
    mapUrl: "https://maps.example.com/hoa-binh",
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    name: "My Dinh National Stadium",
    address: "Pham Hung Street, Nam Tu Liem",
    city: "Hanoi",
    capacity: 40000,
    mapUrl: "https://maps.example.com/my-dinh",
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    name: "SECC - Saigon Exhibition and Convention Center",
    address: "799 Nguyen Van Linh Boulevard, District 7",
    city: "Ho Chi Minh City",
    capacity: 10000,
    mapUrl: "https://maps.example.com/secc",
  },
  {
    id: "00000000-0000-0000-0000-000000000104",
    name: "Hanoi Opera House",
    address: "1 Trang Tien Street, Hoan Kiem",
    city: "Hanoi",
    capacity: 598,
    mapUrl: "https://maps.example.com/opera-house",
  },
];

const concerts = [
  {
    id: "00000000-0000-0000-0000-000000000201",
    venueId: venues[0].id,
    title: "Night Lights",
    slug: "night-lights",
    description:
      "A special Grey D live show where ballads and indie songs move between memories, the present, and quiet personal moments.",
    artistName: "Grey D",
    artistBio:
      "Grey D is one of Vietnam's standout indie voices, known for warm vocals and introspective songwriting.",
    startsAt: "2026-07-15T19:30:00+07:00",
    endsAt: "2026-07-15T22:00:00+07:00",
    plannedPublishAt: "2026-06-10T10:00:00+07:00",
    status: "PUBLISHED",
    coverImageUrl: "/src/img/anh-sang-man-dem.jpg",
    zones: [
      zone("SVIP", "SVIP", "Front row seats with the best stage view.", 100),
      zone("VIP", "VIP", "Comfortable seated area near the stage.", 300),
      zone("CAT1", "CAT 1", "Front standing area.", 800),
      zone("GA", "General Admission", "General standing area.", 2000),
    ],
    tickets: [
      ticket("SVIP", "SVIP", "Priority entry and exclusive poster.", 2950000, 100, 5, 68, 2),
      ticket("VIP", "VIP", "Premium seat and gift bag.", 1950000, 300, 12, 201, 2),
      ticket("CAT1", "CAT 1", "Front standing access.", 1250000, 800, 30, 420, 4),
      ticket("GA", "GA", "Standard standing ticket.", 750000, 2000, 80, 1100, 4),
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000202",
    venueId: venues[1].id,
    title: "Passing Through Memories Live Concert",
    slug: "passing-through-memories",
    description:
      "An outdoor pop ballad night that travels through songs loved by multiple generations of audiences.",
    artistName: "My Tam",
    artistBio:
      "My Tam is a Vietnamese music icon with more than 20 years of performing and many landmark live concerts.",
    startsAt: "2026-08-20T18:00:00+07:00",
    endsAt: "2026-08-20T21:30:00+07:00",
    plannedPublishAt: "2026-07-01T10:00:00+07:00",
    status: "PUBLISHED",
    coverImageUrl: "/src/img/di-qua-thuong-nho.jpg",
    zones: [
      zone("SVIP", "SVIP Diamond", "Exclusive seats closest to the stage.", 500),
      zone("VIP", "VIP Gold", "Covered seating with a premium view.", 2000),
      zone("CAT1", "CAT 1", "Front tribune seating.", 5000),
      zone("CAT2", "CAT 2", "Rear tribune seating.", 8000),
      zone("GA", "General Admission", "Open standing area.", 20000),
    ],
    tickets: [
      ticket("SVIP", "SVIP Diamond", "VIP seat, welcoming gift, and early access.", 3500000, 500, 10, 320, 2),
      ticket("VIP", "VIP Gold", "Covered seating area.", 2200000, 2000, 40, 1450, 4),
      ticket("CAT1", "CAT 1", "Front tribune seating.", 1500000, 5000, 100, 3200, 4),
      ticket("CAT2", "CAT 2", "Rear tribune seating.", 1000000, 8000, 150, 5200, 6),
      ticket("GA", "GA", "Open standing ticket.", 650000, 20000, 500, 12000, 6),
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000203",
    venueId: venues[2].id,
    title: "Our 20th Moment 2026",
    slug: "our-20th-moment-2026",
    description:
      "A special acoustic and orchestral evening where memories are reimagined through pure musical language.",
    artistName: "Thanh Lam & Ha Tran",
    artistBio:
      "Thanh Lam and Ha Tran are two major Vietnamese voices, coming together for a refined and emotional performance.",
    startsAt: "2026-09-05T19:00:00+07:00",
    endsAt: "2026-09-05T22:30:00+07:00",
    plannedPublishAt: "2026-07-20T10:00:00+07:00",
    status: "PUBLISHED",
    coverImageUrl: "/src/img/our-20th-moment-2026.jpg",
    zones: [
      zone("SVIP", "SVIP", "Front row seating with cocktail reception.", 200),
      zone("VIP", "VIP", "Premium seating.", 800),
      zone("CAT1", "CAT 1", "Section B seating.", 2500),
      zone("GA", "Standing", "Rear standing area.", 5000),
    ],
    tickets: [
      ticket("SVIP", "SVIP", "Cocktail reception and meet-and-greet opportunity.", 5500000, 200, 3, 187, 2),
      ticket("VIP", "VIP", "Premium seat with programme book.", 3200000, 800, 20, 650, 2),
      ticket("CAT1", "CAT 1", "Standard seated ticket.", 1800000, 2500, 50, 1900, 4),
      ticket("GA", "Standing", "Open standing area.", 900000, 5000, 120, 3200, 4),
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000204",
    venueId: venues[3].id,
    title: "Once We Loved",
    slug: "once-we-loved",
    description:
      "An intimate acoustic night with melodies from an earlier era and love songs that have become shared memories.",
    artistName: "Lam Truong",
    artistBio:
      "Lam Truong is one of the most beloved Vietnamese male singers from the 1990s and 2000s.",
    startsAt: "2026-10-12T19:30:00+07:00",
    endsAt: "2026-10-12T22:00:00+07:00",
    plannedPublishAt: "2026-08-15T10:00:00+07:00",
    status: "PUBLISHED",
    coverImageUrl: "/src/img/mot-thoi-da-yeu.jpg",
    zones: [
      zone("VIP", "VIP Front Row", "Front row seats with artist interaction.", 60),
      zone("CAT1", "CAT 1", "Middle rows.", 200),
      zone("CAT2", "CAT 2", "Rear rows.", 320),
    ],
    tickets: [
      ticket("VIP", "VIP Front Row", "Post-show interaction and signing.", 2500000, 60, 2, 55, 2),
      ticket("CAT1", "CAT 1", "Premium seated ticket.", 1500000, 200, 5, 168, 2),
      ticket("CAT2", "CAT 2", "Standard seated ticket.", 900000, 320, 10, 245, 4),
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000205",
    venueId: venues[0].id,
    title: "Where Love Begins",
    slug: "where-love-begins",
    description:
      "Bich Phuong performs her newest songs alongside the hits that have stayed close to audiences for years.",
    artistName: "Bich Phuong",
    artistBio:
      "Bich Phuong is a standout Vietnamese pop singer known for catchy songs and a modern stage style.",
    startsAt: "2026-11-08T19:30:00+07:00",
    endsAt: "2026-11-08T21:30:00+07:00",
    plannedPublishAt: "2026-09-01T10:00:00+07:00",
    status: "PUBLISHED",
    coverImageUrl: "/src/img/noi-tinh-yeu-bat-dau.jpg",
    zones: [
      zone("SVIP", "SVIP", "VIP stage view.", 150),
      zone("VIP", "VIP", "Seated section.", 400),
      zone("GA", "GA", "Standing area.", 2500),
    ],
    tickets: [
      ticket("SVIP", "SVIP", "Gift set and early access.", 2200000, 150, 8, 95, 2),
      ticket("VIP", "VIP", "Seated section.", 1500000, 400, 15, 280, 2),
      ticket("GA", "GA", "Standing section.", 850000, 2500, 60, 1800, 4),
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000206",
    venueId: venues[1].id,
    title: "Coming Soon: Secret Show",
    slug: "secret-show-2026",
    description: "A mysterious show is being prepared. Details will be announced soon.",
    artistName: "TBA",
    artistBio: "",
    startsAt: "2026-12-31T20:00:00+07:00",
    endsAt: "2026-12-31T23:59:00+07:00",
    plannedPublishAt: "2026-12-01T10:00:00+07:00",
    status: "DRAFT",
    coverImageUrl: "/src/img/secret-show-2026.jpg",
    zones: [
      zone("VIP", "VIP Secret Circle", "Reserved area for the closest stage view.", 120),
      zone("GA", "General Admission", "Standing area for the secret show.", 1200),
    ],
    tickets: [
      ticket("VIP", "VIP Secret Circle", "Draft VIP ticket configured by approved request.", 1800000, 120, 0, 0, 2, "DRAFT"),
      ticket("GA", "GA", "Draft general admission ticket configured by approved request.", 700000, 1200, 0, 0, 4, "DRAFT"),
    ],
  },
];

const fixedId = (number) =>
  `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`;

const zoneId = (concertIndex, zoneIndex) => fixedId(301 + concertIndex * 5 + zoneIndex);
const gateId = (concertIndex, zoneIndex) => fixedId(401 + concertIndex * 5 + zoneIndex);
const ticketTypeId = (concertIndex, ticketIndex) => fixedId(501 + concertIndex * 5 + ticketIndex);
const organizerRequestId = (index) => fixedId(701 + index);
const deletionRequestId = (index) => fixedId(721 + index);
const checkerAccountId = (index) => fixedId(741 + index);

function zone(code, name, description, capacity) {
  return { code, name, description, capacity };
}

function ticket(zoneCode, name, description, price, totalQuantity, heldQuantity, soldQuantity, maxPerUser, status = "ON_SALE") {
  return { zoneCode, name, description, price, totalQuantity, heldQuantity, soldQuantity, maxPerUser, status };
}

function requestTicketTypes(concert, saleStartAt = "2026-06-01T10:00:00+07:00", saleEndAt = "2026-12-31T23:59:59+07:00") {
  return concert.tickets.map((item) => {
    const zoneItem = concert.zones.find((candidate) => candidate.code === item.zoneCode);

    return {
      zone_code: item.zoneCode,
      zone_name: zoneItem?.name ?? item.zoneCode,
      zone_capacity: zoneItem?.capacity ?? item.totalQuantity,
      name: item.name,
      price: { amount: item.price, currency: "VND" },
      total_quantity: item.totalQuantity,
      max_per_user: item.maxPerUser,
      sale_start_at: saleStartAt,
      sale_end_at: saleEndAt,
    };
  });
}

async function seedUsers() {
  const users = [
    ["audience", "audience@ticketbox.test", "Demo Audience", "+84900000001", "AUDIENCE"],
    ["organizer", "organizer@ticketbox.test", "Demo Organizer", "+84900000002", "ORGANIZER"],
    ["checker", "checker@ticketbox.test", "Demo Checker", "+84900000003", "CHECKER"],
    ["admin", "admin@ticketbox.test", "Demo Admin", "+84900000004", "ADMIN"],
    ["checkerSecretOne", "checker-secret-1@ticketbox.test", "Secret Show Checker 1", "+84900000005", "CHECKER"],
    ["checkerSecretTwo", "checker-secret-2@ticketbox.test", "Secret Show Checker 2", "+84900000006", "CHECKER"],
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
      update: { email, fullName, phone, role, status: "ACTIVE" },
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
        description: concert.description,
        artistName: concert.artistName,
        artistBio: concert.artistBio,
        startsAt: new Date(concert.startsAt),
        endsAt: new Date(concert.endsAt),
        plannedPublishAt: concert.plannedPublishAt ? new Date(concert.plannedPublishAt) : null,
        status: concert.status,
        coverImageUrl: concert.coverImageUrl,
        seatMapUrl: null,
      },
      update: {
        venueId: concert.venueId,
        organizerId: userIds.organizer,
        title: concert.title,
        slug: concert.slug,
        description: concert.description,
        artistName: concert.artistName,
        artistBio: concert.artistBio,
        startsAt: new Date(concert.startsAt),
        endsAt: new Date(concert.endsAt),
        plannedPublishAt: concert.plannedPublishAt ? new Date(concert.plannedPublishAt) : null,
        status: concert.status,
        coverImageUrl: concert.coverImageUrl,
        seatMapUrl: null,
      },
    });

    for (const [zoneIndex, item] of concert.zones.entries()) {
      await prisma.seatZone.upsert({
        where: { id: zoneId(concertIndex, zoneIndex) },
        create: {
          id: zoneId(concertIndex, zoneIndex),
          concertId: concert.id,
          code: item.code,
          name: item.name,
          description: item.description,
          capacity: item.capacity,
          svgPath: `M${10 + zoneIndex * 72} 10 H${70 + zoneIndex * 72} V90 H${10 + zoneIndex * 72} Z`,
          sortOrder: zoneIndex + 1,
        },
        update: {
          concertId: concert.id,
          code: item.code,
          name: item.name,
          description: item.description,
          capacity: item.capacity,
          svgPath: `M${10 + zoneIndex * 72} 10 H${70 + zoneIndex * 72} V90 H${10 + zoneIndex * 72} Z`,
          sortOrder: zoneIndex + 1,
        },
      });

      await prisma.checkinGate.upsert({
        where: { id: gateId(concertIndex, zoneIndex) },
        create: {
          id: gateId(concertIndex, zoneIndex),
          concertId: concert.id,
          code: `${item.code}_GATE`,
          name: `${item.code} Gate`,
          description: `Gate for the ${item.code} zone.`,
          isActive: true,
          sortOrder: zoneIndex + 1,
        },
        update: {
          concertId: concert.id,
          code: `${item.code}_GATE`,
          name: `${item.code} Gate`,
          description: `Gate for the ${item.code} zone.`,
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
        update: { concertId: concert.id },
      });
    }

    for (const [ticketIndex, item] of concert.tickets.entries()) {
      const zoneIndex = concert.zones.findIndex((zoneItem) => zoneItem.code === item.zoneCode);
      if (zoneIndex < 0) continue;

      await prisma.ticketType.upsert({
        where: { id: ticketTypeId(concertIndex, ticketIndex) },
        create: {
          id: ticketTypeId(concertIndex, ticketIndex),
          concertId: concert.id,
          seatZoneId: zoneId(concertIndex, zoneIndex),
          name: item.name,
          description: item.description,
          price: item.price,
          currency: "VND",
          totalQuantity: item.totalQuantity,
          heldQuantity: item.heldQuantity,
          soldQuantity: item.soldQuantity,
          maxPerUser: item.maxPerUser,
          saleStartAt: new Date("2026-06-01T10:00:00+07:00"),
          saleEndAt: new Date("2026-12-31T23:59:59+07:00"),
          status: item.status,
        },
        update: {
          concertId: concert.id,
          seatZoneId: zoneId(concertIndex, zoneIndex),
          name: item.name,
          description: item.description,
          price: item.price,
          currency: "VND",
          totalQuantity: item.totalQuantity,
          heldQuantity: item.heldQuantity,
          soldQuantity: item.soldQuantity,
          maxPerUser: item.maxPerUser,
          saleStartAt: new Date("2026-06-01T10:00:00+07:00"),
          saleEndAt: new Date("2026-12-31T23:59:59+07:00"),
          status: item.status,
        },
      });
    }
  }
}

async function seedOrganizerWorkflow() {
  const pendingRequest = {
    id: organizerRequestId(0),
    organizerId: userIds.organizer,
    venueId: venues[2].id,
    title: "Saigon Indie Weekend",
    artistName: "Indie Collective",
    description: "A pending organizer request for admin review.",
    startsAt: new Date("2027-01-18T19:00:00+07:00"),
    endsAt: new Date("2027-01-18T22:30:00+07:00"),
    plannedPublishAt: new Date("2026-12-05T10:00:00+07:00"),
    gateCount: 2,
    checkerCount: 3,
    pressKitUrl: "/press-kit/saigon-indie-weekend.pdf",
    ticketTypes: [
      {
        zone_code: "VIP",
        zone_name: "VIP",
        zone_capacity: 500,
        name: "VIP",
        price: { amount: 1500000, currency: "VND" },
        total_quantity: 500,
        max_per_user: 2,
        sale_start_at: "2026-12-10T10:00:00+07:00",
        sale_end_at: "2027-01-18T12:00:00+07:00",
      },
      {
        zone_code: "GA",
        zone_name: "General Admission",
        zone_capacity: 2500,
        name: "GA",
        price: { amount: 650000, currency: "VND" },
        total_quantity: 2500,
        max_per_user: 4,
        sale_start_at: "2026-12-10T10:00:00+07:00",
        sale_end_at: "2027-01-18T12:00:00+07:00",
      },
    ],
    status: "PENDING",
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    concertId: null,
  };

  const approvedConcert = concerts.find((concert) => concert.slug === "secret-show-2026");
  const rejectedRequest = {
    id: organizerRequestId(2),
    organizerId: userIds.organizer,
    venueId: venues[3].id,
    title: "Midnight Acoustic Archive",
    artistName: "Archive Session Band",
    description: "A rejected request kept in seed data for admin review history screens.",
    startsAt: new Date("2027-02-12T19:30:00+07:00"),
    endsAt: new Date("2027-02-12T22:00:00+07:00"),
    plannedPublishAt: new Date("2027-01-05T10:00:00+07:00"),
    gateCount: 1,
    checkerCount: 1,
    pressKitUrl: "/press-kit/midnight-acoustic-archive.pdf",
    ticketTypes: [
      {
        zone_code: "CAT1",
        zone_name: "CAT 1",
        zone_capacity: 300,
        name: "CAT 1",
        price: { amount: 900000, currency: "VND" },
        total_quantity: 300,
        max_per_user: 2,
        sale_start_at: "2027-01-10T10:00:00+07:00",
        sale_end_at: "2027-02-12T12:00:00+07:00",
      },
    ],
    status: "REJECTED",
    reviewedById: userIds.admin,
    reviewedAt: new Date("2026-06-15T09:30:00+07:00"),
    reviewNote: "Venue hold document is missing.",
    concertId: null,
  };

  const approvedRequest = {
    id: organizerRequestId(1),
    organizerId: userIds.organizer,
    venueId: approvedConcert.venueId,
    title: approvedConcert.title,
    artistName: approvedConcert.artistName,
    description: approvedConcert.description,
    startsAt: new Date(approvedConcert.startsAt),
    endsAt: new Date(approvedConcert.endsAt),
    plannedPublishAt: new Date(approvedConcert.plannedPublishAt),
    gateCount: approvedConcert.zones.length,
    checkerCount: 2,
    pressKitUrl: "/press-kit/secret-show-2026.pdf",
    ticketTypes: requestTicketTypes(approvedConcert, "2026-12-01T10:00:00+07:00", "2026-12-31T12:00:00+07:00"),
    status: "APPROVED",
    reviewedById: userIds.admin,
    reviewedAt: new Date("2026-06-12T14:00:00+07:00"),
    reviewNote: "Approved for draft materialization.",
    concertId: approvedConcert.id,
  };

  for (const request of [pendingRequest, approvedRequest, rejectedRequest]) {
    await prisma.organizerRequest.upsert({
      where: { id: request.id },
      create: request,
      update: request,
    });
  }

  const legacyCheckerAccounts = concerts
    .filter((concert) => concert.zones.length > 0 && concert.id !== approvedConcert.id)
    .map((concert, index) => ({
      id: checkerAccountId(index),
      concertId: concert.id,
      userId: userIds.checker,
      organizerRequestId: null,
    }));

  const checkerAccounts = [
    ...legacyCheckerAccounts,
    {
      id: checkerAccountId(5),
      concertId: approvedConcert.id,
      userId: userIds.checkerSecretOne,
      organizerRequestId: approvedRequest.id,
    },
    {
      id: checkerAccountId(6),
      concertId: approvedConcert.id,
      userId: userIds.checkerSecretTwo,
      organizerRequestId: approvedRequest.id,
    },
  ];

  for (const account of checkerAccounts) {
    await prisma.concertCheckerAccount.upsert({
      where: { id: account.id },
      create: account,
      update: account,
    });
  }

  const deletionRequests = [
    {
      id: deletionRequestId(0),
      concertId: concerts[4].id,
      organizerId: userIds.organizer,
      reason: "Organizer needs to move the show to a larger venue.",
      status: "PENDING",
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
    },
    {
      id: deletionRequestId(1),
      concertId: concerts[3].id,
      organizerId: userIds.organizer,
      reason: "Duplicate request submitted during schedule review.",
      status: "REJECTED",
      reviewedById: userIds.admin,
      reviewedAt: new Date("2026-06-16T15:15:00+07:00"),
      reviewNote: "Concert remains valid and should stay published.",
    },
  ];

  for (const request of deletionRequests) {
    await prisma.concertDeletionRequest.upsert({
      where: { id: request.id },
      create: request,
      update: request,
    });
  }
}

async function seedDemoTickets() {
  const publishedConcerts = concerts.filter((concert) => concert.status === "PUBLISHED" && concert.tickets.length > 0);

  for (const [index, concert] of publishedConcerts.slice(0, 3).entries()) {
    const sourceConcertIndex = concerts.findIndex((item) => item.id === concert.id);
    const ticketIndex = Math.min(1, concert.tickets.length - 1);
    const ticketSeed = concert.tickets[ticketIndex];
    const ticketType = ticketTypeId(sourceConcertIndex, ticketIndex);
    const sourceZoneIndex = concert.zones.findIndex((item) => item.code === ticketSeed.zoneCode);
    const amount = ticketSeed.price;
    const orderId = fixedId(601 + index);
    const orderItemId = fixedId(611 + index);
    const paymentId = fixedId(621 + index);
    const issuedTicketId = fixedId(631 + index);

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
        confirmedAt: new Date("2026-06-08T10:00:00+07:00"),
      },
      update: {
        userId: userIds.audience,
        concertId: concert.id,
        idempotencyKey: `seed-order-${concert.slug}`,
        status: "CONFIRMED",
        totalAmount: amount,
        currency: "VND",
        confirmedAt: new Date("2026-06-08T10:00:00+07:00"),
      },
    });

    await prisma.orderItem.upsert({
      where: { id: orderItemId },
      create: {
        id: orderItemId,
        orderId,
        ticketTypeId: ticketType,
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
      },
      update: {
        orderId,
        ticketTypeId: ticketType,
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
        provider: index < 2 ? "VNPAY" : "MOMO",
        providerTransactionId: `SEED-PAYMENT-${index + 1}`,
        idempotencyKey: `seed-payment-${concert.slug}`,
        amount,
        currency: "VND",
        status: "SUCCEEDED",
        checkoutUrl: `https://sandbox-payments.example.com/${concert.slug}`,
        providerPayload: { seed: true },
        webhookPayload: { seed: true, status: "success" },
        webhookReceivedAt: new Date("2026-06-08T10:03:00+07:00"),
        webhookSignatureValid: true,
        paidAt: new Date("2026-06-08T10:03:00+07:00"),
      },
      update: {
        amount,
        status: "SUCCEEDED",
        webhookReceivedAt: new Date("2026-06-08T10:03:00+07:00"),
        webhookSignatureValid: true,
        paidAt: new Date("2026-06-08T10:03:00+07:00"),
      },
    });

    await prisma.ticket.upsert({
      where: { id: issuedTicketId },
      create: {
        id: issuedTicketId,
        orderId,
        orderItemId,
        userId: userIds.audience,
        concertId: concert.id,
        ticketTypeId: ticketType,
        seatZoneId: zoneId(sourceConcertIndex, sourceZoneIndex),
        qrTokenHash: `qr-seed-${concert.slug}-001`,
        qrPayload: { ticket_id: issuedTicketId, concert_id: concert.id },
        qrSignature: "demo-signature",
        status: index === 2 ? "CHECKED_IN" : "ISSUED",
        issuedAt: new Date("2026-06-08T10:05:00+07:00"),
        checkedInAt: index === 2 ? new Date("2026-09-05T18:45:00+07:00") : null,
      },
      update: {
        orderId,
        orderItemId,
        userId: userIds.audience,
        concertId: concert.id,
        ticketTypeId: ticketType,
        seatZoneId: zoneId(sourceConcertIndex, sourceZoneIndex),
        qrTokenHash: `qr-seed-${concert.slug}-001`,
        qrPayload: { ticket_id: issuedTicketId, concert_id: concert.id },
        qrSignature: "demo-signature",
        status: index === 2 ? "CHECKED_IN" : "ISSUED",
        issuedAt: new Date("2026-06-08T10:05:00+07:00"),
        checkedInAt: index === 2 ? new Date("2026-09-05T18:45:00+07:00") : null,
      },
    });
  }
}

async function seedOperations() {
  for (const [concertIndex, concert] of concerts.entries()) {
    if (concert.zones.length === 0) continue;
    const gateIndex = Math.max(0, concert.zones.findIndex((item) => item.code === "VIP"));
    const staffId = concert.slug === "secret-show-2026" ? userIds.checkerSecretOne : userIds.checker;

    await prisma.checkinDevice.upsert({
      where: { id: fixedId(641 + concertIndex) },
      create: {
        id: fixedId(641 + concertIndex),
        deviceCode: `CHECKER-${concert.slug}`,
        staffId,
        concertId: concert.id,
        gateId: gateId(concertIndex, gateIndex),
        name: `Demo checker device - ${concert.title}`,
        status: "ACTIVE",
        lastSeenAt: new Date("2026-06-08T11:00:00+07:00"),
      },
      update: {
        deviceCode: `CHECKER-${concert.slug}`,
        staffId,
        concertId: concert.id,
        gateId: gateId(concertIndex, gateIndex),
        name: `Demo checker device - ${concert.title}`,
        status: "ACTIVE",
        lastSeenAt: new Date("2026-06-08T11:00:00+07:00"),
      },
    });

    await prisma.artistBioJob.upsert({
      where: { id: fixedId(681 + concertIndex) },
      create: {
        id: fixedId(681 + concertIndex),
        concertId: concert.id,
        requestedById: userIds.organizer,
        status: concertIndex < 2 ? "DONE" : "PENDING",
        sourceFileUrl: `/press-kit/${concert.slug}.pdf`,
        extractedText: concert.description,
        generatedBio: concert.artistBio || null,
      },
      update: {
        status: concertIndex < 2 ? "DONE" : "PENDING",
        sourceFileUrl: `/press-kit/${concert.slug}.pdf`,
        extractedText: concert.description,
        generatedBio: concert.artistBio || null,
      },
    });
  }
}

async function main() {
  await seedUsers();
  await seedCatalog();
  await seedOrganizerWorkflow();
  await seedDemoTickets();
  await seedOperations();
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
