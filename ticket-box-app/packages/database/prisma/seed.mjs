import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Mật khẩu chung cho mọi tài khoản demo do seed tạo (xem README mục 11).
const DEMO_PASSWORD = "Password@123";

const userIds = {
  audience: "00000000-0000-0000-0000-000000000001",
  organizer: "00000000-0000-0000-0000-000000000002",
  checker: "00000000-0000-0000-0000-000000000003",
  admin: "00000000-0000-0000-0000-000000000004",
  checkerSecretOne: "00000000-0000-0000-0000-000000000005",
  checkerSecretTwo: "00000000-0000-0000-0000-000000000006",
  organizerTwo: "00000000-0000-0000-0000-000000000007",
};

const venues = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    name: "Nhà hát Hòa Bình",
    address: "240 đường 3 Tháng 2, Quận 10",
    city: "Hồ Chí Minh",
    capacity: 3500,
    mapUrl: "https://maps.example.com/hoa-binh",
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    name: "Sân vận động Quốc gia Mỹ Đình",
    address: "Đường Phạm Hùng, Nam Từ Liêm",
    city: "Hà Nội",
    capacity: 40000,
    mapUrl: "https://maps.example.com/my-dinh",
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    name: "SECC - Trung tâm Hội chợ và Triển lãm Sài Gòn",
    address: "799 đại lộ Nguyễn Văn Linh, Quận 7",
    city: "Hồ Chí Minh",
    capacity: 10000,
    mapUrl: "https://maps.example.com/secc",
  },
  {
    id: "00000000-0000-0000-0000-000000000104",
    name: "Nhà hát Lớn Hà Nội",
    address: "1 Tràng Tiền, Hoàn Kiếm",
    city: "Hà Nội",
    capacity: 598,
    mapUrl: "https://maps.example.com/opera-house",
  },
];

const concerts = [
  {
    id: "00000000-0000-0000-0000-000000000201",
    venueId: venues[0].id,
    title: "Ánh Sáng Màn Đêm",
    slug: "anh-sang-man-dem",
    description:
      "Đêm nhạc đặc biệt của Grey D, nơi những bản ballad và indie len qua miền ký ức, hiện tại và các khoảnh khắc rất riêng. Một hành trình âm nhạc cho những ai từng thương nhớ trong im lặng.",
    artistName: "Grey D",
    artistBio:
      "Grey D là một trong những giọng ca indie Việt nổi bật, được yêu mến bởi chất giọng ấm, nội tâm và khả năng viết nhạc tinh tế. Âm nhạc của anh thường chạm vào những cảm xúc nhỏ nhưng bền lâu.",
    startsAt: "2026-07-15T19:30:00+07:00",
    endsAt: "2026-07-15T22:00:00+07:00",
    plannedPublishAt: "2026-06-10T10:00:00+07:00",
    status: "PUBLISHED",
    coverImageUrl: "/src/img/anh-sang-man-dem.jpg",
    zones: [
      zone("SVIP", "SVIP", "Hàng đầu, tầm nhìn sân khấu đẹp nhất.", 100),
      zone("VIP", "VIP", "Khu ghế ngồi thoải mái, gần sân khấu.", 300),
      zone("CAT1", "CAT 1", "Khu đứng phía trước.", 800),
      zone("GA", "General Admission", "Khu đứng tự do.", 2000),
    ],
    tickets: [
      ticket("SVIP", "SVIP", "Vào cổng ưu tiên và poster độc quyền.", 2950000, 100, 5, 68, 2),
      ticket("VIP", "VIP", "Ghế ngồi cao cấp và túi quà lưu niệm.", 1950000, 300, 12, 201, 2),
      ticket("CAT1", "CAT 1", "Quyền vào khu đứng phía trước.", 1250000, 800, 30, 420, 4),
      ticket("GA", "GA", "Vé đứng tiêu chuẩn.", 750000, 2000, 80, 1100, 4),
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000202",
    venueId: venues[1].id,
    title: "Đi Qua Thương Nhớ Live Concert",
    slug: "di-qua-thuong-nho",
    description:
      "Mỹ Tâm trở lại với một đêm nhạc lớn tại Hà Nội. Hành trình âm nhạc đi qua những ca khúc đã gắn bó với nhiều thế hệ khán giả, từ ballad da diết đến những bản pop đầy năng lượng.",
    artistName: "Mỹ Tâm",
    artistBio:
      "Mỹ Tâm là biểu tượng của nhạc Việt với hơn 20 năm hoạt động, giọng hát giàu nội lực và nhiều live concert để lại dấu ấn mạnh mẽ. Các ca khúc của cô đã trở thành ký ức chung của nhiều thế hệ.",
    startsAt: "2026-08-20T18:00:00+07:00",
    endsAt: "2026-08-20T21:30:00+07:00",
    plannedPublishAt: "2026-07-01T10:00:00+07:00",
    status: "PUBLISHED",
    coverImageUrl: "/src/img/di-qua-thuong-nho.jpg",
    zones: [
      zone("SVIP", "SVIP Diamond", "Khu ghế đặc biệt gần sân khấu nhất.", 500),
      zone("VIP", "VIP Gold", "Khu ghế có mái che, tầm nhìn đẹp.", 2000),
      zone("CAT1", "CAT 1", "Khán đài phía trước.", 5000),
      zone("CAT2", "CAT 2", "Khán đài phía sau.", 8000),
      zone("GA", "General Admission", "Khu đứng tự do ngoài trời.", 20000),
    ],
    tickets: [
      ticket("SVIP", "SVIP Diamond", "Ghế VIP, quà chào mừng và vào cổng sớm.", 3500000, 500, 10, 320, 2),
      ticket("VIP", "VIP Gold", "Khu ghế có mái che, thoải mái.", 2200000, 2000, 40, 1450, 4),
      ticket("CAT1", "CAT 1", "Ghế khán đài phía trước.", 1500000, 5000, 100, 3200, 4),
      ticket("CAT2", "CAT 2", "Ghế khán đài phía sau.", 1000000, 8000, 150, 5200, 6),
      ticket("GA", "GA", "Vé đứng tự do.", 650000, 20000, 500, 12000, 6),
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000203",
    venueId: venues[2].id,
    title: "Our 20th Moment 2026",
    slug: "our-20th-moment-2026",
    description:
      "Kỷ niệm 20 năm âm nhạc bằng một đêm acoustic và orchestra đặc biệt, nơi những ký ức được tái hiện bằng ngôn ngữ âm thanh thuần khiết và nhiều chiều sâu.",
    artistName: "Thanh Lam & Hà Trần",
    artistBio:
      "Thanh Lam và Hà Trần là hai giọng ca lớn của nhạc Việt, cùng đứng trên một sân khấu để tạo nên một không gian âm nhạc tinh tế, giàu cảm xúc và hiếm có.",
    startsAt: "2026-09-05T19:00:00+07:00",
    endsAt: "2026-09-05T22:30:00+07:00",
    plannedPublishAt: "2026-07-20T10:00:00+07:00",
    status: "PUBLISHED",
    coverImageUrl: "/src/img/our-20th-moment-2026.jpg",
    zones: [
      zone("SVIP", "SVIP", "Hàng đầu, kèm tiệc cocktail trước chương trình.", 200),
      zone("VIP", "VIP", "Ghế ngồi cao cấp.", 800),
      zone("CAT1", "CAT 1", "Khu ghế B tiêu chuẩn.", 2500),
      zone("GA", "Standing", "Khu đứng phía sau.", 5000),
    ],
    tickets: [
      ticket("SVIP", "SVIP", "Tiệc cocktail và cơ hội giao lưu cùng nghệ sĩ.", 5500000, 200, 3, 187, 2),
      ticket("VIP", "VIP", "Ghế cao cấp kèm programme book.", 3200000, 800, 20, 650, 2),
      ticket("CAT1", "CAT 1", "Vé ghế ngồi tiêu chuẩn.", 1800000, 2500, 50, 1900, 4),
      ticket("GA", "Standing", "Khu đứng tự do.", 900000, 5000, 120, 3200, 4),
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000204",
    venueId: venues[3].id,
    title: "Một Thời Đã Yêu",
    slug: "mot-thoi-da-yeu",
    description:
      "Lam Trường và những giai điệu của một thời đã qua, các ca khúc tình yêu đã trở thành ký ức chung của nhiều khán giả. Đêm nhạc acoustic mang đến không gian thân mật và ấm áp.",
    artistName: "Lam Trường",
    artistBio:
      "Lam Trường là một trong những giọng ca nam được yêu mến nhất của nhạc Việt thập niên 90-2000. Những bản tình ca của anh đã đi cùng tuổi trẻ của nhiều thế hệ.",
    startsAt: "2026-10-12T19:30:00+07:00",
    endsAt: "2026-10-12T22:00:00+07:00",
    plannedPublishAt: "2026-08-15T10:00:00+07:00",
    status: "PUBLISHED",
    coverImageUrl: "/src/img/mot-thoi-da-yeu.jpg",
    zones: [
      zone("VIP", "VIP Hàng Đầu", "Hàng đầu, có giao lưu cùng nghệ sĩ.", 60),
      zone("CAT1", "CAT 1", "Khu ghế hàng giữa.", 200),
      zone("CAT2", "CAT 2", "Khu ghế hàng sau.", 320),
    ],
    tickets: [
      ticket("VIP", "VIP Hàng Đầu", "Giao lưu và ký tặng sau chương trình.", 2500000, 60, 2, 55, 2),
      ticket("CAT1", "CAT 1", "Vé ghế ngồi hạng nhất.", 1500000, 200, 5, 168, 2),
      ticket("CAT2", "CAT 2", "Vé ghế ngồi tiêu chuẩn.", 900000, 320, 10, 245, 4),
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000205",
    venueId: venues[0].id,
    title: "Nơi Tình Yêu Bắt Đầu",
    slug: "noi-tinh-yeu-bat-dau",
    description:
      "Bích Phương trình diễn trong một đêm nhạc đặc biệt tại TP.HCM, mang đến những ca khúc mới nhất cùng các bản hit đã gắn bó với khán giả suốt nhiều năm.",
    artistName: "Bích Phương",
    artistBio:
      "Bích Phương là một trong những nữ ca sĩ pop nổi bật của Việt Nam, được yêu mến bởi giai điệu bắt tai, hình ảnh hiện đại và phong cách sân khấu cuốn hút.",
    startsAt: "2026-11-08T19:30:00+07:00",
    endsAt: "2026-11-08T21:30:00+07:00",
    plannedPublishAt: "2026-09-01T10:00:00+07:00",
    status: "PUBLISHED",
    coverImageUrl: "/src/img/noi-tinh-yeu-bat-dau.jpg",
    zones: [
      zone("SVIP", "SVIP", "Khu VIP có tầm nhìn sân khấu đẹp.", 150),
      zone("VIP", "VIP", "Khu ghế ngồi.", 400),
      zone("GA", "GA", "Khu đứng tự do.", 2500),
    ],
    tickets: [
      ticket("SVIP", "SVIP", "Gift set và quyền vào cổng sớm.", 2200000, 150, 8, 95, 2),
      ticket("VIP", "VIP", "Khu ghế ngồi cao cấp.", 1500000, 400, 15, 280, 2),
      ticket("GA", "GA", "Khu đứng tiêu chuẩn.", 850000, 2500, 60, 1800, 4),
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000206",
    venueId: venues[1].id,
    title: "Sắp Công Bố: Đêm Diễn Bí Mật",
    slug: "secret-show-2026",
    description: "Một đêm diễn bí ẩn đang được chuẩn bị. Thông tin nghệ sĩ, sơ đồ vé và quyền lợi đặc biệt sẽ được công bố sớm.",
    artistName: "Đang cập nhật",
    artistBio: "",
    startsAt: "2026-12-31T20:00:00+07:00",
    endsAt: "2026-12-31T23:59:00+07:00",
    plannedPublishAt: "2026-12-01T10:00:00+07:00",
    status: "DRAFT",
    coverImageUrl: "/src/img/secret-show-2026.jpg",
    zones: [
      zone("VIP", "VIP Secret Circle", "Khu vực riêng với tầm nhìn gần sân khấu nhất.", 120),
      zone("GA", "General Admission", "Khu đứng cho đêm diễn bí mật.", 1200),
    ],
    tickets: [
      ticket("VIP", "VIP Secret Circle", "Vé VIP nháp được tạo từ hồ sơ đã duyệt.", 1800000, 120, 0, 0, 2, "DRAFT"),
      ticket("GA", "GA", "Vé phổ thông nháp được tạo từ hồ sơ đã duyệt.", 700000, 1200, 0, 0, 4, "DRAFT"),
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
    ["audience", "audience@gmail.com", "Khán giả 1", "+84900000001", "AUDIENCE"],
    ["organizer", "organizer@gmail.com", "BTC 1", "+84900000002", "ORGANIZER"],
    ["organizerTwo", "organizer2@gmail.com", "BTC 2", "+84900000007", "ORGANIZER"],
    ["admin", "admin@gmail.com", "Quản trị viên Demo", "+84900000004", "ADMIN"],
    ["checker", "checker@ticketbox.test", "Checker Soát Vé Demo", "+84900000003", "CHECKER"],
    ["checkerSecretOne", "checker-secret-1@ticketbox.test", "Checker Đêm Diễn Bí Mật 1", "+84900000005", "CHECKER"],
    ["checkerSecretTwo", "checker-secret-2@ticketbox.test", "Checker Đêm Diễn Bí Mật 2", "+84900000006", "CHECKER"],
  ];

  // Bcrypt hash thật (12 rounds, khớp hashPassword của api-server) để demo login được.
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 12);

  for (const [key, email, fullName, phone, role] of users) {
    await prisma.user.upsert({
      where: { id: userIds[key] },
      create: {
        id: userIds[key],
        email,
        passwordHash,
        fullName,
        phone,
        role,
        status: "ACTIVE",
      },
      update: { email, fullName, phone, role, status: "ACTIVE", passwordHash },
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
          name: `Cổng ${item.code}`,
          description: `Cổng soát vé cho khu ${item.code}.`,
          isActive: true,
          sortOrder: zoneIndex + 1,
        },
        update: {
          concertId: concert.id,
          code: `${item.code}_GATE`,
          name: `Cổng ${item.code}`,
          description: `Cổng soát vé cho khu ${item.code}.`,
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
    description: "Hồ sơ đang chờ admin duyệt cho một cuối tuần âm nhạc indie tại TP.HCM, quy tụ các nghệ sĩ trẻ Việt Nam và Đông Nam Á.",
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
    title: "Kho Lưu Trữ Acoustic Nửa Đêm",
    artistName: "Archive Session Band",
    description: "Hồ sơ bị từ chối được giữ trong seed để demo lịch sử duyệt hồ sơ của admin.",
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
    reviewNote: "Thiếu tài liệu xác nhận giữ chỗ địa điểm. Vui lòng bổ sung hồ sơ trước khi nộp lại.",
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
    reviewNote: "Đã duyệt để hệ thống tạo concert nháp, khu vé, cổng check-in và tài khoản checker.",
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
      userId: userIds.checkerSecretOne,
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
      reason: "Ban tổ chức cần chuyển chương trình sang địa điểm lớn hơn do nhu cầu vé tăng cao.",
      status: "PENDING",
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
    },
    {
      id: deletionRequestId(1),
      concertId: concerts[3].id,
      organizerId: userIds.organizer,
      reason: "Yêu cầu trùng được gửi trong lúc rà soát lịch diễn.",
      status: "REJECTED",
      reviewedById: userIds.admin,
      reviewedAt: new Date("2026-06-16T15:15:00+07:00"),
      reviewNote: "Concert vẫn hợp lệ và nên tiếp tục được mở bán.",
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
        gateId: gateId(sourceConcertIndex, sourceZoneIndex),
        qrTokenHash: `qr-seed-${concert.slug}-001`,
        // Để null để api-server tự build payload (7 field) và ký Ed25519 thật khi
        // gọi GET /me/tickets/:id/qr lần đầu (như vé phát hành thật). Không gán
        // chữ ký demo ở đây nữa, nếu không checker sẽ verify thất bại.
        qrPayload: null,
        qrSignature: null,
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
        gateId: gateId(sourceConcertIndex, sourceZoneIndex),
        qrTokenHash: `qr-seed-${concert.slug}-001`,
        // Ghi đè dữ liệu demo cũ trong DB về null để lần /qr kế tiếp ký lại thật.
        qrPayload: null,
        qrSignature: null,
        status: index === 2 ? "CHECKED_IN" : "ISSUED",
        issuedAt: new Date("2026-06-08T10:05:00+07:00"),
        checkedInAt: index === 2 ? new Date("2026-09-05T18:45:00+07:00") : null,
      },
    });
  }

  // Bổ sung các ticket phụ cho concert 1 (anh-sang-man-dem) phục vụ demo
  const asmConcert = publishedConcerts[0];
  if (asmConcert) {
    const sourceConcertIndex = concerts.findIndex((item) => item.id === asmConcert.id);
    const ticketIndex = Math.min(1, asmConcert.tickets.length - 1);
    const ticketSeed = asmConcert.tickets[ticketIndex];
    const ticketType = ticketTypeId(sourceConcertIndex, ticketIndex);
    const sourceZoneIndex = asmConcert.zones.findIndex((item) => item.code === ticketSeed.zoneCode);
    const amount = ticketSeed.price;

    const extraTickets = [
      { id: fixedId(801), orderId: fixedId(811), orderItemId: fixedId(821), qrTokenHash: `qr-seed-${asmConcert.slug}-002`, status: "ISSUED" },
      { id: fixedId(802), orderId: fixedId(812), orderItemId: fixedId(822), qrTokenHash: `qr-seed-${asmConcert.slug}-cancelled`, status: "CANCELLED" },
      { id: fixedId(803), orderId: fixedId(813), orderItemId: fixedId(823), qrTokenHash: `qr-seed-${asmConcert.slug}-refunded`, status: "REFUNDED" },
    ];

    for (const ext of extraTickets) {
      await prisma.order.upsert({
        where: { id: ext.orderId },
        create: {
          id: ext.orderId,
          userId: userIds.audience,
          concertId: asmConcert.id,
          idempotencyKey: `seed-order-${ext.id}`,
          status: "CONFIRMED",
          totalAmount: amount,
          currency: "VND",
          confirmedAt: new Date("2026-06-08T10:00:00+07:00"),
        },
        update: {
          status: "CONFIRMED",
        },
      });

      await prisma.orderItem.upsert({
        where: { id: ext.orderItemId },
        create: {
          id: ext.orderItemId,
          orderId: ext.orderId,
          ticketTypeId: ticketType,
          quantity: 1,
          unitPrice: amount,
          lineTotal: amount,
        },
        update: {},
      });

      await prisma.ticket.upsert({
        where: { id: ext.id },
        create: {
          id: ext.id,
          orderId: ext.orderId,
          orderItemId: ext.orderItemId,
          userId: userIds.audience,
          concertId: asmConcert.id,
          ticketTypeId: ticketType,
          seatZoneId: zoneId(sourceConcertIndex, sourceZoneIndex),
          gateId: gateId(sourceConcertIndex, sourceZoneIndex),
          qrTokenHash: ext.qrTokenHash,
          qrPayload: null,
          qrSignature: null,
          status: ext.status,
          issuedAt: new Date("2026-06-08T10:05:00+07:00"),
        },
        update: {
          status: ext.status,
        },
      });
    }
  }
}

async function seedOperations() {
  for (const [concertIndex, concert] of concerts.entries()) {
    if (concert.zones.length === 0) continue;
    const gateIndex = Math.max(0, concert.zones.findIndex((item) => item.code === "VIP"));
    const staffId = concert.slug === "secret-show-2026"
      ? userIds.checkerSecretOne
      : (concert.slug === "anh-sang-man-dem" ? userIds.checker : userIds.checkerSecretTwo);

    await prisma.checkinDevice.upsert({
      where: { id: fixedId(641 + concertIndex) },
      create: {
        id: fixedId(641 + concertIndex),
        deviceCode: `CHECKER-${concert.slug}`,
        staffId,
        concertId: concert.id,
        gateId: gateId(concertIndex, gateIndex),
        name: `Thiết bị soát vé demo - ${concert.title}`,
        status: "ACTIVE",
        lastSeenAt: new Date("2026-06-08T11:00:00+07:00"),
      },
      update: {
        deviceCode: `CHECKER-${concert.slug}`,
        staffId,
        concertId: concert.id,
        gateId: gateId(concertIndex, gateIndex),
        name: `Thiết bị soát vé demo - ${concert.title}`,
        status: "ACTIVE",
        lastSeenAt: new Date("2026-06-08T11:00:00+07:00"),
      },
    });

    // Khu khách mời (guest list) — zone/gate/mapping/device dùng dải id riêng
    // (không theo công thức *5 vốn chỉ chứa 5 zone/concert).
    const guestZoneSeedId = fixedId(361 + concertIndex);
    const guestGateSeedId = fixedId(461 + concertIndex);

    await prisma.seatZone.upsert({
      where: { id: guestZoneSeedId },
      create: {
        id: guestZoneSeedId,
        concertId: concert.id,
        code: "GUEST",
        name: "Khu khách mời",
        description: "Khu vực riêng cho khách mời nhãn hàng tài trợ.",
        capacity: 100,
        svgPath: "M10 120 H82 V200 H10 Z",
        sortOrder: 99,
      },
      update: {
        concertId: concert.id,
        code: "GUEST",
        name: "Khu khách mời",
        capacity: 100,
        sortOrder: 99,
      },
    });

    await prisma.checkinGate.upsert({
      where: { id: guestGateSeedId },
      create: {
        id: guestGateSeedId,
        concertId: concert.id,
        code: "GUEST_GATE",
        name: "Cổng khách mời",
        description: "Cổng soát vé cho khu khách mời.",
        isActive: true,
        sortOrder: 99,
      },
      update: {
        concertId: concert.id,
        code: "GUEST_GATE",
        name: "Cổng khách mời",
        isActive: true,
        sortOrder: 99,
      },
    });

    await prisma.checkinGateZone.upsert({
      where: {
        gateId_seatZoneId: { gateId: guestGateSeedId, seatZoneId: guestZoneSeedId },
      },
      create: {
        gateId: guestGateSeedId,
        seatZoneId: guestZoneSeedId,
        concertId: concert.id,
      },
      update: { concertId: concert.id },
    });

    await prisma.checkinDevice.upsert({
      where: { id: fixedId(661 + concertIndex) },
      create: {
        id: fixedId(661 + concertIndex),
        deviceCode: `CHECKER-GUEST-${concert.slug}`,
        staffId,
        concertId: concert.id,
        gateId: guestGateSeedId,
        name: `Thiết bị soát vé khách mời - ${concert.title}`,
        status: "ACTIVE",
        lastSeenAt: new Date("2026-06-08T11:00:00+07:00"),
      },
      update: {
        deviceCode: `CHECKER-GUEST-${concert.slug}`,
        staffId,
        concertId: concert.id,
        gateId: guestGateSeedId,
        status: "ACTIVE",
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

  // Ghi đè/upsert guest list samples cho concert 1 (anh-sang-man-dem)
  const asmConcert = concerts.find((concert) => concert.slug === "anh-sang-man-dem");
  if (asmConcert) {
    const guestZoneSeedId = fixedId(361 + 0); // asmConcert index is 0
    const guestListSeed = [
      { id: fixedId(901), fullName: "Khách VIP 1", email: "guest1@ticketbox.test", phone: "+84911111111", status: "INVITED" },
      { id: fixedId(902), fullName: "Khách VIP 2", email: "guest2@ticketbox.test", phone: "+84922222222", status: "INVITED" },
      { id: fixedId(903), fullName: "Khách VIP Đã Soát", email: "guest3@ticketbox.test", phone: "+84933333333", status: "CHECKED_IN", checkedInAt: new Date(), checkedInById: userIds.checker },
    ];

    for (const guest of guestListSeed) {
      await prisma.guestList.upsert({
        where: { id: guest.id },
        create: {
          id: guest.id,
          concertId: asmConcert.id,
          seatZoneId: guestZoneSeedId,
          fullName: guest.fullName,
          email: guest.email,
          phone: guest.phone,
          status: guest.status,
          checkedInAt: guest.checkedInAt ?? null,
          checkedInById: guest.checkedInById ?? null,
        },
        update: {
          status: guest.status,
          checkedInAt: guest.checkedInAt ?? null,
          checkedInById: guest.checkedInById ?? null,
        },
      });
    }
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
