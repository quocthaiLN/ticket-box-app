export type UserRole = "AUDIENCE" | "ORGANIZER" | "CHECKER" | "ADMIN";
export type ConcertStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
export type TicketStatus = "ISSUED" | "CHECKED_IN" | "CANCELLED";
export type OrderStatus = "HELD" | "CONFIRMED" | "CANCELLED" | "EXPIRED";

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
}

export interface SeatZone {
  id: string;
  code: string;
  name: string;
  description: string;
  capacity: number;
  color: string;
}

export interface TicketType {
  id: string;
  concertId: string;
  seatZoneId: string;
  name: string;
  description: string;
  price: number;
  totalQuantity: number;
  heldQuantity: number;
  soldQuantity: number;
  maxPerUser: number;
  saleStartAt: string;
  saleEndAt: string;
  color: string;
}

export interface Concert {
  id: string;
  venueId: string;
  organizerId: string;
  title: string;
  slug: string;
  description: string;
  artistName: string;
  artistBio: string;
  startsAt: string;
  endsAt: string;
  status: ConcertStatus;
  coverImageUrl: string;
  seatMapUrl?: string;
  venue: Venue;
  ticketTypes: TicketType[];
  seatZones: SeatZone[];
  tags: string[];
  genre: string;
}

export interface Ticket {
  id: string;
  concertId: string;
  ticketTypeId: string;
  userId: string;
  orderId: string;
  qrTokenHash: string;
  status: TicketStatus;
  issuedAt: string;
  checkedInAt?: string;
  concert: Concert;
  ticketType: TicketType;
  seatZone: SeatZone;
}

export interface Order {
  id: string;
  userId: string;
  concertId: string;
  status: OrderStatus;
  totalAmount: number;
  holdExpiresAt?: string;
  confirmedAt?: string;
  items: OrderItem[];
  concert: Concert;
  tickets: Ticket[];
  paymentMethod?: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  ticketType: TicketType;
}

export interface GuestEntry {
  id: string;
  concertId: string;
  fullName: string;
  phone: string;
  email?: string;
  code: string;
  status: "INVITED" | "CHECKED_IN" | "CANCELLED";
  checkedInAt?: string;
  seatZoneId?: string;
  note?: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
}

// ── Venues ──────────────────────────────────────────────────────────────────

export const VENUES: Venue[] = [
  {
    id: "venue-1",
    name: "Nhà hát Hòa Bình",
    address: "240 3 Tháng 2, Q.10, TP.HCM",
    city: "Hồ Chí Minh",
    capacity: 3500,
  },
  {
    id: "venue-2",
    name: "Sân vận động Quốc gia Mỹ Đình",
    address: "Phạm Hùng, Nam Từ Liêm, Hà Nội",
    city: "Hà Nội",
    capacity: 40000,
  },
  {
    id: "venue-3",
    name: "SECC – Trung tâm Hội chợ & Triển lãm",
    address: "799 Nguyễn Văn Linh, Q.7, TP.HCM",
    city: "Hồ Chí Minh",
    capacity: 10000,
  },
  {
    id: "venue-4",
    name: "Nhà hát Lớn Hà Nội",
    address: "1 Tràng Tiền, Hoàn Kiếm, Hà Nội",
    city: "Hà Nội",
    capacity: 598,
  },
];

// ── Concerts ─────────────────────────────────────────────────────────────────

export const CONCERTS: Concert[] = [
  {
    id: "concert-1",
    venueId: "venue-1",
    organizerId: "user-organizer-1",
    title: "Ánh Sáng Màn Đêm",
    slug: "anh-sang-man-dem",
    description:
      "Đêm nhạc đặc biệt của Grey D — kẻ đứng giữa ranh giới của ánh sáng và bóng tối, của kỷ niệm và hiện tại. Một hành trình âm nhạc không thể bỏ lỡ với những bản ballad gây thương nhớ và những ca khúc indie chạm tim.",
    artistName: "Grey D",
    artistBio:
      "Grey D (Nguyễn Đức Cường) là một trong những giọng ca indie Việt nổi bật nhất thế hệ 9X. Với chất giọng ấm, nội tâm và khả năng viết nhạc sâu sắc, anh đã tạo nên một thế giới âm nhạc riêng biệt — nơi những cảm xúc được gói gọn trong từng giai điệu tinh tế. Các ca khúc như \"Không Thể Cùng Nhau Suốt Kiếp\", \"Từng Quen\" và \"Ngủ Một Mình\" đã đồng hành cùng hàng triệu trái tim.",
    startsAt: "2026-07-15T19:30:00",
    endsAt: "2026-07-15T22:00:00",
    status: "PUBLISHED",
    coverImageUrl:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80",
    genre: "Indie / R&B",
    tags: ["Indie", "Ballad", "R&B", "Live Music"],
    venue: VENUES[0],
    seatZones: [
      { id: "zone-1-1", code: "SVIP", name: "SVIP", description: "Hàng đầu, view sân khấu tốt nhất", capacity: 100, color: "#F5C842" },
      { id: "zone-1-2", code: "VIP", name: "VIP", description: "Khu ghế ngồi thoải mái, gần sân khấu", capacity: 300, color: "#E8315B" },
      { id: "zone-1-3", code: "CAT1", name: "CAT 1", description: "Khu đứng phía trước", capacity: 800, color: "#7B61FF" },
      { id: "zone-1-4", code: "GA", name: "General Admission", description: "Khu đứng tổng hợp", capacity: 2000, color: "#3B9AF8" },
    ],
    ticketTypes: [
      { id: "tt-1-1", concertId: "concert-1", seatZoneId: "zone-1-1", name: "SVIP", description: "Tặng 01 set cocktail, priority entry, exclusive poster", price: 2950000, totalQuantity: 100, heldQuantity: 5, soldQuantity: 68, maxPerUser: 2, saleStartAt: "2026-06-01T10:00:00", saleEndAt: "2026-07-14T23:59:00", color: "#F5C842" },
      { id: "tt-1-2", concertId: "concert-1", seatZoneId: "zone-1-2", name: "VIP", description: "Ghế ngồi hạng nhất, gift bag độc quyền", price: 1950000, totalQuantity: 300, heldQuantity: 12, soldQuantity: 201, maxPerUser: 2, saleStartAt: "2026-06-01T10:00:00", saleEndAt: "2026-07-14T23:59:00", color: "#E8315B" },
      { id: "tt-1-3", concertId: "concert-1", seatZoneId: "zone-1-3", name: "CAT 1", description: "Khu đứng phía trước", price: 1250000, totalQuantity: 800, heldQuantity: 30, soldQuantity: 420, maxPerUser: 4, saleStartAt: "2026-06-01T10:00:00", saleEndAt: "2026-07-14T23:59:00", color: "#7B61FF" },
      { id: "tt-1-4", concertId: "concert-1", seatZoneId: "zone-1-4", name: "GA", description: "Vé standing thông thường", price: 750000, totalQuantity: 2000, heldQuantity: 80, soldQuantity: 1100, maxPerUser: 4, saleStartAt: "2026-06-01T10:00:00", saleEndAt: "2026-07-14T23:59:00", color: "#3B9AF8" },
    ],
  },
  {
    id: "concert-2",
    venueId: "venue-2",
    organizerId: "user-organizer-1",
    title: "Đi Qua Thương Nhớ Live Concert",
    slug: "di-qua-thuong-nho",
    description:
      "Mỹ Tâm trở lại với đêm nhạc lớn nhất năm tại Hà Nội! Hành trình âm nhạc qua những ca khúc gắn liền với thế hệ của chúng ta — từ những bản ballad da diết đến những bản pop sôi động, tất cả trong một đêm không thể quên.",
    artistName: "Mỹ Tâm",
    artistBio:
      "Mỹ Tâm — người phụ nữ mạnh mẽ nhất của làng nhạc Việt. Với hơn 20 năm hoạt động, cô đã trở thành biểu tượng không thể thay thế. Giọng hát đầy nội lực, khả năng biểu diễn đỉnh cao cùng những ca khúc xuyên suốt thế hệ như \"Đừng Nói Lời Chia Tay\", \"Hãy Về Với Em\", \"Nói Với Anh\" đã khắc sâu tên tuổi cô vào lịch sử âm nhạc Việt Nam.",
    startsAt: "2026-08-20T18:00:00",
    endsAt: "2026-08-20T21:30:00",
    status: "PUBLISHED",
    coverImageUrl:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&q=80",
    genre: "Pop / Ballad",
    tags: ["Pop", "Ballad", "Live Concert", "Outdoor"],
    venue: VENUES[1],
    seatZones: [
      { id: "zone-2-1", code: "SVIP", name: "SVIP Diamond", description: "Khu ghế ngồi đặc biệt, sát sân khấu", capacity: 500, color: "#F5C842" },
      { id: "zone-2-2", code: "VIP", name: "VIP Gold", description: "Khu ghế có mái che, view đẹp", capacity: 2000, color: "#E8315B" },
      { id: "zone-2-3", code: "CAT1", name: "CAT 1", description: "Tribuno phía trước", capacity: 5000, color: "#7B61FF" },
      { id: "zone-2-4", code: "CAT2", name: "CAT 2", description: "Tribuno phía sau", capacity: 8000, color: "#2DBE6C" },
      { id: "zone-2-5", code: "GA", name: "General Admission", description: "Khu đứng tự do", capacity: 20000, color: "#3B9AF8" },
    ],
    ticketTypes: [
      { id: "tt-2-1", concertId: "concert-2", seatZoneId: "zone-2-1", name: "SVIP Diamond", description: "Ghế ngồi VIP, welcoming gift, early access", price: 3500000, totalQuantity: 500, heldQuantity: 10, soldQuantity: 320, maxPerUser: 2, saleStartAt: "2026-06-10T10:00:00", saleEndAt: "2026-08-19T23:59:00", color: "#F5C842" },
      { id: "tt-2-2", concertId: "concert-2", seatZoneId: "zone-2-2", name: "VIP Gold", description: "Khu ghế có mái che, thoải mái", price: 2200000, totalQuantity: 2000, heldQuantity: 40, soldQuantity: 1450, maxPerUser: 4, saleStartAt: "2026-06-10T10:00:00", saleEndAt: "2026-08-19T23:59:00", color: "#E8315B" },
      { id: "tt-2-3", concertId: "concert-2", seatZoneId: "zone-2-3", name: "CAT 1", description: "Tribuno phía trước", price: 1500000, totalQuantity: 5000, heldQuantity: 100, soldQuantity: 3200, maxPerUser: 4, saleStartAt: "2026-06-10T10:00:00", saleEndAt: "2026-08-19T23:59:00", color: "#7B61FF" },
      { id: "tt-2-4", concertId: "concert-2", seatZoneId: "zone-2-4", name: "CAT 2", description: "Tribuno phía sau", price: 1000000, totalQuantity: 8000, heldQuantity: 150, soldQuantity: 5200, maxPerUser: 6, saleStartAt: "2026-06-10T10:00:00", saleEndAt: "2026-08-19T23:59:00", color: "#2DBE6C" },
      { id: "tt-2-5", concertId: "concert-2", seatZoneId: "zone-2-5", name: "GA", description: "Vé standing tự do", price: 650000, totalQuantity: 20000, heldQuantity: 500, soldQuantity: 12000, maxPerUser: 6, saleStartAt: "2026-06-10T10:00:00", saleEndAt: "2026-08-19T23:59:00", color: "#3B9AF8" },
    ],
  },
  {
    id: "concert-3",
    venueId: "venue-3",
    organizerId: "user-organizer-1",
    title: "Our 20th Moment 2026",
    slug: "our-20th-moment-2026",
    description:
      "Kỷ niệm 20 năm âm nhạc của một huyền thoại. Đêm nhạc acoustic và orchestra đặc biệt, nơi những ký ức được tái hiện qua ngôn ngữ âm thanh thuần khiết nhất.",
    artistName: "Thanh Lam & Hà Trần",
    artistBio:
      "Thanh Lam và Hà Trần — hai giọng ca được mệnh danh là \"Diva của nhạc Việt\" — cùng đứng trên một sân khấu để kỷ niệm 20 năm hành trình âm nhạc đầy cảm xúc. Sự kết hợp hiếm có này hứa hẹn mang đến những khoảnh khắc âm nhạc không thể nào quên.",
    startsAt: "2026-09-05T19:00:00",
    endsAt: "2026-09-05T22:30:00",
    status: "PUBLISHED",
    coverImageUrl:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80",
    genre: "Classical / Acoustic",
    tags: ["Acoustic", "Orchestra", "Classical", "Diva"],
    venue: VENUES[2],
    seatZones: [
      { id: "zone-3-1", code: "SVIP", name: "SVIP", description: "Hàng đầu, kèm cocktail reception", capacity: 200, color: "#F5C842" },
      { id: "zone-3-2", code: "VIP", name: "VIP", description: "Ghế ngồi hạng nhất", capacity: 800, color: "#E8315B" },
      { id: "zone-3-3", code: "CAT1", name: "CAT 1", description: "Khu B ghế ngồi", capacity: 2500, color: "#7B61FF" },
      { id: "zone-3-4", code: "GA", name: "Standing", description: "Khu standing phía sau", capacity: 5000, color: "#3B9AF8" },
    ],
    ticketTypes: [
      { id: "tt-3-1", concertId: "concert-3", seatZoneId: "zone-3-1", name: "SVIP", description: "Cocktail reception, meet & greet opportunity", price: 5500000, totalQuantity: 200, heldQuantity: 3, soldQuantity: 187, maxPerUser: 2, saleStartAt: "2026-06-15T10:00:00", saleEndAt: "2026-09-04T23:59:00", color: "#F5C842" },
      { id: "tt-3-2", concertId: "concert-3", seatZoneId: "zone-3-2", name: "VIP", description: "Ghế ngồi cao cấp với programme book", price: 3200000, totalQuantity: 800, heldQuantity: 20, soldQuantity: 650, maxPerUser: 2, saleStartAt: "2026-06-15T10:00:00", saleEndAt: "2026-09-04T23:59:00", color: "#E8315B" },
      { id: "tt-3-3", concertId: "concert-3", seatZoneId: "zone-3-3", name: "CAT 1", description: "Ghế ngồi standard", price: 1800000, totalQuantity: 2500, heldQuantity: 50, soldQuantity: 1900, maxPerUser: 4, saleStartAt: "2026-06-15T10:00:00", saleEndAt: "2026-09-04T23:59:00", color: "#7B61FF" },
      { id: "tt-3-4", concertId: "concert-3", seatZoneId: "zone-3-4", name: "Standing", description: "Khu đứng tự do", price: 900000, totalQuantity: 5000, heldQuantity: 120, soldQuantity: 3200, maxPerUser: 4, saleStartAt: "2026-06-15T10:00:00", saleEndAt: "2026-09-04T23:59:00", color: "#3B9AF8" },
    ],
  },
  {
    id: "concert-4",
    venueId: "venue-4",
    organizerId: "user-organizer-1",
    title: "Một Thời Đã Yêu",
    slug: "mot-thoi-da-yeu",
    description:
      "Lam Trường và những giai điệu của thế kỷ trước — những ca khúc đã trở thành một phần ký ức không thể xóa nhòa. Đêm nhạc acoustic mang đến không gian thân mật, ấm áp.",
    artistName: "Lam Trường",
    artistBio:
      "Lam Trường là giọng ca nam được yêu mến nhất thập niên 90-2000 của nhạc Việt. Những bản tình ca như \"Tình Thôi Xót Xa\", \"Bước Chân Hai Thế Giới\", \"Lòng Mẹ\" đã trở thành một phần của ký ức tập thể của cả thế hệ. Sau hơn 30 năm ca hát, chất giọng của anh vẫn nguyên vẹn sức quyến rũ đặc trưng.",
    startsAt: "2026-10-12T19:30:00",
    endsAt: "2026-10-12T22:00:00",
    status: "PUBLISHED",
    coverImageUrl:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80",
    genre: "Nhạc Vàng / Acoustic",
    tags: ["Acoustic", "Nhạc Vàng", "Retro", "Intimate"],
    venue: VENUES[3],
    seatZones: [
      { id: "zone-4-1", code: "VIP", name: "VIP Front Row", description: "Hàng đầu, giao lưu với nghệ sĩ", capacity: 60, color: "#F5C842" },
      { id: "zone-4-2", code: "CAT1", name: "CAT 1", description: "Hàng giữa", capacity: 200, color: "#E8315B" },
      { id: "zone-4-3", code: "CAT2", name: "CAT 2", description: "Hàng sau", capacity: 320, color: "#7B61FF" },
    ],
    ticketTypes: [
      { id: "tt-4-1", concertId: "concert-4", seatZoneId: "zone-4-1", name: "VIP Front Row", description: "Giao lưu & ký tặng sau chương trình", price: 2500000, totalQuantity: 60, heldQuantity: 2, soldQuantity: 55, maxPerUser: 2, saleStartAt: "2026-07-01T10:00:00", saleEndAt: "2026-10-11T23:59:00", color: "#F5C842" },
      { id: "tt-4-2", concertId: "concert-4", seatZoneId: "zone-4-2", name: "CAT 1", description: "Ghế ngồi hạng nhất", price: 1500000, totalQuantity: 200, heldQuantity: 5, soldQuantity: 168, maxPerUser: 2, saleStartAt: "2026-07-01T10:00:00", saleEndAt: "2026-10-11T23:59:00", color: "#E8315B" },
      { id: "tt-4-3", concertId: "concert-4", seatZoneId: "zone-4-3", name: "CAT 2", description: "Ghế ngồi standard", price: 900000, totalQuantity: 320, heldQuantity: 10, soldQuantity: 245, maxPerUser: 4, saleStartAt: "2026-07-01T10:00:00", saleEndAt: "2026-10-11T23:59:00", color: "#7B61FF" },
    ],
  },
  {
    id: "concert-5",
    venueId: "venue-1",
    organizerId: "user-organizer-1",
    title: "Nơi Tình Yêu Bắt Đầu",
    slug: "noi-tinh-yeu-bat-dau",
    description:
      "Bích Phương trình diễn trong một đêm nhạc đặc biệt tại TP.HCM, mang đến những ca khúc mới nhất và những bản hit đã gắn bó cùng khán giả suốt nhiều năm qua.",
    artistName: "Bích Phương",
    artistBio:
      "Bích Phương là một trong những nữ ca sĩ pop hàng đầu Việt Nam hiện nay, nổi tiếng với những ca khúc giai điệu cuốn hút và lời ca ý nghĩa. Các hit như \"Bùa Yêu\", \"Đi Đu Đưa Đi\", \"Nói Thật Với Anh\" đã chiếm lĩnh các bảng xếp hạng âm nhạc và được hàng triệu người yêu thích.",
    startsAt: "2026-11-08T19:30:00",
    endsAt: "2026-11-08T21:30:00",
    status: "PUBLISHED",
    coverImageUrl:
      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&q=80",
    genre: "Pop / Electronic",
    tags: ["Pop", "Electronic", "Dance", "Party"],
    venue: VENUES[0],
    seatZones: [
      { id: "zone-5-1", code: "SVIP", name: "SVIP", description: "VIP stage view", capacity: 150, color: "#F5C842" },
      { id: "zone-5-2", code: "VIP", name: "VIP", description: "Khu ghế ngồi", capacity: 400, color: "#E8315B" },
      { id: "zone-5-3", code: "GA", name: "GA", description: "Standing area", capacity: 2500, color: "#3B9AF8" },
    ],
    ticketTypes: [
      { id: "tt-5-1", concertId: "concert-5", seatZoneId: "zone-5-1", name: "SVIP", description: "Gift set + early access", price: 2200000, totalQuantity: 150, heldQuantity: 8, soldQuantity: 95, maxPerUser: 2, saleStartAt: "2026-07-15T10:00:00", saleEndAt: "2026-11-07T23:59:00", color: "#F5C842" },
      { id: "tt-5-2", concertId: "concert-5", seatZoneId: "zone-5-2", name: "VIP", description: "Seated section", price: 1500000, totalQuantity: 400, heldQuantity: 15, soldQuantity: 280, maxPerUser: 2, saleStartAt: "2026-07-15T10:00:00", saleEndAt: "2026-11-07T23:59:00", color: "#E8315B" },
      { id: "tt-5-3", concertId: "concert-5", seatZoneId: "zone-5-3", name: "GA", description: "Standing section", price: 850000, totalQuantity: 2500, heldQuantity: 60, soldQuantity: 1800, maxPerUser: 4, saleStartAt: "2026-07-15T10:00:00", saleEndAt: "2026-11-07T23:59:00", color: "#3B9AF8" },
    ],
  },
  {
    id: "concert-6",
    venueId: "venue-2",
    organizerId: "user-organizer-1",
    title: "Coming Soon: Secret Show",
    slug: "secret-show-2026",
    description: "Một đêm diễn bí ẩn đang được chuẩn bị. Thông tin sẽ được công bố sớm. Đăng ký ngay để nhận thông báo đầu tiên.",
    artistName: "TBA",
    artistBio: "",
    startsAt: "2026-12-31T20:00:00",
    endsAt: "2026-12-31T23:59:00",
    status: "DRAFT",
    coverImageUrl:
      "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&q=80",
    genre: "TBA",
    tags: ["Mystery", "Upcoming"],
    venue: VENUES[1],
    seatZones: [],
    ticketTypes: [],
  },
];

// ── Mock tickets (for logged-in user) ────────────────────────────────────────

export const MY_TICKETS: Ticket[] = [
  {
    id: "ticket-001",
    concertId: "concert-1",
    ticketTypeId: "tt-1-2",
    userId: "user-me",
    orderId: "order-001",
    qrTokenHash: "TB-2026-A8F3K9",
    status: "ISSUED",
    issuedAt: "2026-06-05T14:22:00",
    concert: CONCERTS[0],
    ticketType: CONCERTS[0].ticketTypes[1],
    seatZone: CONCERTS[0].seatZones[1],
  },
  {
    id: "ticket-002",
    concertId: "concert-2",
    ticketTypeId: "tt-2-3",
    userId: "user-me",
    orderId: "order-002",
    qrTokenHash: "TB-2026-C2M7P1",
    status: "ISSUED",
    issuedAt: "2026-06-04T09:15:00",
    concert: CONCERTS[1],
    ticketType: CONCERTS[1].ticketTypes[2],
    seatZone: CONCERTS[1].seatZones[2],
  },
  {
    id: "ticket-003",
    concertId: "concert-3",
    ticketTypeId: "tt-3-2",
    userId: "user-me",
    orderId: "order-003",
    qrTokenHash: "TB-2026-X9L4W5",
    status: "CHECKED_IN",
    issuedAt: "2026-05-20T16:40:00",
    checkedInAt: "2026-09-05T18:45:00",
    concert: CONCERTS[2],
    ticketType: CONCERTS[2].ticketTypes[1],
    seatZone: CONCERTS[2].seatZones[1],
  },
];

// ── Guest list mock data ─────────────────────────────────────────────────────

export const GUEST_LIST: GuestEntry[] = [
  { id: "g-1", concertId: "concert-1", fullName: "Nguyễn Thị Mai Lan", phone: "0912345678", email: "mailan@example.com", code: "VIP-001", status: "INVITED", seatZoneId: "zone-1-1" },
  { id: "g-2", concertId: "concert-1", fullName: "Trần Văn Minh Đức", phone: "0923456789", email: "minhduc@example.com", code: "VIP-002", status: "CHECKED_IN", checkedInAt: "2026-07-15T19:20:00", seatZoneId: "zone-1-1" },
  { id: "g-3", concertId: "concert-1", fullName: "Lê Thị Thanh Hương", phone: "0934567890", code: "VIP-003", status: "INVITED", seatZoneId: "zone-1-2" },
  { id: "g-4", concertId: "concert-1", fullName: "Phạm Quốc Bảo", phone: "0945678901", email: "quocbao@corp.vn", code: "VIP-004", status: "INVITED", seatZoneId: "zone-1-2", note: "Nhãn hàng tài trợ - Priority" },
  { id: "g-5", concertId: "concert-1", fullName: "Hoàng Thu Hà", phone: "0956789012", code: "VIP-005", status: "CANCELLED", seatZoneId: "zone-1-1" },
  { id: "g-6", concertId: "concert-1", fullName: "Vũ Đình Trọng", phone: "0967890123", email: "dinhtrongvu@media.vn", code: "PRESS-001", status: "INVITED", seatZoneId: "zone-1-2", note: "Báo chí - Press accreditation" },
];

// ── Admin stats ──────────────────────────────────────────────────────────────

export const ADMIN_STATS = {
  totalRevenue: 8_950_000_000,
  ticketsSold: 28_456,
  activeEvents: 5,
  totalUsers: 34_789,
  monthlyRevenue: [
    { month: "T1", revenue: 450_000_000 },
    { month: "T2", revenue: 320_000_000 },
    { month: "T3", revenue: 680_000_000 },
    { month: "T4", revenue: 920_000_000 },
    { month: "T5", revenue: 1_100_000_000 },
    { month: "T6", revenue: 1_850_000_000 },
    { month: "T7", revenue: 2_100_000_000 },
    { month: "T8", revenue: 1_530_000_000 },
  ],
  ticketsByType: [
    { name: "GA", value: 15200, color: "#3B9AF8" },
    { name: "CAT 1", value: 7800, color: "#7B61FF" },
    { name: "VIP", value: 4100, color: "#E8315B" },
    { name: "SVIP", value: 1356, color: "#F5C842" },
  ],
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
};

export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getAvailableQuantity = (tt: TicketType): number =>
  tt.totalQuantity - tt.heldQuantity - tt.soldQuantity;

export const getSoldPercent = (tt: TicketType): number =>
  Math.round(((tt.heldQuantity + tt.soldQuantity) / tt.totalQuantity) * 100);
