import { Eye, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  apiGet,
  type ApiResponse,
  type ConcertDetail,
  type ConcertMetadata,
  type Inventory,
} from "../../lib/api-client";
import { mapDetailConcert, type UiConcert } from "../../lib/catalog-ui";
import {
  listOrganizerConcerts,
  type OrganizerConcert,
} from "../../services/organizer.service";
import { ConcertDetailView } from "../audience/ConcertDetailPage";

type PreviewRole = "admin" | "organizer";

type LoadStatus = "loading" | "ready" | "error";

// Trang "Xem trước" cho Admin/Organizer: render giống góc nhìn Audience,
// xem được cả concert DRAFT theo quyền, không cho mua vé khi chưa PUBLISHED.
export function ConcertPreviewPage({ role }: { role: PreviewRole }) {
  const { concertId } = useParams<{ concertId: string }>();
  const [concert, setConcert] = useState<UiConcert | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    if (!concertId) return;
    let mounted = true;
    setStatus("loading");

    const load =
      role === "admin"
        ? loadAdminPreview(concertId)
        : loadOrganizerPreview(concertId);

    load
      .then((data) => {
        if (!mounted) return;
        setConcert(data);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, [concertId, role]);

  const backTo = role === "admin" ? "/admin" : "/organizer/concerts";

  if (status === "loading") {
    return <PreviewState text="Đang tải bản xem trước..." backTo={backTo} />;
  }

  if (status === "error" || !concert) {
    return <PreviewState text="Không thể tải bản xem trước." backTo={backTo} />;
  }

  const isPublished = concert.status === "PUBLISHED";

  return (
    <div className="relative">
      <div className="sticky top-16 z-40 flex items-center justify-between gap-3 border-b border-[#F5C842]/30 bg-[#F5C842]/10 px-4 py-2.5 backdrop-blur sm:px-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#F5C842]">
          <Eye className="h-4 w-4" />
          Xem trước ({role === "admin" ? "Admin" : "Ban tổ chức"}) — trạng thái: {concert.status}
          {!isPublished && (
            <span className="hidden text-xs font-normal text-[#B0B0C0] sm:inline">
              · Concert chưa public, khán giả không thấy trang này.
            </span>
          )}
        </div>
        <Link
          to={backTo}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#F0EDEB] hover:bg-white/10"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Quay lại quản trị
        </Link>
      </div>

      <ConcertDetailView
        concert={concert}
        buyDisabledOverride
        buyLabel={isPublished ? "Mua vé (tắt trong xem trước)" : "Chưa mở bán (DRAFT)"}
      />
    </div>
  );
}

// Admin: lấy metadata đầy đủ (kể cả DRAFT) qua route admin riêng.
async function loadAdminPreview(concertId: string): Promise<UiConcert> {
  const response = await apiGet<ApiResponse<ConcertMetadata>>(
    `/admin/concerts/${concertId}/metadata`,
  );
  const metadata = response.data;
  const detail: ConcertDetail = {
    ...metadata.concert,
    artist_bio: metadata.artist_bio,
    artist_bio_image_url: metadata.artist_bio_image_url,
    seat_map_url: metadata.seat_map.svg_url,
    venue: metadata.venue,
  };

  return mapDetailConcert(detail, metadata, emptyInventory(detail.id));
}

// Organizer: tái dùng list concerts của BTC (đã kèm seat zones + ticket types).
async function loadOrganizerPreview(concertId: string): Promise<UiConcert> {
  const concerts = await listOrganizerConcerts();
  const concert = concerts.find((item) => item.id === concertId);
  if (!concert) throw new Error(`Organizer concert not found: ${concertId}`);

  const detail: ConcertDetail = {
    id: concert.id,
    title: concert.title,
    slug: concert.slug,
    description: concert.description,
    artist_name: concert.artist_name,
    artist_bio: concert.artist_bio,
    artist_bio_image_url: concert.artist_bio_image_url,
    starts_at: concert.starts_at,
    ends_at: concert.ends_at,
    status: concert.status,
    cover_image_url: concert.cover_image_url,
    venue: { ...concert.venue, address: "" },
  };
  const metadata: ConcertMetadata = {
    concert: detail,
    venue: detail.venue,
    seat_zones: concert.seat_zones,
    ticket_types: concert.ticket_types.map((ticketType) => ({
      id: ticketType.id,
      seat_zone_id: ticketType.seat_zone_id,
      zone_code: ticketType.zone_code,
      name: ticketType.name,
      description: ticketType.description,
      price: ticketType.price,
      max_per_user: ticketType.max_per_user,
      sale_start_at: ticketType.sale_start_at,
      sale_end_at: ticketType.sale_end_at,
      status: ticketType.status as "DRAFT" | "ON_SALE" | "SOLD_OUT" | "CLOSED",
    })),
    seat_map: {},
    artist_bio: concert.artist_bio,
    artist_bio_image_url: concert.artist_bio_image_url,
  };
  const inventory: Inventory = {
    concert_id: concert.id,
    as_of: new Date().toISOString(),
    items: concert.ticket_types.map((ticketType) => ({
      ticket_type_id: ticketType.id,
      seat_zone_id: ticketType.seat_zone_id,
      zone_code: ticketType.zone_code,
      available_quantity: ticketType.available_quantity,
      status: ticketType.status === "SOLD_OUT" ? "SOLD_OUT" : "ON_SALE",
      display_status: ticketType.available_quantity > 0 ? "AVAILABLE" : "SOLD_OUT",
    })),
  };

  return mapDetailConcert(detail, metadata, inventory);
}

function emptyInventory(concertId: string): Inventory {
  return { concert_id: concertId, as_of: new Date().toISOString(), items: [] };
}

function PreviewState({ text, backTo }: { text: string; backTo: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#08080E] px-4 pt-20 text-center text-[#F0EDEB]">
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "2rem" }}>{text}</h1>
      <Link to={backTo} className="mt-4 text-sm text-[#F5C842]">
        Quay lại quản trị
      </Link>
    </div>
  );
}
