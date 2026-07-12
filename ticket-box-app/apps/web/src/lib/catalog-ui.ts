import type {
  ConcertDetail,
  ConcertMetadata,
  ConcertSummary,
  Inventory,
  SeatZone,
  TicketType,
} from "./api-client";
import { resolveCatalogImageUrl } from "../img/catalog-images";

export type UiVenue = {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
};

export type UiSeatZone = {
  id: string;
  code: string;
  name: string;
  description: string;
  capacity: number;
  color: string;
};

export type UiTicketType = {
  id: string;
  seatZoneId: string;
  zoneCode: string;
  name: string;
  price: number;
  maxPerUser: number;
  status: TicketType["status"];
  availableQuantity: number | null;
  soldPercent: number;
  color: string;
  // Khung giờ bán — dùng để chặn mua trước giờ mở bán ngay trên UI.
  saleStartAt?: string;
  saleEndAt?: string;
};

export type UiArtist = {
  name: string;
  bio: string;
  imageUrl: string;
};

export type UiConcert = {
  id: string;
  slug: string;
  title: string;
  artistName: string;
  description: string;
  artistBio: string;
  artistBioImageUrl: string;
  // Lineup nghệ sĩ: từ cột artists mới; concert cũ → mảng 1 phần tử từ field đơn.
  artists: UiArtist[];
  startsAt: string;
  endsAt: string;
  status: ConcertSummary["status"];
  coverImageUrl: string;
  // SVG tương tác — trang mua vé (SeatSelectionPage).
  seatMapUrl?: string;
  // Ảnh PNG/JPEG — trang thông tin concert (ConcertDetailPage).
  seatMapImageUrl?: string;
  genre: string;
  tags: string[];
  venue: UiVenue;
  ticketTypes: UiTicketType[];
  seatZones: UiSeatZone[];
  minPrice: number | null;
};

const zoneColors = ["#F5C842", "#E8315B", "#7B61FF", "#2DBE6C", "#26A7DE", "#F97316"];

export function mapSummaryConcert(concert: ConcertSummary): UiConcert {
  const minPrice = concert.ticket_price_range?.min_amount ?? null;

  return {
    id: concert.id,
    slug: concert.slug || concert.id,
    title: concert.title,
    artistName: concert.artist_name,
    description: toDescriptionExcerpt(concert.description),
    artistBio: "",
    artistBioImageUrl: "",
    artists: [],
    startsAt: concert.starts_at,
    endsAt: concert.ends_at,
    status: concert.status,
    coverImageUrl: resolveCatalogImageUrl(concert.cover_image_url),
    genre: "Live Music",
    tags: [concert.venue.city],
    venue: {
      id: concert.venue.id,
      name: concert.venue.name,
      address: "",
      city: concert.venue.city,
      capacity: 0,
    },
    ticketTypes:
      minPrice === null
        ? []
        : [
            {
              id: `${concert.id}:price-range`,
              seatZoneId: "",
              zoneCode: "",
              name: "Starting price",
              price: minPrice,
              maxPerUser: 1,
              status: "ON_SALE",
              availableQuantity: null,
              soldPercent: 0,
              color: zoneColors[0],
            },
          ],
    seatZones: [],
    minPrice,
  };
}

export function mapDetailConcert(
  concert: ConcertDetail,
  metadata: ConcertMetadata,
  inventory: Inventory,
): UiConcert {
  const zones = metadata.seat_zones.map(mapSeatZone);
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  const inventoryByTicketType = new Map(
    inventory.items.map((item) => [item.ticket_type_id, item]),
  );
  const ticketTypes = metadata.ticket_types.map((ticketType, index) => {
    const item = inventoryByTicketType.get(ticketType.id);
    const availableQuantity = item?.available_quantity ?? null;
    const color = zoneById.get(ticketType.seat_zone_id)?.color ?? zoneColors[index % zoneColors.length];

    return {
      id: ticketType.id,
      seatZoneId: ticketType.seat_zone_id,
      zoneCode: ticketType.zone_code ?? item?.zone_code ?? "",
      name: ticketType.name,
      price: ticketType.price.amount,
      maxPerUser: ticketType.max_per_user,
      status: ticketType.status,
      availableQuantity,
      soldPercent: estimateSoldPercent(availableQuantity, ticketType.status),
      color,
      saleStartAt: ticketType.sale_start_at,
      saleEndAt: ticketType.sale_end_at,
    };
  });

  const artistBio = metadata.artist_bio ?? concert.artist_bio ?? "";
  const artistBioImageUrl = concert.artist_bio_image_url ?? metadata.artist_bio_image_url ?? "";
  const rawArtists = concert.artists ?? metadata.artists;
  // Concert cũ chưa có cột artists → dựng mảng 1 phần tử từ field đơn để UI chỉ render 1 kiểu.
  const artists: UiArtist[] =
    rawArtists && rawArtists.length > 0
      ? rawArtists.map((artist) => ({
          name: artist.name || concert.artist_name,
          bio: artist.bio,
          imageUrl: artist.image_url ?? "",
        }))
      : [{ name: concert.artist_name, bio: artistBio, imageUrl: artistBioImageUrl }];

  return {
    id: concert.id,
    slug: concert.slug || concert.id,
    title: concert.title,
    artistName: concert.artist_name,
    description: concert.description ?? "Concert details are being updated.",
    artistBio,
    artistBioImageUrl,
    artists,
    startsAt: concert.starts_at,
    endsAt: concert.ends_at,
    status: concert.status,
    coverImageUrl: resolveCatalogImageUrl(concert.cover_image_url),
    seatMapUrl: concert.seat_map_url ?? metadata.seat_map.svg_url,
    seatMapImageUrl: concert.seat_map_image_url ?? metadata.seat_map.fallback_image_url,
    genre: "Live Music",
    tags: [concert.venue.city],
    venue: {
      id: concert.venue.id,
      name: concert.venue.name,
      address: concert.venue.address,
      city: concert.venue.city,
      capacity: concert.venue.capacity ?? zones.reduce((sum, zone) => sum + zone.capacity, 0),
    },
    ticketTypes,
    seatZones: zones,
    minPrice:
      ticketTypes.length > 0
        ? Math.min(...ticketTypes.map((ticketType) => ticketType.price))
        : null,
  };
}

export function formatCurrency(amount: number): string {
  return `${new Intl.NumberFormat("en-US").format(amount)} VND`;
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

export function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export function getAvailableQuantity(ticketType: UiTicketType): number {
  return ticketType.availableQuantity ?? 0;
}

export function getSoldPercent(ticketType: UiTicketType): number {
  return ticketType.soldPercent;
}

function mapSeatZone(zone: SeatZone, index: number): UiSeatZone {
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    description: zone.description ?? `${zone.code} zone`,
    capacity: zone.capacity,
    color: zoneColors[index % zoneColors.length],
  };
}

function estimateSoldPercent(availableQuantity: number | null, status: TicketType["status"]) {
  if (status === "SOLD_OUT") return 100;
  if (availableQuantity === null) return 0;
  if (availableQuantity <= 0) return 100;
  if (availableQuantity < 20) return 82;
  if (availableQuantity < 100) return 62;
  return 28;
}

function toDescriptionExcerpt(description?: string) {
  const text = description?.trim();
  if (!text) return "Thông tin sự kiện đang được cập nhật.";

  const firstSentence = text.match(/^.+?[.!?](?:\s|$)/u)?.[0]?.trim() ?? text;
  if (firstSentence.length <= 150) return firstSentence;

  return `${firstSentence.slice(0, 147).trimEnd()}...`;
}
