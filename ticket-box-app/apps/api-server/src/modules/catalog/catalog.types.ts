export type MoneyDto = {
  amount: number;
  currency: "VND";
};

export type VenueSummaryDto = {
  id: string;
  name: string;
  city: string;
};

export type VenueDto = VenueSummaryDto & {
  address: string;
  capacity?: number;
  map_url?: string;
};

export type ConcertSummaryDto = {
  id: string;
  title: string;
  slug: string;
  artist_name: string;
  starts_at: string;
  ends_at: string;
  status: "PUBLISHED";
  cover_image_url?: string;
  venue: VenueSummaryDto;
  ticket_price_range?: {
    min_amount: number;
    max_amount: number;
    currency: "VND";
  };
};

export type ConcertDetailDto = Omit<ConcertSummaryDto, "venue" | "ticket_price_range"> & {
  description?: string;
  venue: VenueDto;
  artist_bio?: string;
};

export type SeatZoneDto = {
  id: string;
  code: string;
  name: string;
  description?: string;
  capacity: number;
  svg_path?: string;
  sort_order: number;
};

export type TicketTypeDto = {
  id: string;
  concert_id?: string;
  seat_zone_id: string;
  zone_code?: string;
  name: string;
  description?: string;
  price: MoneyDto;
  max_per_user: number;
  sale_start_at: string;
  sale_end_at: string;
  status: "DRAFT" | "ON_SALE" | "SOLD_OUT" | "CLOSED";
};

export type ConcertMetadataDto = {
  concert: Omit<ConcertDetailDto, "venue" | "artist_bio">;
  venue: VenueDto;
  seat_zones: SeatZoneDto[];
  ticket_types: TicketTypeDto[];
  seat_map: {
    svg_url?: string;
    fallback_image_url?: string;
  };
  artist_bio?: string;
};

export type SeatMapDto = {
  concert_id: string;
  svg_url?: string;
  fallback_image_url?: string;
  zones: Array<Pick<SeatZoneDto, "code" | "name" | "svg_path" | "sort_order"> & { seat_zone_id: string }>;
};

export type InventoryDto = {
  concert_id: string;
  as_of: string;
  items: Array<{
    ticket_type_id: string;
    seat_zone_id: string;
    zone_code: string;
    available_quantity: number;
    status: "ON_SALE" | "SOLD_OUT" | "CLOSED";
    display_status: "AVAILABLE" | "LOW_STOCK" | "SOLD_OUT" | "CLOSED" | "UPDATING";
  }>;
};
